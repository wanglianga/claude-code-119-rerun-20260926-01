import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Complaint,
  Incident,
  IncidentMessage,
  IncidentType,
  Screening,
  TimelineEvent,
  Venue,
} from '../../entities';
import { AuthUser } from '../auth/current-user.decorator';
import { TimelineService } from '../timeline/timeline.service';

export const INCIDENT_LABEL: Record<string, string> = {
  FILE_DAMAGED: '影片文件损坏',
  MISSING_PART: '设备缺件',
  NOISE_COMPLAINT: '居民投诉噪声',
  RAIN: '临时降雨',
  OVERCROWD: '观众超员',
  POWER_TRIP: '供电跳闸',
  EXTENSION_REQ: '商户要求延长活动',
};

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepo: Repository<Incident>,
    @InjectRepository(IncidentMessage)
    private readonly msgRepo: Repository<IncidentMessage>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectRepository(Screening)
    private readonly screeningRepo: Repository<Screening>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    private readonly timeline: TimelineService,
    private readonly dataSource: DataSource,
  ) {}

  label(type: string) {
    return INCIDENT_LABEL[type] || type;
  }

  async listByScreening(screeningId: string) {
    const list = await this.incidentRepo.find({
      where: { screeningId },
      relations: { messages: true },
      order: { createdAt: 'DESC' },
    });
    list.forEach((i) =>
      i.messages?.sort((a, b) => +a.createdAt - +b.createdAt),
    );
    return list;
  }

  async listOpen(user: AuthUser) {
    const where: any = [{ status: 'OPEN' }, { status: 'PROCESSING' }];
    const list = await this.incidentRepo.find({
      where,
      relations: { screening: { venue: true, org: true } },
      order: { severity: 'DESC', createdAt: 'ASC' },
    });
    // 申请方只看本主办方
    return user.role === 'APPLICANT'
      ? list.filter((i) => i.screening?.orgId === user.orgId)
      : list;
  }

  /**
   * 上报异常。任意协同角色均可发起；
   * 噪声投诉自动生成投诉工单。
   */
  async create(
    user: AuthUser,
    screeningId: string,
    dto: {
      type: IncidentType;
      description: string;
      metricValue?: number;
      severity?: number;
    },
  ) {
    const s = await this.screeningRepo.findOne({ where: { id: screeningId } });
    if (!s) throw new BadRequestException('场次不存在');

    return this.dataSource.transaction(async (manager) => {
      const causedNoise = dto.type === IncidentType.NOISE_COMPLAINT;
      const causedDamage = dto.type === IncidentType.MISSING_PART;
      const incident = manager.create(Incident, {
        screeningId,
        type: dto.type,
        description: dto.description,
        metricValue: dto.metricValue ?? null,
        severity: dto.severity || (causedNoise || dto.type === IncidentType.OVERCROWD ? 2 : 1),
        status: 'OPEN',
        reporterName: user.name,
        reporterRole: user.role,
        causedNoise,
        causedDamage,
      });
      const saved = await manager.save(incident);

      await manager.save(
        manager.create(IncidentMessage, {
          incidentId: saved.id,
          senderName: user.name,
          senderRole: user.role,
          content: dto.description,
        }),
      );

      if (causedNoise) {
        s.hasNoiseIssue = true;
        await manager.save(s);
        const venue = await manager.findOne(Venue, {
          where: { id: s.venueId },
        });
        if (venue) {
          venue.noiseCount += 1;
          await manager.save(venue);
        }
        await manager.save(
          manager.create(Complaint, {
            screeningId,
            incidentId: saved.id,
            complainant: '现场居民（待补充联系方式）',
            content: dto.description,
            status: 'OPEN',
            handlerName: user.name,
          }),
        );
      }

      await manager.save(
        manager.create(TimelineEvent, {
          screeningId,
          phase: 'INCIDENT',
          title: `上报异常：${this.label(dto.type)}`,
          detail: dto.description,
          actorName: user.name,
          actorRole: user.role,
        }),
      );
      return manager.findOne(Incident, {
        where: { id: saved.id },
        relations: { messages: true },
      });
    });
  }

  /** 六类角色围绕同一异常协同留言（申请方/审核员/仓库/现场/安保/财务） */
  async postMessage(user: AuthUser, incidentId: string, content: string) {
    const incident = await this.incidentRepo.findOne({
      where: { id: incidentId },
    });
    if (!incident) throw new BadRequestException('异常不存在');
    const msg = this.msgRepo.create({
      incidentId,
      senderName: user.name,
      senderRole: user.role,
      content,
    });
    await this.msgRepo.save(msg);
    if (incident.status === 'OPEN') {
      incident.status = 'PROCESSING';
      await this.incidentRepo.save(incident);
      await this.timeline.log({
        screeningId: incident.screeningId,
        phase: 'INCIDENT',
        title: `异常进入协同处理：${this.label(incident.type)}`,
        detail: `${user.name}（${user.role}）响应`,
        actorName: user.name,
        actorRole: user.role,
      });
    }
    return this.msgRepo.findOne({ where: { id: msg.id } });
  }

  /** 解决/关闭异常，填写处理结果 */
  async resolve(
    user: AuthUser,
    incidentId: string,
    resolution: string,
    extra: { approved?: boolean; complainant?: string; handleResult?: string } = {},
  ) {
    const incident = await this.incidentRepo.findOne({
      where: { id: incidentId },
      relations: { screening: true },
    });
    if (!incident) throw new BadRequestException('异常不存在');
    if (!resolution) throw new BadRequestException('必须填写处理结果');

    return this.dataSource.transaction(async (manager) => {
      incident.status = 'RESOLVED';
      incident.resolution =
        incident.type === IncidentType.EXTENSION_REQ
          ? `${extra.approved ? '【已批准延长】' : '【未批准延长】'}${resolution}`
          : resolution;
      incident.resolvedAt = new Date();
      await manager.save(incident);

      // 噪声投诉同步关闭对应投诉工单
      if (incident.type === IncidentType.NOISE_COMPLAINT) {
        const complaint = await manager.findOne(Complaint, {
          where: { incidentId: incident.id },
        });
        if (complaint) {
          complaint.status = 'RESOLVED';
          complaint.complainant = extra.complainant || complaint.complainant;
          complaint.handleResult = extra.handleResult || resolution;
          complaint.handlerName = user.name;
          await manager.save(complaint);
        }
      }

      await manager.save(
        manager.create(TimelineEvent, {
          screeningId: incident.screeningId,
          phase: 'INCIDENT',
          title: `异常已解决：${this.label(incident.type)}`,
          detail: incident.resolution,
          actorName: user.name,
          actorRole: user.role,
        }),
      );
      return manager.findOne(Incident, {
        where: { id: incidentId },
        relations: { messages: true },
      });
    });
  }

  // ---- 投诉台账 ----
  listComplaints(screeningId?: string) {
    return this.complaintRepo.find({
      where: screeningId ? { screeningId } : {},
      order: { createdAt: 'DESC' },
    });
  }
}

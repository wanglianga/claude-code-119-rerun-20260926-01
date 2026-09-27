import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Screening, ScreeningStatus } from '../../entities';
import { AuthUser } from '../auth/current-user.decorator';
import { TimelineService } from '../timeline/timeline.service';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(Screening)
    private readonly screeningRepo: Repository<Screening>,
    private readonly timeline: TimelineService,
  ) {}

  private async load(id: string) {
    const s = await this.screeningRepo.findOne({
      where: { id },
      relations: { venue: true, org: true },
    });
    if (!s) throw new BadRequestException('场次不存在');
    return s;
  }

  async approve(
    user: AuthUser,
    id: string,
    copyrightConfirmed: boolean,
    recordConfirmed: boolean,
    remark: string,
  ) {
    const s = await this.load(id);
    if (!['SUBMITTED', 'AUDITING', 'REJECTED'].includes(s.status)) {
      throw new BadRequestException('当前状态不能审核通过');
    }
    if (!copyrightConfirmed || !recordConfirmed) {
      throw new BadRequestException('必须同时确认影片授权和公共活动备案');
    }
    s.auditorId = user.id;
    s.auditedAt = new Date();
    s.copyrightConfirmed = true;
    s.recordConfirmed = true;
    s.auditRemark = remark || '影片授权与公共活动备案均已确认';
    await this.timeline.transition({
      screening: s,
      toStatus: ScreeningStatus.APPROVED,
      phase: 'AUDIT',
      title: '文化审核通过',
      detail: s.auditRemark,
      actorName: user.name,
      actorRole: user.role,
    });
    return this.screeningRepo.findOne({
      where: { id },
      relations: { venue: true, org: true },
    });
  }

  async reject(user: AuthUser, id: string, reason: string) {
    const s = await this.load(id);
    if (!['SUBMITTED', 'AUDITING'].includes(s.status)) {
      throw new BadRequestException('当前状态不能驳回');
    }
    if (!reason) throw new BadRequestException('驳回必须填写原因');
    s.auditorId = user.id;
    s.auditedAt = new Date();
    s.auditRemark = reason;
    await this.timeline.transition({
      screening: s,
      toStatus: ScreeningStatus.REJECTED,
      phase: 'AUDIT',
      title: '审核驳回',
      detail: reason,
      actorName: user.name,
      actorRole: user.role,
    });
    return this.screeningRepo.findOne({
      where: { id },
      relations: { venue: true, org: true },
    });
  }
}

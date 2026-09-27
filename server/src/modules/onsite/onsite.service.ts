import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OnsiteCheck,
  Screening,
  ScreeningStatus,
  VolunteerCheckin,
} from '../../entities';
import { AuthUser } from '../auth/current-user.decorator';
import { TimelineService } from '../timeline/timeline.service';

/** 噪声限值 dB(A)，超过即不达标并进入异常关注 */
const NOISE_LIMIT_DB = 65;

const CHECK_LABEL: Record<string, string> = {
  SETUP_PHOTO: '搭建照片',
  TEST_PLAY: '试播截图',
  NOISE: '噪声分贝',
  AUDIENCE_ISOLATION: '观众区域隔离',
  FIRE_LANE: '消防通道',
};

@Injectable()
export class OnsiteService {
  constructor(
    @InjectRepository(OnsiteCheck)
    private readonly checkRepo: Repository<OnsiteCheck>,
    @InjectRepository(Screening)
    private readonly screeningRepo: Repository<Screening>,
    @InjectRepository(VolunteerCheckin)
    private readonly volunteerRepo: Repository<VolunteerCheckin>,
    private readonly timeline: TimelineService,
  ) {}

  label(type: string) {
    return CHECK_LABEL[type] || type;
  }

  listChecks(screeningId: string) {
    return this.checkRepo.find({
      where: { screeningId },
      order: { createdAt: 'ASC' },
    });
  }

  /** 现场负责人上报五项巡检内容 */
  async report(
    user: AuthUser,
    screeningId: string,
    dto: {
      type: string;
      mediaUrl?: string;
      dbValue?: number;
      qualified?: boolean;
      note?: string;
    },
  ) {
    const s = await this.screeningRepo.findOne({ where: { id: screeningId } });
    if (!s) throw new BadRequestException('场次不存在');
    if (!['ISSUED', 'SETUP', 'SCREENING'].includes(s.status)) {
      throw new BadRequestException('设备出库后方可进行现场上报');
    }

    let qualified = dto.qualified ?? true;
    // 噪声自动判定
    if (dto.type === 'NOISE' && dto.dbValue != null) {
      qualified = dto.dbValue <= NOISE_LIMIT_DB;
      if (!qualified) s.hasNoiseIssue = true;
    }

    const check = this.checkRepo.create({
      screeningId,
      type: dto.type,
      mediaUrl: dto.mediaUrl || '',
      dbValue: dto.dbValue ?? null,
      qualified,
      note: dto.note || '',
      reporterName: user.name,
    });
    await this.checkRepo.save(check);
    await this.screeningRepo.save(s);

    const detail =
      dto.type === 'NOISE' && dto.dbValue != null
        ? `实测 ${dto.dbValue} dB(A)，限值 ${NOISE_LIMIT_DB}，${qualified ? '达标' : '超标'}`
        : dto.note || (qualified ? '达标' : '不达标');

    await this.timeline.log({
      screeningId,
      phase: 'SETUP',
      title: `现场巡检：${this.label(dto.type)}${qualified ? '✓' : '✗'}`,
      detail,
      actorName: user.name,
      actorRole: user.role,
    });
    return check;
  }

  /** 五项巡检齐备且达标，确认搭建完成进入放映 */
  async completeSetup(user: AuthUser, screeningId: string) {
    const s = await this.screeningRepo.findOne({ where: { id: screeningId } });
    if (!s) throw new BadRequestException('场次不存在');
    if (s.status !== 'ISSUED' && s.status !== 'SETUP') {
      throw new BadRequestException('当前状态不能确认搭建');
    }
    const checks = await this.checkRepo.find({ where: { screeningId } });
    // 每类巡检以最新一次上报为准（支持整改后复测覆盖）
    const latestByType = new Map<string, OnsiteCheck>();
    for (const c of checks) {
      const prev = latestByType.get(c.type);
      if (!prev || c.createdAt > prev.createdAt) latestByType.set(c.type, c);
    }
    const required = ['SETUP_PHOTO', 'TEST_PLAY', 'NOISE', 'AUDIENCE_ISOLATION', 'FIRE_LANE'];
    const missing = required.filter((t) => !latestByType.has(t));
    if (missing.length) {
      throw new BadRequestException(
        `巡检项未完成：${missing.map((m) => this.label(m)).join('、')}`,
      );
    }
    const unqualified = [...latestByType.values()].filter((c) => !c.qualified);
    if (unqualified.length) {
      throw new BadRequestException(
        `存在不达标项：${unqualified.map((c) => this.label(c.type)).join('、')}，请先整改或发起异常处理`,
      );
    }
    await this.timeline.transition({
      screening: s,
      toStatus: ScreeningStatus.SCREENING,
      phase: 'SCREEN',
      title: '搭建验收通过，放映开始',
      detail: '搭建照片、试播、噪声、观众隔离、消防通道五项巡检达标',
      actorName: user.name,
      actorRole: user.role,
    });
    return this.screeningRepo.findOne({ where: { id: screeningId } });
  }

  async finish(user: AuthUser, screeningId: string, note: string) {
    const s = await this.screeningRepo.findOne({ where: { id: screeningId } });
    if (!s) throw new BadRequestException('场次不存在');
    if (s.status !== ScreeningStatus.SCREENING) {
      throw new BadRequestException('仅放映中的场次可以结束');
    }
    await this.timeline.transition({
      screening: s,
      toStatus: ScreeningStatus.FINISHED,
      phase: 'SCREEN',
      title: '放映结束',
      detail: note || '',
      actorName: user.name,
      actorRole: user.role,
    });
    return this.screeningRepo.findOne({ where: { id: screeningId } });
  }

  // ---- 志愿者签到 ----
  listVolunteers(screeningId: string) {
    return this.volunteerRepo.find({
      where: { screeningId },
      order: { checkinAt: 'ASC' },
    });
  }

  async checkin(user: AuthUser, screeningId: string, dto: {
    name: string;
    phone: string;
    post: string;
  }) {
    const v = this.volunteerRepo.create({
      screeningId,
      name: dto.name,
      phone: dto.phone,
      post: dto.post,
      checkinAt: new Date(),
    });
    await this.volunteerRepo.save(v);
    await this.timeline.log({
      screeningId,
      phase: 'VOLUNTEER',
      title: `志愿者签到：${dto.name}（${dto.post}）`,
      actorName: user.name,
      actorRole: user.role,
    });
    return v;
  }

  async checkout(user: AuthUser, id: string) {
    const v = await this.volunteerRepo.findOne({ where: { id } });
    if (!v) throw new BadRequestException('签到记录不存在');
    v.checkedOut = true;
    v.checkoutAt = new Date();
    await this.volunteerRepo.save(v);
    await this.timeline.log({
      screeningId: v.screeningId,
      phase: 'VOLUNTEER',
      title: `志愿者签退：${v.name}`,
      actorName: user.name,
      actorRole: user.role,
    });
    return v;
  }
}

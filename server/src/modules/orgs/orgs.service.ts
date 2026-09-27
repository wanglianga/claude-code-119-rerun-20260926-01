import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreditRecord,
  Organization,
  Screening,
  User,
  UserRole,
  Venue,
  VenueBlacklistRecord,
} from '../../entities';
import { AuthUser } from '../auth/current-user.decorator';
import { TimelineService } from '../timeline/timeline.service';

/** 连续出现噪声或设备损坏达到阈值，自动建议场地拉黑 */
const AUTO_BLACKLIST_THRESHOLD = 3;

@Injectable()
export class OrgsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(CreditRecord)
    private readonly creditRepo: Repository<CreditRecord>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    @InjectRepository(VenueBlacklistRecord)
    private readonly blacklistRepo: Repository<VenueBlacklistRecord>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Screening)
    private readonly screeningRepo: Repository<Screening>,
    private readonly timeline: TimelineService,
  ) {}

  listOrgs() {
    return this.orgRepo.find({ order: { creditScore: 'ASC' } });
  }

  creditRecords(orgId?: string) {
    return this.creditRepo.find({
      where: orgId ? { orgId } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  listVenues() {
    return this.venueRepo.find({ order: { createdAt: 'DESC' } });
  }

  createVenue(dto: {
    name: string;
    address: string;
    capacity: number;
    lng?: number;
    lat?: number;
  }) {
    const v = this.venueRepo.create({
      name: dto.name,
      address: dto.address,
      capacity: dto.capacity,
      lng: dto.lng ?? null,
      lat: dto.lat ?? null,
    });
    return this.venueRepo.save(v);
  }

  /** 街道加入/移出场地黑名单；存在进行中场次时记录到其时间线 */
  async setBlacklist(
    user: AuthUser,
    venueId: string,
    blacklisted: boolean,
    reason: string,
  ) {
    const venue = await this.venueRepo.findOne({ where: { id: venueId } });
    if (!venue) throw new BadRequestException('场地不存在');
    if (blacklisted && !reason) {
      throw new BadRequestException('加入黑名单必须填写原因');
    }
    venue.blacklisted = blacklisted;
    venue.blacklistReason = blacklisted ? reason : '';
    venue.blacklistedAt = blacklisted ? new Date() : null;
    await this.venueRepo.save(venue);
    await this.blacklistRepo.save(
      this.blacklistRepo.create({
        venueId,
        action: blacklisted ? 'ADD' : 'REMOVE',
        reason: reason || '',
        operatorName: user.name,
      }),
    );
    // 该场地未结算的场次时间线同步提示
    const active = await this.screeningRepo.find({
      where: { venueId },
      order: { createdAt: 'DESC' },
      take: 5,
    });
    for (const s of active) {
      if (blacklisted) {
        await this.timeline.log({
          screeningId: s.id,
          phase: 'VENUE',
          title: `场地被列入黑名单：${reason}`,
          actorName: user.name,
          actorRole: user.role,
        });
      }
    }
    return venue;
  }

  blacklistHistory(venueId?: string) {
    return this.blacklistRepo.find({
      where: venueId ? { venueId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  /** 可选现场负责人列表 */
  onsiteManagers() {
    return this.userRepo.find({
      where: { role: UserRole.ONSITE },
      select: ['id', 'name', 'phone'],
    });
  }

  /**
   * 街道文体岗看板：按活动时间线追踪 + 风险点位 + 信用预警
   * 连续出现噪声/设备损坏的点位影响下一轮审批。
   */
  async dashboard() {
    const venues = await this.venueRepo.find();
    const riskVenues = venues
      .map((v) => {
        const riskScore = v.noiseCount * 2 + v.damageCount * 3;
        return {
          id: v.id,
          name: v.name,
          address: v.address,
          blacklisted: v.blacklisted,
          blacklistReason: v.blacklistReason,
          screeningCount: v.screeningCount,
          noiseCount: v.noiseCount,
          damageCount: v.damageCount,
          riskScore,
          suggestBlacklist:
            !v.blacklisted &&
            (v.noiseCount >= AUTO_BLACKLIST_THRESHOLD ||
              v.damageCount >= AUTO_BLACKLIST_THRESHOLD),
        };
      })
      .filter((v) => v.riskScore > 0 || v.blacklisted)
      .sort((a, b) => b.riskScore - a.riskScore);

    const orgs = await this.orgRepo.find();
    const lowCreditOrgs = orgs
      .filter((o) => o.creditScore < 80)
      .map((o) => ({
        id: o.id,
        name: o.name,
        type: o.type,
        creditScore: o.creditScore,
        canApply: o.creditScore >= 60,
      }));

    const statusCounts: Record<string, number> = {};
    const all = await this.screeningRepo.find({
      relations: { venue: true, org: true },
      order: { screeningDate: 'DESC' },
      take: 50,
    });
    for (const s of all) statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;

    return {
      statusCounts,
      recentScreenings: all,
      riskVenues,
      lowCreditOrgs,
      blacklistThreshold: AUTO_BLACKLIST_THRESHOLD,
    };
  }
}

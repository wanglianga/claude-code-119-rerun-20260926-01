import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ScreeningSession, TimelineEvent, Venue, Organization, Incident, Equipment,
} from '../entities';
import { AuthGuard } from '../auth/auth.guard';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(
    @InjectRepository(ScreeningSession) private readonly sessions: Repository<ScreeningSession>,
    @InjectRepository(TimelineEvent) private readonly events: Repository<TimelineEvent>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    @InjectRepository(Equipment) private readonly equipment: Repository<Equipment>,
  ) {}

  // 街道文体岗总览：状态分布 + 风险点位 + 低信用主办方 + 设备概况
  @Get('overview')
  async overview() {
    const [sessions, venues, orgs, allEquip] = await Promise.all([
      this.sessions.find({ relations: { organization: true, venue: true } }),
      this.venues.find(),
      this.orgs.find(),
      this.equipment.find(),
    ]);
    const statusCount: Record<string, number> = {};
    for (const s of sessions) statusCount[s.status] = (statusCount[s.status] || 0) + 1;

    return {
      sessionTotal: sessions.length,
      statusCount,
      openIncidentCount: await this.incidents.count({ where: [{ status: 'OPEN' }, { status: 'PROCESSING' }] }),
      riskVenues: venues
        .filter(v => v.noiseEventCount >= 2 || v.damageEventCount >= 2 || v.blacklisted)
        .map(v => ({
          id: v.id, name: v.name, blacklisted: v.blacklisted,
          noiseEventCount: v.noiseEventCount, damageEventCount: v.damageEventCount, blacklistReason: v.blacklistReason,
        })),
      lowCreditOrgs: orgs
        .filter(o => o.creditScore < 80 || o.status === 'SUSPENDED')
        .map(o => ({ id: o.id, name: o.name, creditScore: o.creditScore, status: o.status, suspendReason: o.suspendReason })),
      equipment: {
        total: allEquip.length,
        idle: allEquip.filter(e => e.status === 'IDLE').length,
        reserved: allEquip.filter(e => e.status === 'RESERVED').length,
        inUse: allEquip.filter(e => e.status === 'IN_USE').length,
        damaged: allEquip.filter(e => e.status === 'DAMAGED' || e.status === 'LOST').length,
      },
    };
  }

  // 全街道活动时间线：申请→审批→出库→搭建→放映→投诉→核销
  @Get('timeline')
  timeline() {
    return this.events.find({
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([
    ScreeningSession, TimelineEvent, Venue, Organization, Incident, Equipment,
  ])],
  controllers: [DashboardController],
})
export class DashboardModule {}

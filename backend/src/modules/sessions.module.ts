import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Body, Controller, Get, Param, Post, Query, Req, UseGuards, BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  ScreeningSession, SessionEquipment, Equipment, Organization, Venue,
  FinanceRecord, CreditRecord, TimelineEvent, Incident, Volunteer, EquipStatus, SessionStatus,
} from '../entities';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { TimelineService } from './timeline.service';
import {
  CreateSessionDto, ReviewDto, PrepareDto, ScanDto, InspectionDto,
  FinishDto, ReturnDto, SettleDto,
} from './sessions.dto';

const NOISE_LIMIT_DB = 55; // 夜间户外噪声边界（分贝），巡检实测高于此值记为超标

@Controller('sessions')
@UseGuards(AuthGuard)
export class SessionsController {
  constructor(
    @InjectRepository(ScreeningSession) private readonly sessions: Repository<ScreeningSession>,
    @InjectRepository(SessionEquipment) private readonly kit: Repository<SessionEquipment>,
    @InjectRepository(Equipment) private readonly equipment: Repository<Equipment>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(FinanceRecord) private readonly finance: Repository<FinanceRecord>,
    @InjectRepository(CreditRecord) private readonly credits: Repository<CreditRecord>,
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    private readonly timeline: TimelineService,
    private readonly ds: DataSource,
  ) {}

  private staffRoles = new Set(['CULTURE_REVIEWER', 'WAREHOUSE', 'FIELD_LEADER', 'SECURITY', 'FINANCE', 'STREET_ADMIN']);

  // ---------------- 申请 ----------------
  @Post()
  async create(@Body() dto: CreateSessionDto, @Req() req: any) {
    const orgId = req.user.organizationId || dto.organizationId;
    const org = await this.orgs.findOneByOrFail({ id: orgId });
    if (org.status === 'SUSPENDED') {
      throw new ForbiddenException(`主办方「${org.name}」信用分过低已被暂停申请资格（${org.creditScore}分），请联系街道恢复`);
    }
    const venue = await this.venues.findOneByOrFail({ id: dto.venueId });
    if (venue.blacklisted) {
      throw new ForbiddenException(`场地「${venue.name}」已列入黑名单：${venue.blacklistReason || '原因未填'}，不能安排夜间活动`);
    }
    const count = await this.sessions.count();
    const d = new Date(dto.screeningDate);
    const code = `SS-${d.toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(3, '0')}`;

    const s = this.sessions.create({
      ...dto, organizationId: orgId, code,
      applicantUserId: req.user.sub,
      status: 'PENDING_REVIEW',
    });
    await this.sessions.save(s);
    await this.timeline.log(s.id, 'APPLIED', '提交放映申请',
      `${org.name} 申请在 ${venue.name} 放映《${dto.title}》`, { id: req.user.sub, name: req.user.name });
    return this.detail(s.id, req);
  }

  // ---------------- 列表 ----------------
  @Get()
  async list(
    @Req() req: any,
    @Query('status') status?: SessionStatus,
    @Query('organizationId') organizationId?: string,
    @Query('venueId') venueId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const qb = this.sessions.createQueryBuilder('s')
      .leftJoinAndSelect('s.organization', 'org')
      .leftJoinAndSelect('s.venue', 'v')
      .orderBy('s.screeningDate', 'DESC');
    if (!this.staffRoles.has(req.user.role)) {
      qb.andWhere('org.id = :oid', { oid: req.user.organizationId });
    } else if (organizationId) {
      qb.andWhere('s.organization_id = :organizationId', { organizationId });
    }
    if (status) qb.andWhere('s.status = :status', { status });
    if (venueId) qb.andWhere('s.venue_id = :venueId', { venueId });
    if (from) qb.andWhere('s.screening_date >= :from', { from });
    if (to) qb.andWhere('s.screening_date <= :to', { to: new Date(to + 'T23:59:59') });
    return qb.getMany();
  }

  // ---------------- 详情（同一场放映聚合所有数据） ----------------
  @Get(':id')
  async detail(@Param('id') id: string, @Req() req?: any) {
    const s = await this.sessions.findOne({
      where: { id },
      relations: { organization: true, venue: true },
    });
    if (!s) throw new NotFoundException('场次不存在');
    if (req && !this.staffRoles.has(req.user.role) && s.organizationId !== req.user.organizationId) {
      throw new ForbiddenException('只能查看本主办方的场次');
    }
    const [kitItems, inc, vols, fin, tl] = await Promise.all([
      this.kit.find({ where: { sessionId: id }, relations: { equipment: true }, order: { createdAt: 'ASC' } }),
      this.incidents.find({ where: { sessionId: id }, relations: { messages: true }, order: { createdAt: 'ASC' } }),
      this.ds.getRepository(Volunteer).find({ where: { sessionId: id }, order: { createdAt: 'ASC' } }),
      this.finance.find({ where: { sessionId: id }, order: { createdAt: 'ASC' } }),
      this.ds.getRepository(TimelineEvent).find({ where: { sessionId: id }, order: { createdAt: 'ASC' } }),
    ]);
    return { ...s, kitItems: kitItems, incidents: inc, volunteers: vols, financeRecords: fin, timeline: tl };
  }

  // ---------------- 文化审核：影片授权 + 公共活动备案 ----------------
  @Roles('CULTURE_REVIEWER', 'STREET_ADMIN')
  @Post(':id/review')
  async review(@Param('id') id: string, @Body() dto: ReviewDto, @Req() req: any, @Query('confirmRisk') confirmRisk?: string) {
    const s = await this.sessions.findOne({ where: { id }, relations: { venue: true, organization: true } });
    if (!s || s.status !== 'PENDING_REVIEW') throw new BadRequestException('当前状态不能审核');
    if (!dto.approved) {
      s.status = 'REJECTED';
      s.reviewComment = dto.comment || '材料不齐全';
    } else {
      const risk = s.venue.noiseEventCount >= 2 || s.venue.damageEventCount >= 2;
      if (risk && confirmRisk !== 'true') {
        throw new BadRequestException(`RISK:该点位历史噪声${s.venue.noiseEventCount}次/设备损坏${s.venue.damageEventCount}次，属于高风险点位，需勾选“已知悉风险仍批准”`);
      }
      if (!dto.copyrightAuthNo) throw new BadRequestException('请填写影片授权确认编号');
      if (!dto.filingNo) throw new BadRequestException('请填写公共活动备案号');
      Object.assign(s, {
        status: 'APPROVED',
        copyrightAuthNo: dto.copyrightAuthNo,
        filingNo: dto.filingNo,
        reviewComment: dto.comment || '审核通过：影片授权与活动备案均已确认',
        fieldLeaderId: dto.fieldLeaderId || s.fieldLeaderId,
      });
    }
    s.reviewerId = req.user.sub;
    s.reviewedAt = new Date();
    await this.sessions.save(s);
    await this.timeline.log(id, dto.approved ? 'REVIEW_APPROVED' : 'REVIEW_REJECTED',
      dto.approved ? '文化审核通过' : '审核驳回',
      dto.approved ? `授权号 ${dto.copyrightAuthNo} / 备案号 ${dto.filingNo}` : (dto.comment || ''),
      { id: req.user.sub, name: req.user.name });
    return this.detail(id);
  }

  // 驳回后申请方修改重提
  @Post(':id/resubmit')
  async resubmit(@Param('id') id: string, @Body() dto: Partial<CreateSessionDto>, @Req() req: any) {
    const s = await this.sessions.findOneByOrFail({ id });
    if (s.status !== 'REJECTED') throw new BadRequestException('只有被驳回的场次可以修改重提');
    if (!this.staffRoles.has(req.user.role) && s.organizationId !== req.user.organizationId) throw new ForbiddenException();
    Object.assign(s, dto, { status: 'PENDING_REVIEW' as SessionStatus });
    await this.sessions.save(s);
    await this.timeline.log(id, 'RESUBMITTED', '修改材料后重新提交', null, { id: req.user.sub, name: req.user.name });
    return this.detail(id, req);
  }

  // ---------------- 仓库按场次备料 ----------------
  @Roles('WAREHOUSE')
  @Post(':id/prepare')
  async prepare(@Param('id') id: string, @Body() dto: PrepareDto, @Req() req: any) {
    const s = await this.sessions.findOneByOrFail({ id });
    if (s.status !== 'APPROVED') throw new BadRequestException('只有审核通过的场次才能备料');
    if (!dto.equipmentIds?.length) throw new BadRequestException('请至少选择一件设备');
    const equips = await this.equipment.find({ where: { id: In(dto.equipmentIds) } });
    const busy = equips.filter(e => e.status !== 'IDLE');
    if (busy.length) throw new BadRequestException(`设备已被占用：${busy.map(e => `${e.name}(${e.qrCode})`).join('、')}`);
    const required: Record<string, string> = {
      PROJECTOR: '投影机', SCREEN: '幕布', SPEAKER: '音箱', CABLE: '电缆', RAIN_COVER: '防雨罩',
    };
    const cats = new Set(equips.map(e => e.category));
    const missing = Object.entries(required).filter(([c]) => !cats.has(c as any)).map(([, n]) => n);
    if (missing.length) throw new BadRequestException(`成套设备缺少必备项：${missing.join('、')}（另需按银幕尺寸/音响数量配齐）`);

    for (const e of equips) {
      e.status = 'RESERVED' as EquipStatus;
      await this.equipment.save(e);
      await this.kit.save(this.kit.create({ sessionId: id, equipmentId: e.id, state: 'PREPARED' }));
    }
    Object.assign(s, { status: 'KIT_READY' as SessionStatus, preparedBy: req.user.sub, preparedAt: new Date() });
    await this.sessions.save(s);
    await this.timeline.log(id, 'KIT_PREPARED', '仓库成套备料完成',
      `共 ${equips.length} 件：${equips.map(e => e.name).join('、')}，待现场扫码领取`, { id: req.user.sub, name: req.user.name });
    return this.detail(id);
  }

  // ---------------- 领取扫码核对成套状态 ----------------
  @Roles('WAREHOUSE', 'FIELD_LEADER')
  @Post(':id/scan')
  async scan(@Param('id') id: string, @Body() dto: ScanDto, @Req() req: any) {
    const s = await this.sessions.findOneByOrFail({ id });
    if (!['KIT_READY', 'IN_PROGRESS'].includes(s.status)) throw new BadRequestException('当前状态不能扫码领取');
    const equip = await this.equipment.findOne({ where: { qrCode: dto.qrCode } });
    if (!equip) throw new NotFoundException('二维码不属于任何在册设备');
    const item = await this.kit.findOne({ where: { sessionId: id, equipmentId: equip.id } });
    if (!item) throw new BadRequestException(`设备 ${equip.name} 不在本场次成套清单内，防止错拿`);
    if (item.state === 'PREPARED') {
      item.state = 'PICKED_UP';
      item.scannedAt = new Date();
      await this.kit.save(item);
      equip.status = 'IN_USE' as EquipStatus;
      await this.equipment.save(equip);
      if (!s.pickedUpAt) s.pickedUpAt = new Date();
      await this.timeline.log(id, 'SCAN_PICKUP', `扫码领取：${equip.name}`, `二维码 ${dto.qrCode}`, { id: req.user.sub, name: req.user.name });
    }
    const remain = await this.kit.count({ where: { sessionId: id, state: 'PREPARED' } });
    if (remain === 0 && s.status === 'KIT_READY') {
      s.status = 'IN_PROGRESS';
      s.qrVerified = true;
      await this.timeline.log(id, 'KIT_VERIFIED', '成套设备扫码核对完成', `全部 ${await this.kit.count({ where: { sessionId: id } })} 件核对一致，准予入场搭建`, { name: req.user.name });
    }
    await this.sessions.save(s);
    return this.detail(id, req);
  }

  // ---------------- 当天现场巡检（五项） ----------------
  @Roles('FIELD_LEADER')
  @Post(':id/inspection')
  async inspection(@Param('id') id: string, @Body() dto: InspectionDto, @Req() req: any) {
    const s = await this.sessions.findOneByOrFail({ id });
    if (s.status !== 'IN_PROGRESS') throw new BadRequestException('设备成套领取完成后才能填报当天巡检');
    if (!s.qrVerified) throw new BadRequestException('请先完成设备扫码成套核对');
    Object.assign(s, {
      setupPhoto: dto.setupPhoto,
      testPlayScreenshot: dto.testPlayScreenshot,
      noiseDb: dto.noiseDb,
      noiseOverLimit: dto.noiseDb > NOISE_LIMIT_DB,
      isolationDesc: dto.isolationDesc,
      fireLaneDesc: dto.fireLaneDesc,
      inspectionRemark: dto.remark || null,
      inspectedBy: req.user.sub,
      inspectedAt: new Date(),
    });
    await this.sessions.save(s);
    await this.timeline.log(id, 'INSPECTION', '完成放映当天现场巡检',
      `噪声实测 ${dto.noiseDb}dB${s.noiseOverLimit ? '（超标！）' : '（达标）'}；搭建照片/试播截图/观众隔离/消防通道已上传`,
      { id: req.user.sub, name: req.user.name });
    return this.detail(id, req);
  }

  // ---------------- 放映结束 ----------------
  @Roles('FIELD_LEADER')
  @Post(':id/finish')
  async finish(@Param('id') id: string, @Body() dto: FinishDto, @Req() req: any) {
    const s = await this.sessions.findOneByOrFail({ id });
    if (s.status !== 'IN_PROGRESS') throw new BadRequestException('当前状态不能结束放映');
    s.status = 'PENDING_RETURN';
    s.finishedAt = new Date();
    s.actualAudience = dto.actualAudience;
    await this.sessions.save(s);
    const over = dto.actualAudience > (await this.venues.findOneByOrFail({ id: s.venueId })).maxAudience;
    await this.timeline.log(id, 'FINISHED', '放映结束', `实际观众 ${dto.actualAudience} 人${over ? '（超场地容量！）' : ''}，待归还设备`, { id: req.user.sub, name: req.user.name });
    return this.detail(id, req);
  }

  // ---------------- 仓库验收入库 / 损坏赔付 ----------------
  @Roles('WAREHOUSE')
  @Post(':id/return')
  async returnEquipment(@Param('id') id: string, @Body() dto: ReturnDto, @Req() req: any) {
    const s = await this.sessions.findOne({ where: { id }, relations: { organization: true } });
    if (!s) throw new NotFoundException('场次不存在');
    if (s.status !== 'PENDING_RETURN') throw new BadRequestException('放映结束后才能办理归还');
    let total = 0;
    for (const it of dto.items) {
      const item = await this.kit.findOne({ where: { sessionId: id, equipmentId: it.equipmentId }, relations: { equipment: true } });
      if (!item) throw new BadRequestException('归还清单中存在不属于本场次的设备');
      item.state = it.state;
      item.note = it.note || null;
      item.returnedAt = new Date();
      const st: EquipStatus = it.state === 'RETURNED' ? 'IDLE' : (it.state as any);
      item.equipment.status = st;
      await this.equipment.save(item.equipment);
      if (it.state !== 'RETURNED') {
        const comp = it.compensation ?? (it.state === 'LOST' ? item.equipment.value : Math.round(item.equipment.value * 0.4));
        item.compensation = comp;
        total += comp;
      }
      await this.kit.save(item);
    }
    // 未上报的设备视为已完好归还
    const rest = await this.kit.find({ where: { sessionId: id, state: 'PICKED_UP' }, relations: { equipment: true } });
    for (const item of rest) {
      item.state = 'RETURNED';
      item.returnedAt = new Date();
      item.equipment.status = 'IDLE';
      await Promise.all([this.kit.save(item), this.equipment.save(item.equipment)]);
    }
    s.compensationTotal = +(s.compensationTotal + total).toFixed(2);
    s.status = 'COMPLETED';
    s.returnedAt = new Date();
    s.returnReceivedBy = req.user.sub;
    await this.sessions.save(s);

    if (total > 0) {
      // 优先从押金扣除
      const deduct = Math.min(total, s.organization.depositBalance);
      s.organization.depositBalance = +(s.organization.depositBalance - deduct).toFixed(2);
      await this.orgs.save(s.organization);
      await this.finance.save(this.finance.create({
        sessionId: id, organizationId: s.organizationId, type: 'COMPENSATION', amount: total,
        status: deduct === total ? 'CONFIRMED' : 'PENDING',
        remark: `设备损坏/遗失赔付，押金抵扣 ${deduct} 元${deduct < total ? `，尚欠 ${+(total - deduct).toFixed(2)} 元` : ''}`,
        operatorUserId: req.user.sub,
      }));
    }
    await this.timeline.log(id, 'RETURNED', '设备归还验收完成',
      total ? `共 ${dto.items.filter(i => i.state !== 'RETURNED').length} 件损坏/遗失，赔付合计 ${total} 元` : '全部设备完好入库',
      { id: req.user.sub, name: req.user.name });
    return this.detail(id, req);
  }

  // ---------------- 财务核销：补贴 + 版权核销 + 信用结算 ----------------
  @Roles('FINANCE', 'STREET_ADMIN')
  @Post(':id/settle')
  async settle(@Param('id') id: string, @Body() dto: SettleDto, @Req() req: any) {
    const s = await this.sessions.findOne({ where: { id }, relations: { organization: true, venue: true } });
    if (!s) throw new NotFoundException('场次不存在');
    if (s.status !== 'COMPLETED') throw new BadRequestException('设备归还完成后才能核销');
    const openInc = await this.incidents.count({ where: { sessionId: id, status: In(['OPEN', 'PROCESSING']) } });
    if (openInc > 0) throw new BadRequestException(`仍有 ${openInc} 起异常事件未关闭，请先处理完投诉/突发情况`);

    s.subsidyAmount = dto.subsidyAmount;
    s.copyrightWriteoff = dto.copyrightWriteoff;
    s.settleRemark = dto.remark || null;
    s.settledBy = req.user.sub;
    s.settledAt = new Date();
    s.status = 'SETTLED';
    await this.sessions.save(s);

    if (dto.subsidyAmount > 0) {
      await this.finance.save(this.finance.create({
        sessionId: id, organizationId: s.organizationId, type: 'SUBSIDY',
        amount: dto.subsidyAmount, status: 'PAID', remark: '夜间文化活动补贴发放', operatorUserId: req.user.sub,
      }));
    }

    // ---- 信用结算 ----
    const incs = await this.incidents.find({ where: { sessionId: id } });
    const deltas: { delta: number; reason: string }[] = [];
    if (s.noiseOverLimit) deltas.push({ delta: -10, reason: '巡检噪声超标' });
    for (const inc of incs) {
      switch (inc.type) {
        case 'NOISE_COMPLAINT': deltas.push({ delta: -5, reason: '发生居民噪声投诉' }); break;
        case 'OVERCROWD': deltas.push({ delta: -10, reason: '观众超员' }); break;
        case 'EQUIPMENT_MISSING': deltas.push({ delta: -5, reason: '设备缺件' }); break;
        case 'FILE_CORRUPT': deltas.push({ delta: -5, reason: '影片文件损坏' }); break;
        case 'POWER_TRIP': deltas.push({ delta: -5, reason: '供电跳闸' }); break;
      }
    }
    if ((s.compensationTotal || 0) > 0) deltas.push({ delta: -10, reason: '设备损坏/遗失赔付' });
    if (deltas.length === 0) deltas.push({ delta: 2, reason: '场次零异常顺利完成' });

    let balance = s.organization.creditScore;
    for (const d of deltas) {
      balance = Math.max(0, Math.min(100, balance + d.delta));
      await this.credits.save(this.credits.create({
        organizationId: s.organizationId, sessionId: id, delta: d.delta, reason: d.reason, balanceAfter: balance,
      }));
    }
    s.organization.creditScore = balance;
    if (balance < 60 && s.organization.status === 'ACTIVE') {
      s.organization.status = 'SUSPENDED';
      s.organization.suspendReason = `信用分 ${balance} 低于 60，系统自动暂停申请资格`;
    }
    await this.orgs.save(s.organization);

    // ---- 点位风险累计，影响下一轮审批 ----
    if (s.noiseOverLimit) s.venue.noiseEventCount += 1;
    if ((s.compensationTotal || 0) > 0) s.venue.damageEventCount += 1;
    if (s.venue.noiseEventCount >= 3 && !s.venue.blacklisted) {
      s.venue.blacklisted = true;
      s.venue.blacklistReason = `累计 ${s.venue.noiseEventCount} 次噪声超标，系统自动拉黑`;
      s.venue.blacklistSource = '系统自动（核销规则）';
      s.venue.blacklistedAt = new Date();
    }
    await this.venues.save(s.venue);

    await this.timeline.log(id, 'SETTLED', '财务核销完成',
      `补贴发放 ${dto.subsidyAmount} 元；版权凭证${dto.copyrightWriteoff ? '已核销' : '未核销'}；信用结算后 ${s.organization.name} 信用分 ${balance}`,
      { id: req.user.sub, name: req.user.name });
    return this.detail(id, req);
  }

  // ---------------- 取消（释放预留设备） ----------------
  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Req() req: any) {
    const s = await this.sessions.findOneByOrFail({ id });
    if (!['PENDING_REVIEW', 'REJECTED', 'APPROVED'].includes(s.status)) throw new BadRequestException('已备料/出库的场次不能直接取消，请走异常流程');
    if (!this.staffRoles.has(req.user.role) && s.organizationId !== req.user.organizationId) throw new ForbiddenException();
    const items = await this.kit.find({ where: { sessionId: id }, relations: { equipment: true } });
    for (const it of items.filter(i => i.state === 'PREPARED')) {
      it.equipment.status = 'IDLE';
      await this.equipment.save(it.equipment);
    }
    s.status = 'CANCELLED';
    await this.sessions.save(s);
    await this.timeline.log(id, 'CANCELLED', '场次取消', null, { id: req.user.sub, name: req.user.name });
    return this.detail(id, req);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([
    ScreeningSession, SessionEquipment, Equipment, Organization, Venue,
    FinanceRecord, CreditRecord, TimelineEvent, Incident, Volunteer,
  ])],
  controllers: [SessionsController],
  providers: [TimelineService],
  exports: [TimelineService, TypeOrmModule],
})
export class SessionsModule {}

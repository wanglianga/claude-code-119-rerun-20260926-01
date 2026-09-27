import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Body, Controller, Get, Param, Post, Query, Req, UseGuards,
  BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Incident, IncidentMessage, ScreeningSession, TimelineEvent, IncidentType,
} from '../entities';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { TimelineService } from './timeline.service';

const INCIDENT_TYPE_NAME: Record<IncidentType, string> = {
  FILE_CORRUPT: '影片文件损坏',
  EQUIPMENT_MISSING: '设备缺件',
  NOISE_COMPLAINT: '居民投诉噪声',
  RAIN: '临时降雨',
  OVERCROWD: '观众超员',
  POWER_TRIP: '供电跳闸',
  EXTENSION_REQUEST: '商户要求延长活动',
};

class CreateIncidentDto {
  type: IncidentType;
  description: string;
  residentContact?: string;
}

class MessageDto { content: string; }
class CloseDto { resolution: string; }
class DecisionDto {
  decision: 'APPROVED' | 'REJECTED';
  newEndTime?: string;
  comment?: string;
}

@Controller()
@UseGuards(AuthGuard)
export class IncidentsController {
  private staffRoles = new Set(['CULTURE_REVIEWER', 'WAREHOUSE', 'FIELD_LEADER', 'SECURITY', 'FINANCE', 'STREET_ADMIN']);

  constructor(
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    @InjectRepository(IncidentMessage) private readonly messages: Repository<IncidentMessage>,
    @InjectRepository(ScreeningSession) private readonly sessions: Repository<ScreeningSession>,
    private readonly timeline: TimelineService,
  ) {}

  // 任何参与方都可就场次上报异常
  @Post('sessions/:id/incidents')
  async report(@Param('id') id: string, @Body() dto: CreateIncidentDto, @Req() req: any) {
    const s = await this.sessions.findOneByOrFail({ id });
    if (!this.staffRoles.has(req.user.role) && s.organizationId !== req.user.organizationId) throw new ForbiddenException();
    if (!dto.type || !dto.description) throw new BadRequestException('请填写异常类型与情况描述');
    const inc = this.incidents.create({
      sessionId: id,
      type: dto.type,
      description: dto.description,
      residentContact: dto.residentContact || null,
      status: 'OPEN',
      reportedBy: req.user.sub,
    });
    await this.incidents.save(inc);
    await this.messages.save(this.messages.create({
      incidentId: inc.id, senderUserId: req.user.sub, senderName: req.user.name,
      senderRole: req.user.role, content: `【上报】${dto.description}${dto.residentContact ? `（投诉人联系方式：${dto.residentContact}）` : ''}`,
    }));
    await this.timeline.log(id, 'INCIDENT_REPORTED', `异常上报：${INCIDENT_TYPE_NAME[dto.type]}`,
      dto.description, { id: req.user.sub, name: req.user.name });
    return this.incidents.findOne({ where: { id: inc.id }, relations: { messages: true } });
  }

  // 跨角色异常列表（街道/审核等看全部，申请方看自己的）
  @Get('incidents')
  async list(@Req() req: any, @Query('status') status?: string, @Query('type') type?: string) {
    const qb = this.incidents.createQueryBuilder('i')
      .leftJoinAndSelect('i.session', 's')
      .orderBy('i.created_at', 'DESC');
    if (!this.staffRoles.has(req.user.role)) {
      qb.andWhere('s.organization_id = :oid', { oid: req.user.organizationId });
    }
    if (status) qb.andWhere('i.status = :status', { status });
    if (type) qb.andWhere('i.type = :type', { type });
    return qb.getMany();
  }

  @Get('incidents/:id')
  async detail(@Param('id') id: string, @Req() req: any) {
    const inc = await this.incidents.findOne({ where: { id }, relations: { messages: true, session: true } });
    if (!inc) throw new NotFoundException('异常事件不存在');
    if (!this.staffRoles.has(req.user.role) && inc.session.organizationId !== req.user.organizationId) throw new ForbiddenException();
    return inc;
  }

  // 协同处理线程：申请方、审核员、仓库、现场负责人、安保、财务围绕同一事件沟通
  @Post('incidents/:id/messages')
  async reply(@Param('id') id: string, @Body() dto: MessageDto, @Req() req: any) {
    const inc = await this.incidents.findOne({ where: { id }, relations: { session: true } });
    if (!inc) throw new NotFoundException('异常事件不存在');
    if (inc.status === 'CLOSED') throw new BadRequestException('事件已关闭，不能继续发言');
    if (!this.staffRoles.has(req.user.role) && inc.session.organizationId !== req.user.organizationId) throw new ForbiddenException();
    if (!dto.content?.trim()) throw new BadRequestException('消息内容不能为空');
    const m = this.messages.create({
      incidentId: id, senderUserId: req.user.sub, senderName: req.user.name,
      senderRole: req.user.role, content: dto.content,
    });
    await this.messages.save(m);
    if (inc.status === 'OPEN') {
      inc.status = 'PROCESSING';
      await this.incidents.save(inc);
    }
    await this.timeline.log(inc.sessionId, 'INCIDENT_MESSAGE',
      `异常协同：${INCIDENT_TYPE_NAME[inc.type]} 新消息`, `${req.user.name}：${dto.content.slice(0, 50)}`,
      { id: req.user.sub, name: req.user.name });
    return this.messages.find({ where: { incidentId: id }, order: { createdAt: 'ASC' } });
  }

  @Roles('CULTURE_REVIEWER', 'FIELD_LEADER', 'SECURITY', 'STREET_ADMIN')
  @Post('incidents/:id/close')
  async close(@Param('id') id: string, @Body() dto: CloseDto, @Req() req: any) {
    const inc = await this.incidents.findOneByOrFail({ id });
    if (inc.status === 'CLOSED') throw new BadRequestException('事件已关闭');
    if (!dto.resolution?.trim()) throw new BadRequestException('请填写处理结果');
    inc.status = 'CLOSED';
    inc.resolution = dto.resolution;
    inc.closedBy = req.user.sub;
    inc.closedAt = new Date();
    await this.incidents.save(inc);
    await this.messages.save(this.messages.create({
      incidentId: id, senderUserId: req.user.sub, senderName: req.user.name,
      senderRole: req.user.role, content: `【关闭】处理结果：${dto.resolution}`,
    }));
    await this.timeline.log(inc.sessionId, 'INCIDENT_CLOSED',
      `异常关闭：${INCIDENT_TYPE_NAME[inc.type]}`, dto.resolution, { id: req.user.sub, name: req.user.name });
    return this.incidents.findOne({ where: { id }, relations: { messages: true } });
  }

  // 延时活动申请由审核/街道决策
  @Roles('CULTURE_REVIEWER', 'STREET_ADMIN')
  @Post('incidents/:id/decision')
  async decision(@Param('id') id: string, @Body() dto: DecisionDto, @Req() req: any) {
    const inc = await this.incidents.findOne({ where: { id }, relations: { session: true } });
    if (!inc) throw new NotFoundException('异常事件不存在');
    if (inc.type !== 'EXTENSION_REQUEST') throw new BadRequestException('只有延时申请需要审批决策');
    inc.decision = dto.decision;
    inc.decidedBy = req.user.sub;
    inc.decidedAt = new Date();
    await this.incidents.save(inc);
    if (dto.decision === 'APPROVED' && dto.newEndTime) {
      inc.session.endTime = new Date(dto.newEndTime);
      await this.sessions.save(inc.session);
    }
    await this.messages.save(this.messages.create({
      incidentId: id, senderUserId: req.user.sub, senderName: req.user.name,
      senderRole: req.user.role,
      content: `【延时审批】${dto.decision === 'APPROVED' ? '同意延长' : '不同意延长'}${dto.newEndTime ? `，结束时间调整为 ${new Date(dto.newEndTime).toLocaleString('zh-CN')}` : ''}${dto.comment ? `；${dto.comment}` : ''}`,
    }));
    await this.timeline.log(inc.sessionId, 'INCIDENT_DECISION',
      `延时申请${dto.decision === 'APPROVED' ? '获批' : '被驳回'}`, dto.comment || null,
      { id: req.user.sub, name: req.user.name });
    return this.incidents.findOne({ where: { id }, relations: { messages: true } });
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Incident, IncidentMessage, ScreeningSession, TimelineEvent])],
  controllers: [IncidentsController],
  providers: [TimelineService],
})
export class IncidentsModule {}

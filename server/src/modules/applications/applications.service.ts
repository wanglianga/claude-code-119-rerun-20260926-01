import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Like, Repository } from 'typeorm';
import {
  DepositTransaction,
  Organization,
  Screening,
  ScreeningStatus,
  TimelineEvent,
  User,
  Venue,
} from '../../entities';
import { AuthUser } from '../auth/current-user.decorator';
import { TimelineService } from '../timeline/timeline.service';
import { AssignOnsiteDto, CreateScreeningDto } from './dto';

const MIN_CREDIT_TO_APPLY = 60;
const DEFAULT_DEPOSIT = '2000.00';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Screening)
    private readonly screeningRepo: Repository<Screening>,
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(DepositTransaction)
    private readonly depositRepo: Repository<DepositTransaction>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly timeline: TimelineService,
    private readonly dataSource: DataSource,
  ) {}

  private async loadOrThrow(id: string) {
    const s = await this.screeningRepo.findOne({
      where: { id },
      relations: { venue: true, org: true },
    });
    if (!s) throw new NotFoundException('场次不存在');
    return s;
  }

  async create(user: AuthUser, dto: CreateScreeningDto) {
    if (!user.orgId) throw new BadRequestException('申请方账号未关联主办方');
    const venue = await this.venueRepo.findOne({ where: { id: dto.venueId } });
    if (!venue) throw new BadRequestException('场地不存在');
    if (venue.blacklisted) {
      throw new BadRequestException(
        `场地「${venue.name}」已列入黑名单（${venue.blacklistReason}），不能申请放映`,
      );
    }
    const org = await this.orgRepo.findOne({ where: { id: user.orgId } });
    if (!org.active) throw new BadRequestException('主办方账户已停用');
    if (org.creditScore < MIN_CREDIT_TO_APPLY) {
      throw new BadRequestException(
        `主办方信用分 ${org.creditScore} 低于申请门槛 ${MIN_CREDIT_TO_APPLY}，暂不能提交申请`,
      );
    }
    if (dto.expectedAudience > venue.capacity) {
      throw new BadRequestException(
        `预计观众 ${dto.expectedAudience} 人超出场地建议容量 ${venue.capacity} 人`,
      );
    }

    const deposit = dto.deposit || DEFAULT_DEPOSIT;
    if (Number(org.depositBalance) < Number(deposit)) {
      throw new BadRequestException(
        `押金账户余额 ${org.depositBalance} 元，不足冻结押金 ${deposit} 元，请先充值`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // 生成场次编号
      const today = new Date();
      const ymd =
        `${today.getFullYear()}` +
        `${String(today.getMonth() + 1).padStart(2, '0')}` +
        `${String(today.getDate()).padStart(2, '0')}`;
      const prefix = `OC-${ymd}-`;
      const count = await manager.count(Screening, {
        where: { code: Like(`${prefix}%`) },
      });
      const code = `${prefix}${String(count + 1).padStart(4, '0')}`;

      const screening = manager.create(Screening, {
        code,
        orgId: org.id,
        venueId: venue.id,
        screeningDate: new Date(dto.screeningDate),
        endTime: new Date(dto.endTime),
        filmTitle: dto.filmTitle,
        copyrightProof: dto.copyrightProof,
        eventRecordNo: dto.eventRecordNo || '',
        expectedAudience: dto.expectedAudience,
        powerCondition: dto.powerCondition,
        screenSize: dto.screenSize,
        speakerCount: dto.speakerCount,
        securityStaffCount: dto.securityStaffCount,
        rainPlan: dto.rainPlan,
        deposit,
        status: ScreeningStatus.SUBMITTED,
        submittedAt: new Date(),
      });
      const saved = await manager.save(screening);

      // 冻结押金
      org.depositBalance = (
        Number(org.depositBalance) - Number(deposit)
      ).toFixed(2);
      await manager.save(org);
      await manager.save(
        manager.create(DepositTransaction, {
          orgId: org.id,
          screeningId: saved.id,
          type: 'FREEZE',
          amount: deposit,
          remark: `场次 ${code} 冻结设备押金`,
          operatorName: user.name,
        }),
      );

      await manager.save(
        manager.create(TimelineEvent, {
          screeningId: saved.id,
          phase: 'SUBMIT',
          title: '放映申请已提交',
          detail: `影片《${dto.filmTitle}》｜预计观众 ${dto.expectedAudience} 人｜冻结押金 ${deposit} 元`,
          actorName: user.name,
          actorRole: user.role,
        }),
      );

      // 注意：必须用事务内 manager 查询，外部 repo 走另一连接读不到未提交数据
      return manager.findOne(Screening, {
        where: { id: saved.id },
        relations: { venue: true, org: true },
      });
    });
  }

  async list(user: AuthUser, status?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (user.role === 'APPLICANT') where.orgId = user.orgId;
    const list = await this.screeningRepo.find({
      where,
      relations: { venue: true, org: true },
      order: { screeningDate: 'DESC' },
    });
    return list;
  }

  async detail(id: string) {
    const s = await this.loadOrThrow(id);
    return s;
  }

  async cancel(user: AuthUser, id: string, reason: string) {
    const s = await this.loadOrThrow(id);
    if (user.role === 'APPLICANT' && s.orgId !== user.orgId) {
      throw new BadRequestException('只能取消本主办方的场次');
    }
    if (!['SUBMITTED', 'APPROVED'].includes(s.status)) {
      throw new BadRequestException('当前状态不能取消');
    }
    await this.dataSource.transaction(async (manager) => {
      s.status = ScreeningStatus.CANCELED;
      await manager.save(s);
      // 释放冻结押金
      if (Number(s.deposit) > 0) {
        const org = await manager.findOne(Organization, {
          where: { id: s.orgId },
        });
        org.depositBalance = (
          Number(org.depositBalance) + Number(s.deposit)
        ).toFixed(2);
        await manager.save(org);
        await manager.save(
          manager.create(DepositTransaction, {
            orgId: org.id,
            screeningId: s.id,
            type: 'RELEASE',
            amount: s.deposit,
            remark: `场次取消，押金全额释放`,
            operatorName: user.name,
          }),
        );
      }
      await manager.save(
        manager.create(TimelineEvent, {
          screeningId: s.id,
          phase: 'CANCEL',
          title: '场次已取消',
          detail: reason || '',
          actorName: user.name,
          actorRole: user.role,
        }),
      );
    });
    return this.loadOrThrow(id);
  }

  async assignOnsite(user: AuthUser, id: string, dto: AssignOnsiteDto) {
    const s = await this.loadOrThrow(id);
    const mgr = await this.userRepo.findOne({ where: { id: dto.onsiteManagerId } });
    if (!mgr || mgr.role !== 'ONSITE') {
      throw new BadRequestException('指派对象必须是现场负责人');
    }
    s.onsiteManagerId = mgr.id;
    s.onsiteManagerName = mgr.name;
    await this.screeningRepo.save(s);
    await this.timeline.log({
      screeningId: s.id,
      phase: 'ASSIGN',
      title: `指派现场负责人：${mgr.name}`,
      actorName: user.name,
      actorRole: user.role,
    });
    return this.loadOrThrow(id);
  }
}

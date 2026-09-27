import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CreditRecord,
  DepositTransaction,
  Organization,
  Screening,
  ScreeningStatus,
  TimelineEvent,
  Venue,
} from '../../entities';
import { AuthUser } from '../auth/current-user.decorator';

/**
 * 活动结束后的统一清算（回到同一场次记录）：
 * 设备损坏赔付（从冻结押金扣）、押金余款释放、
 * 版权核销、补贴发放、信用分联动、场地累计数据。
 */
@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Screening)
    private readonly screeningRepo: Repository<Screening>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(DepositTransaction)
    private readonly depositRepo: Repository<DepositTransaction>,
    @InjectRepository(CreditRecord)
    private readonly creditRepo: Repository<CreditRecord>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    private readonly dataSource: DataSource,
  ) {}

  async settle(
    user: AuthUser,
    screeningId: string,
    dto: {
      compensation: string;
      subsidy: string;
      copyrightWriteOff: boolean;
      reviewConclusion?: string;
    },
  ) {
    const s = await this.screeningRepo.findOne({
      where: { id: screeningId },
      relations: { org: true, venue: true },
    });
    if (!s) throw new BadRequestException('场次不存在');
    if (!['FINISHED', 'RETURNED'].includes(s.status)) {
      throw new BadRequestException('需放映结束且设备归还后才能核销结算');
    }
    const compensation = Number(dto.compensation || 0);
    const subsidy = Number(dto.subsidy || 0);
    if (compensation > Number(s.deposit)) {
      throw new BadRequestException(
        `赔付 ${compensation} 元超出冻结押金 ${s.deposit} 元`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const org = await manager.findOne(Organization, {
        where: { id: s.orgId },
      });
      const venue = await manager.findOne(Venue, {
        where: { id: s.venueId },
      });
      const events: TimelineEvent[] = [];

      // 1. 损坏赔付从冻结押金扣除
      if (compensation > 0) {
        s.compensation = compensation.toFixed(2);
        await manager.save(
          manager.create(DepositTransaction, {
            orgId: org.id,
            screeningId: s.id,
            type: 'DEDUCT',
            amount: compensation.toFixed(2),
            remark: '设备损坏赔付（冻结押金扣除）',
            operatorName: user.name,
          }),
        );
        events.push(
          manager.create(TimelineEvent, {
            screeningId: s.id,
            phase: 'SETTLE',
            title: `损坏赔付 ${compensation.toFixed(2)} 元`,
            detail: '从冻结设备押金中扣除',
            actorName: user.name,
            actorRole: user.role,
          }),
        );
      }

      // 2. 押金余款释放回主办方账户
      const refund = Number(s.deposit) - compensation;
      if (refund > 0) {
        org.depositBalance = (Number(org.depositBalance) + refund).toFixed(2);
        await manager.save(
          manager.create(DepositTransaction, {
            orgId: org.id,
            screeningId: s.id,
            type: 'RELEASE',
            amount: refund.toFixed(2),
            remark: '清算后押金余款退还',
            operatorName: user.name,
          }),
        );
      }

      // 3. 补贴发放（入账押金账户，可申请提现）
      if (subsidy > 0) {
        s.subsidy = subsidy.toFixed(2);
        org.depositBalance = (Number(org.depositBalance) + subsidy).toFixed(2);
        await manager.save(
          manager.create(DepositTransaction, {
            orgId: org.id,
            screeningId: s.id,
            type: 'SUBSIDY',
            amount: subsidy.toFixed(2),
            remark: '街道夜间文化活动补贴',
            operatorName: user.name,
          }),
        );
        events.push(
          manager.create(TimelineEvent, {
            screeningId: s.id,
            phase: 'SETTLE',
            title: `补贴发放 ${subsidy.toFixed(2)} 元`,
            actorName: user.name,
            actorRole: user.role,
          }),
        );
      }
      await manager.save(org);

      // 4. 版权核销
      if (dto.copyrightWriteOff) {
        s.copyrightWrittenOff = true;
        events.push(
          manager.create(TimelineEvent, {
            screeningId: s.id,
            phase: 'SETTLE',
            title: '影片版权已核销',
            detail: `版权凭证：${s.copyrightProof}`,
            actorName: user.name,
            actorRole: user.role,
          }),
        );
      }

      // 5. 信用分联动：噪声 -10/次，设备损坏 -15；正常履约 +3
      let delta = 0;
      const reasons: string[] = [];
      if (s.hasNoiseIssue) {
        delta -= 10;
        reasons.push('噪声投诉 -10');
      }
      if (s.hasDamageIssue) {
        delta -= 15;
        reasons.push('设备损坏 -15');
      }
      if (!s.hasNoiseIssue && !s.hasDamageIssue) {
        delta += 3;
        reasons.push('正常履约 +3');
      }
      org.creditScore = Math.max(0, Math.min(120, org.creditScore + delta));
      await manager.save(org);
      await manager.save(
        manager.create(CreditRecord, {
          orgId: org.id,
          screeningId: s.id,
          delta,
          reason: reasons.join('；'),
          operatorName: user.name,
        }),
      );

      // 6. 场地累计数据，供街道复盘
      venue.screeningCount += 1;
      if (s.hasDamageIssue) venue.damageCount += 1;
      s.reviewConclusion = dto.reviewConclusion || s.reviewConclusion;
      await manager.save(venue);

      s.status = ScreeningStatus.SETTLED;
      s.settledAt = new Date();
      await manager.save(s);

      events.push(
        manager.create(TimelineEvent, {
          screeningId: s.id,
          phase: 'SETTLE',
          title: '场次核销结算完成',
          detail:
            `赔付 ${compensation.toFixed(2)}｜补贴 ${subsidy.toFixed(2)}｜信用 ${delta >= 0 ? '+' : ''}${delta}｜` +
            (dto.reviewConclusion
              ? `复盘结论：${dto.reviewConclusion}`
              : '待街道复盘'),
          actorName: user.name,
          actorRole: user.role,
        }),
      );
      await manager.save(events);

      return manager.findOne(Screening, {
        where: { id: screeningId },
        relations: { org: true, venue: true },
      });
    });
  }

  // ---- 押金 ----
  async recharge(user: AuthUser, orgId: string, amount: string) {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new BadRequestException('主办方不存在');
    const amt = Number(amount);
    if (!(amt > 0)) throw new BadRequestException('充值金额必须大于0');
    return this.dataSource.transaction(async (manager) => {
      org.depositBalance = (Number(org.depositBalance) + amt).toFixed(2);
      await manager.save(org);
      await manager.save(
        manager.create(DepositTransaction, {
          orgId: org.id,
          type: 'RECHARGE',
          amount: amt.toFixed(2),
          remark: '押金账户充值',
          operatorName: user.name,
        }),
      );
      return manager.findOne(Organization, { where: { id: org.id } });
    });
  }

  depositLogs(orgId?: string) {
    return this.depositRepo.find({
      where: orgId ? { orgId } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }
}

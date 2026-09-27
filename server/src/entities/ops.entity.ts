import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 志愿者签到记录 */
@Entity('volunteer_checkins')
export class VolunteerCheckin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  screeningId: string;

  @Column({ comment: '志愿者姓名' })
  name: string;

  @Column()
  phone: string;

  @Column({ comment: '岗位：引导/秩序/后勤等' })
  post: string;

  @Column({ type: 'timestamptz', comment: '签到时间' })
  checkinAt: Date;

  @Column({ type: 'timestamptz', nullable: true, comment: '签退时间' })
  checkoutAt: Date | null;

  @Column({ default: false })
  checkedOut: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

/** 主办方信用变动记录：审批驳回、噪声、设备损坏扣分；正常履约加分 */
@Entity('credit_records')
export class CreditRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  orgId: string;

  @Column('uuid', { nullable: true })
  screeningId: string | null;

  @Column({ type: 'int', comment: '变动分值（正/负）' })
  delta: number;

  @Column()
  reason: string;

  @Column()
  operatorName: string;

  @CreateDateColumn()
  createdAt: Date;
}

/** 押金流水：充值/冻结/扣赔/退还 */
@Entity('deposit_transactions')
export class DepositTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  orgId: string;

  @Column('uuid', { nullable: true })
  screeningId: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    comment: 'RECHARGE 充值 / FREEZE 冻结 / DEDUCT 扣赔 / RELEASE 解冻退还 / SUBSIDY 补贴入账',
  })
  type: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ default: '' })
  remark: string;

  @Column()
  operatorName: string;

  @CreateDateColumn()
  createdAt: Date;
}

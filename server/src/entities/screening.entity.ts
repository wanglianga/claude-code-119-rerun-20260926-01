import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './user.entity';
import { Venue } from './venue.entity';

/**
 * 场次状态机（街道时间线追踪）：
 * DRAFT -> SUBMITTED -> AUDITING -> APPROVED -> REJECTED
 * APPROVED -> EQUIPPED（仓库成套备齐）-> ISSUED（扫码领取出库）
 * -> SETUP（搭建/试播完成）-> SCREENING（放映中）-> FINISHED
 * FINISHED -> RETURNED（设备归还）-> SETTLED（赔付/核销/补贴完成）
 * 任意阶段可 CANCELED。
 */
export enum ScreeningStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  AUDITING = 'AUDITING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EQUIPPED = 'EQUIPPED',
  ISSUED = 'ISSUED',
  SETUP = 'SETUP',
  SCREENING = 'SCREENING',
  FINISHED = 'FINISHED',
  RETURNED = 'RETURNED',
  SETTLED = 'SETTLED',
  CANCELED = 'CANCELED',
}

@Entity('screenings')
export class Screening {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true, comment: '场次编号，如 OC-20260926-0001' })
  code: string;

  @Index()
  @Column('uuid')
  orgId: string;
  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'orgId' })
  org: Organization;

  @Index()
  @Column('uuid')
  venueId: string;
  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venueId' })
  venue: Venue;

  // ---- 申请信息 ----
  @Column({ type: 'timestamptz', comment: '放映日期（开始时间）' })
  screeningDate: Date;

  @Column({ type: 'timestamptz', comment: '预计结束时间' })
  endTime: Date;

  @Column()
  filmTitle: string;

  @Column({ default: '', comment: '影片版权凭证（授权书编号/文件URL/说明）' })
  copyrightProof: string;

  @Column({ default: '', comment: '公共活动备案号' })
  eventRecordNo: string;

  @Column({ type: 'int', comment: '预计观众人数' })
  expectedAudience: number;

  @Column({ default: '', comment: '供电条件说明（市电接口/功率/发电机）' })
  powerCondition: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, comment: '银幕尺寸（英寸）' })
  screenSize: string;

  @Column({ type: 'int', comment: '音响数量' })
  speakerCount: number;

  @Column({ type: 'int', comment: '安保人员数量' })
  securityStaffCount: number;

  @Column({ type: 'text', comment: '雨天预案' })
  rainPlan: string;

  // ---- 审批 ----
  @Column({ type: 'varchar', length: 16, default: ScreeningStatus.DRAFT })
  status: ScreeningStatus;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column('uuid', { nullable: true })
  auditorId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  auditedAt: Date | null;

  @Column({ default: '', comment: '审核结论说明（授权确认+备案确认）' })
  auditRemark: string;

  @Column({ default: false, comment: '影片授权是否确认' })
  copyrightConfirmed: boolean;

  @Column({ default: false, comment: '公共活动备案是否确认' })
  recordConfirmed: boolean;

  // ---- 现场负责人 / 安保指派 ----
  @Column('uuid', { nullable: true })
  onsiteManagerId: string | null;

  @Column({ default: '', comment: '现场负责人姓名冗余' })
  onsiteManagerName: string;

  // ---- 财务结果 ----
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, comment: '押金（提交时冻结）' })
  deposit: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, comment: '损坏赔付金额' })
  compensation: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, comment: '补贴金额' })
  subsidy: string;

  @Column({ default: false, comment: '版权是否已核销' })
  copyrightWrittenOff: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  settledAt: Date | null;

  // ---- 复盘标记 ----
  @Column({ default: false, comment: '本场是否发生噪声问题' })
  hasNoiseIssue: boolean;

  @Column({ default: false, comment: '本场是否发生设备损坏' })
  hasDamageIssue: boolean;

  @Column({ default: '', comment: '街道复盘结论：是否适合继续安排夜间活动' })
  reviewConclusion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('TimelineEvent', 'screening')
  timeline: any[];

  @OneToMany('EquipmentKitItem', 'screening')
  kitItems: any[];

  @OneToMany('OnsiteCheck', 'screening')
  checks: any[];

  @OneToMany('Incident', 'screening')
  incidents: any[];
}

/** 街道按活动时间线追踪的统一事件流水 */
@Entity('timeline_events')
export class TimelineEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  screeningId: string;
  @ManyToOne('Screening', 'timeline')
  @JoinColumn({ name: 'screeningId' })
  screening: Screening;

  @Index()
  @Column({ type: 'varchar', length: 32, comment: '阶段: SUBMIT/AUDIT/EQUIP/ISSUE/SETUP/SCREEN/INCIDENT/RETURN/SETTLE 等' })
  phase: string;

  @Column({ comment: '事件标题' })
  title: string;

  @Column({ type: 'text', default: '' })
  detail: string;

  @Column({ comment: '操作人姓名' })
  actorName: string;

  @Column({ type: 'varchar', length: 16, comment: '操作人角色' })
  actorRole: string;

  @CreateDateColumn()
  createdAt: Date;
}

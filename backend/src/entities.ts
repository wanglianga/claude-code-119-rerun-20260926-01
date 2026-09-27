import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  OneToMany, ManyToOne, JoinColumn, Index,
} from 'typeorm';

// ---------- 枚举 ----------
export type UserRole =
  | 'APPLICANT'          // 申请方（社区/物业/商圈运营方）
  | 'CULTURE_REVIEWER'   // 文化审核员
  | 'WAREHOUSE'          // 仓库管理员
  | 'FIELD_LEADER'       // 现场负责人
  | 'SECURITY'           // 安保
  | 'FINANCE'            // 财务
  | 'STREET_ADMIN';      // 街道文体岗（管理员）

export type OrgType = 'COMMUNITY' | 'PROPERTY' | 'BUSINESS_DISTRICT';
export type OrgStatus = 'ACTIVE' | 'SUSPENDED';

export type EquipCategory =
  | 'PROJECTOR' | 'SCREEN' | 'SPEAKER' | 'CABLE' | 'SPARE_BULB' | 'RAIN_COVER';
export type EquipStatus = 'IDLE' | 'RESERVED' | 'IN_USE' | 'DAMAGED' | 'LOST' | 'MAINTENANCE';

export type KitItemState = 'PREPARED' | 'PICKED_UP' | 'RETURNED' | 'DAMAGED' | 'LOST';

export type SessionStatus =
  | 'PENDING_REVIEW'   // 待文化审核
  | 'REJECTED'         // 审核驳回（可修改重提）
  | 'APPROVED'         // 审核通过，待仓库备料
  | 'KIT_READY'        // 设备已成套，待扫码领取
  | 'IN_PROGRESS'      // 已领取/放映当天
  | 'PENDING_RETURN'   // 放映结束，待归还设备
  | 'COMPLETED'        // 设备归还完成，待核销
  | 'SETTLED'          // 已核销
  | 'CANCELLED';

export type IncidentType =
  | 'FILE_CORRUPT'       // 影片文件损坏
  | 'EQUIPMENT_MISSING'  // 设备缺件
  | 'NOISE_COMPLAINT'    // 居民投诉噪声
  | 'RAIN'               // 临时降雨
  | 'OVERCROWD'          // 观众超员
  | 'POWER_TRIP'         // 供电跳闸
  | 'EXTENSION_REQUEST'; // 商户要求延长活动

export type IncidentStatus = 'OPEN' | 'PROCESSING' | 'CLOSED';

// ---------- 用户 ----------
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) username: string;
  @Column({ name: 'password_hash' }) passwordHash: string;
  @Column() name: string;
  @Column({ type: 'varchar' }) role: UserRole;
  @Column({ nullable: true }) phone: string;
  @Column({ name: 'organization_id', nullable: true }) organizationId: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ---------- 活动主办方 ----------
@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'varchar' }) type: OrgType;
  @Column({ name: 'contact_name' }) contactName: string;
  @Column({ name: 'contact_phone' }) contactPhone: string;
  /** 信用分，初始 100，低于 60 暂停申请资格 */
  @Column({ name: 'credit_score', type: 'float', default: 100 }) creditScore: number;
  /** 设备押金余额 */
  @Column({ name: 'deposit_balance', type: 'float', default: 0 }) depositBalance: number;
  @Column({ type: 'varchar', default: 'ACTIVE' }) status: OrgStatus;
  @Column({ name: 'suspend_reason', nullable: true }) suspendReason: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ---------- 场地 ----------
@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column() address: string;
  @Column({ name: 'max_audience', type: 'int', default: 200 }) maxAudience: number;
  @Column({ name: 'power_condition', nullable: true }) powerCondition: string;
  @Column({ default: false }) blacklisted: boolean;
  @Column({ name: 'blacklist_reason', nullable: true }) blacklistReason: string | null;
  @Column({ name: 'blacklist_source', nullable: true }) blacklistSource: string | null;
  @Column({ name: 'blacklisted_at', type: 'timestamptz', nullable: true }) blacklistedAt: Date | null;
  /** 累计噪声超标次数（核销时累计，影响下一轮审批） */
  @Column({ name: 'noise_event_count', type: 'int', default: 0 }) noiseEventCount: number;
  /** 累计设备损坏次数 */
  @Column({ name: 'damage_event_count', type: 'int', default: 0 }) damageEventCount: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ---------- 设备台账 ----------
@Entity('equipment')
export class Equipment {
  @PrimaryGeneratedColumn('uuid') id: string;
  /** 扫码用编码（二维码内容），全局唯一 */
  @Column({ name: 'qr_code', unique: true }) qrCode: string;
  @Column() name: string;
  @Column({ type: 'varchar' }) category: EquipCategory;
  @Column({ nullable: true }) model: string;
  @Column({ type: 'varchar', default: 'IDLE' }) status: EquipStatus;
  /** 设备价值，用于赔付参考 */
  @Column({ type: 'float', default: 0 }) value: number;
  @Column({ nullable: true }) remark: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ---------- 放映场次（核心聚合根） ----------
@Entity('screening_sessions')
@Index(['screeningDate'])
export class ScreeningSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  /** 业务单号，如 SS-20260926-001 */
  @Column({ unique: true }) code: string;
  @Column() title: string;

  @Column({ name: 'organization_id' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'venue_id' }) venueId: string;
  @ManyToOne(() => Venue) @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Column({ name: 'screening_date', type: 'timestamptz' }) screeningDate: Date;
  @Column({ name: 'end_time', type: 'timestamptz', nullable: true }) endTime: Date | null;
  @Column({ name: 'expected_audience', type: 'int' }) expectedAudience: number;
  @Column({ name: 'actual_audience', type: 'int', nullable: true }) actualAudience: number | null;

  // 申请材料
  @Column({ name: 'copyright_proof' }) copyrightProof: string;        // 版权凭证文件路径
  @Column({ name: 'copyright_auth_no', nullable: true }) copyrightAuthNo: string | null;
  @Column({ name: 'power_condition' }) powerCondition: string;        // 供电条件
  @Column({ name: 'screen_size' }) screenSize: string;                // 银幕尺寸
  @Column({ name: 'speaker_count', type: 'int' }) speakerCount: number;
  @Column({ name: 'security_staff_count', type: 'int' }) securityStaffCount: number;
  @Column({ name: 'rain_plan' }) rainPlan: string;                    // 雨天预案

  // 人员
  @Column({ name: 'applicant_user_id' }) applicantUserId: string;
  @Column({ name: 'field_leader_id', nullable: true }) fieldLeaderId: string | null;

  // 状态
  @Column({ type: 'varchar', default: 'PENDING_REVIEW' }) status: SessionStatus;

  // 文化审核：影片授权 + 公共活动备案
  @Column({ name: 'reviewer_id', nullable: true }) reviewerId: string | null;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt: Date | null;
  @Column({ name: 'filing_no', nullable: true }) filingNo: string | null;
  @Column({ name: 'review_comment', nullable: true }) reviewComment: string | null;

  // 仓库备料 / 领取
  @Column({ name: 'prepared_by', nullable: true }) preparedBy: string | null;
  @Column({ name: 'prepared_at', type: 'timestamptz', nullable: true }) preparedAt: Date | null;
  @Column({ name: 'picked_up_at', type: 'timestamptz', nullable: true }) pickedUpAt: Date | null;
  @Column({ name: 'qr_verified', default: false }) qrVerified: boolean;

  // 当天巡检（五项）
  @Column({ name: 'setup_photo', nullable: true }) setupPhoto: string | null;
  @Column({ name: 'test_play_screenshot', nullable: true }) testPlayScreenshot: string | null;
  @Column({ name: 'noise_db', type: 'float', nullable: true }) noiseDb: number | null;
  @Column({ name: 'noise_over_limit', default: false }) noiseOverLimit: boolean;
  @Column({ name: 'isolation_desc', nullable: true }) isolationDesc: string | null;
  @Column({ name: 'fire_lane_desc', nullable: true }) fireLaneDesc: string | null;
  @Column({ name: 'inspection_remark', nullable: true }) inspectionRemark: string | null;
  @Column({ name: 'inspected_by', nullable: true }) inspectedBy: string | null;
  @Column({ name: 'inspected_at', type: 'timestamptz', nullable: true }) inspectedAt: Date | null;

  // 放映结束 / 归还
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true }) finishedAt: Date | null;
  @Column({ name: 'returned_at', type: 'timestamptz', nullable: true }) returnedAt: Date | null;
  @Column({ name: 'return_received_by', nullable: true }) returnReceivedBy: string | null;

  // 核销 / 赔付 / 补贴 / 版权核销
  @Column({ name: 'compensation_total', type: 'float', default: 0 }) compensationTotal: number;
  @Column({ name: 'subsidy_amount', type: 'float', default: 0 }) subsidyAmount: number;
  @Column({ name: 'copyright_writeoff', default: false }) copyrightWriteoff: boolean;
  @Column({ name: 'settled_by', nullable: true }) settledBy: string | null;
  @Column({ name: 'settled_at', type: 'timestamptz', nullable: true }) settledAt: Date | null;
  @Column({ name: 'settle_remark', nullable: true }) settleRemark: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

// ---------- 场次设备成套清单 ----------
@Entity('session_equipment')
export class SessionEquipment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'session_id' }) sessionId: string;
  @ManyToOne(() => ScreeningSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' }) session: ScreeningSession;

  @Column({ name: 'equipment_id' }) equipmentId: string;
  @ManyToOne(() => Equipment) @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column({ type: 'varchar', default: 'PREPARED' }) state: KitItemState;
  @Column({ name: 'scanned_at', type: 'timestamptz', nullable: true }) scannedAt: Date | null;
  @Column({ name: 'returned_at', type: 'timestamptz', nullable: true }) returnedAt: Date | null;
  @Column({ name: 'compensation', type: 'float', default: 0 }) compensation: number;
  @Column({ nullable: true }) note: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ---------- 异常事件（跨角色协同） ----------
@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'session_id' }) sessionId: string;
  @ManyToOne(() => ScreeningSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' }) session: ScreeningSession;

  @Column({ type: 'varchar' }) type: IncidentType;
  @Column() description: string;
  /** 投诉人联系方式（仅噪声投诉） */
  @Column({ name: 'resident_contact', nullable: true }) residentContact: string | null;

  @Column({ type: 'varchar', default: 'OPEN' }) status: IncidentStatus;
  @Column({ name: 'reported_by' }) reportedBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @Column({ name: 'resolution', nullable: true }) resolution: string | null;
  @Column({ name: 'closed_by', nullable: true }) closedBy: string | null;
  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true }) closedAt: Date | null;

  /** 延时申请的审批结果 */
  @Column({ name: 'decision', nullable: true }) decision: 'APPROVED' | 'REJECTED' | null;
  @Column({ name: 'decided_by', nullable: true }) decidedBy: string | null;
  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true }) decidedAt: Date | null;

  @OneToMany(() => IncidentMessage, m => m.incident, { cascade: true })
  messages: IncidentMessage[];
}

@Entity('incident_messages')
export class IncidentMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'incident_id' }) incidentId: string;
  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' }) incident: Incident;

  @Column({ name: 'sender_user_id' }) senderUserId: string;
  @Column({ name: 'sender_name' }) senderName: string;
  @Column({ name: 'sender_role' }) senderRole: UserRole;
  @Column() content: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ---------- 志愿者签到 ----------
@Entity('volunteers')
export class Volunteer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'session_id' }) sessionId: string;
  @ManyToOne(() => ScreeningSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' }) session: ScreeningSession;

  @Column() name: string;
  @Column() phone: string;
  @Column({ nullable: true }) task: string | null;
  @Column({ name: 'check_in_at', type: 'timestamptz', nullable: true }) checkInAt: Date | null;
  @Column({ name: 'check_out_at', type: 'timestamptz', nullable: true }) checkOutAt: Date | null;
  @Column({ name: 'registered_by' }) registeredBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ---------- 财务记录（押金/赔付/补贴/退押金） ----------
@Entity('finance_records')
export class FinanceRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'session_id', nullable: true }) sessionId: string | null;
  @ManyToOne(() => ScreeningSession) @JoinColumn({ name: 'session_id' })
  session: ScreeningSession;

  @Column({ name: 'organization_id' }) organizationId: string;
  @Column({ type: 'varchar' }) type: 'DEPOSIT' | 'COMPENSATION' | 'SUBSIDY' | 'DEPOSIT_REFUND';
  @Column({ type: 'float' }) amount: number;
  @Column({ type: 'varchar', default: 'CONFIRMED' }) status: 'PENDING' | 'CONFIRMED' | 'PAID';
  @Column({ nullable: true }) remark: string | null;
  @Column({ name: 'operator_user_id', nullable: true }) operatorUserId: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ---------- 信用变动记录 ----------
@Entity('credit_records')
export class CreditRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id' }) organizationId: string;
  @Column({ name: 'session_id', nullable: true }) sessionId: string | null;
  @Column({ type: 'int' }) delta: number;
  @Column() reason: string;
  @Column({ name: 'balance_after', type: 'int' }) balanceAfter: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ---------- 场次时间线 ----------
@Entity('timeline_events')
export class TimelineEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'session_id' }) sessionId: string;
  @ManyToOne(() => ScreeningSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' }) session: ScreeningSession;

  @Column({ name: 'event_type' }) eventType: string;
  @Column() title: string;
  @Column({ nullable: true }) detail: string | null;
  @Column({ name: 'actor_user_id', nullable: true }) actorUserId: string | null;
  @Column({ name: 'actor_name', nullable: true }) actorName: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

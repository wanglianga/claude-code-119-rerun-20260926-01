import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 现场异常类型：
 * FILE_DAMAGED 影片文件损坏 / MISSING_PART 设备缺件 /
 * NOISE_COMPLAINT 居民投诉噪声 / RAIN 临时降雨 /
 * OVERCROWD 观众超员 / POWER_TRIP 供电跳闸 / EXTENSION_REQ 商户要求延长
 */
export enum IncidentType {
  FILE_DAMAGED = 'FILE_DAMAGED',
  MISSING_PART = 'MISSING_PART',
  NOISE_COMPLAINT = 'NOISE_COMPLAINT',
  RAIN = 'RAIN',
  OVERCROWD = 'OVERCROWD',
  POWER_TRIP = 'POWER_TRIP',
  EXTENSION_REQ = 'EXTENSION_REQ',
}

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  screeningId: string;
  @ManyToOne('Screening', 'incidents')
  @JoinColumn({ name: 'screeningId' })
  screening: any;

  @Index()
  @Column({ type: 'varchar', length: 24 })
  type: IncidentType;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int', nullable: true, comment: '噪声分贝/观众人数等附加上报值' })
  metricValue: number | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'OPEN',
    comment: 'OPEN 待处理 / PROCESSING 处理中 / RESOLVED 已解决 / CLOSED 已关闭',
  })
  status: string;

  @Column({ type: 'int', default: 0, comment: '严重级别 1-3' })
  severity: number;

  @Column({ type: 'text', default: '', comment: '最终处理结果' })
  resolution: string;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column()
  reporterName: string;

  @Column({ type: 'varchar', length: 16 })
  reporterRole: string;

  @Column({ default: false, comment: '是否导致设备损坏（影响信用与复盘）' })
  causedDamage: boolean;

  @Column({ default: false, comment: '是否噪声问题' })
  causedNoise: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => IncidentMessage, (m) => m.incident)
  messages: IncidentMessage[];
}

/**
 * 异常协同消息：申请方、审核员、仓库、现场负责人、安保、财务
 * 围绕同一场放映的同一异常共同处理。
 */
@Entity('incident_messages')
export class IncidentMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  incidentId: string;
  @ManyToOne(() => Incident, (i) => i.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident: Incident;

  @Column()
  senderName: string;

  @Column({ type: 'varchar', length: 16 })
  senderRole: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}

/** 居民投诉处理记录（异常关闭后归档，供街道查看） */
@Entity('complaints')
export class Complaint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  screeningId: string;

  @Column('uuid', { nullable: true })
  incidentId: string | null;

  @Column({ comment: '投诉人/居民联系方式（可匿名）' })
  complainant: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'OPEN',
    comment: 'OPEN / PROCESSING / RESOLVED',
  })
  status: string;

  @Column({ type: 'text', default: '' })
  handleResult: string;

  @Column()
  handlerName: string;

  @CreateDateColumn()
  createdAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 设备类别：投影机、幕布、音箱、电缆、备用灯泡、防雨罩 */
export enum EquipmentCategory {
  PROJECTOR = 'PROJECTOR',
  SCREEN = 'SCREEN',
  SPEAKER = 'SPEAKER',
  CABLE = 'CABLE',
  BULB = 'BULB',
  RAIN_COVER = 'RAIN_COVER',
}

@Entity('equipment_items')
export class EquipmentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ comment: '资产条码/二维码编号，如 PJ-0001' })
  qrCode: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 16 })
  category: EquipmentCategory;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'IDLE',
    comment: 'IDLE 库存中 / RESERVED 已预占 / ISSUED 已出库 / RETURNED 已归还 / DAMAGED 损坏 / LOST 丢失',
  })
  status: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, comment: '资产价值，用于赔付参考' })
  value: string;

  @Column({ default: '', comment: '状态备注/损坏说明' })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;
}

/**
 * 场次设备成套清单：仓库按场次准备六大类设备，
 * 领取时逐项扫码核对成套状态。
 */
@Entity('equipment_kit_items')
export class EquipmentKitItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  screeningId: string;
  @ManyToOne('Screening', 'kitItems')
  @JoinColumn({ name: 'screeningId' })
  screening: any;

  @Column({ type: 'varchar', length: 16 })
  category: EquipmentCategory;

  @Column({ type: 'int', default: 1, comment: '该类需求数量' })
  requiredQty: number;

  @Column('uuid', { nullable: true, comment: '绑定的具体设备（同类多件时主件）' })
  equipmentItemId: string | null;
  @ManyToOne(() => EquipmentItem, { nullable: true })
  @JoinColumn({ name: 'equipmentItemId' })
  equipmentItem?: EquipmentItem;

  @Column({ default: '', comment: '扫码到的条码（冗余，便于核对展示）' })
  scannedCode: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'PENDING',
    comment: 'PENDING 待备 / PREPARED 已备好 / SCANNED 已扫码核对 / MISSING 缺件 / DAMAGED 损坏',
  })
  status: string;

  @Column({ default: '', comment: '缺件/损坏备注' })
  remark: string;

  @Column({ type: 'timestamptz', nullable: true })
  preparedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  scannedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

/** 出库/归还扫码流水（支持多件同类设备逐件扫码） */
@Entity('equipment_scan_logs')
export class EquipmentScanLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  screeningId: string;

  @Column('uuid')
  equipmentItemId: string;
  @ManyToOne(() => EquipmentItem)
  @JoinColumn({ name: 'equipmentItemId' })
  equipmentItem: EquipmentItem;

  @Column({ type: 'varchar', length: 16, comment: 'ISSUE 领取出库 / RETURN 归还' })
  action: string;

  @Column({ default: true, comment: '扫码核对是否通过（错件/非成套则 false）' })
  matched: boolean;

  @Column()
  operatorName: string;

  @CreateDateColumn()
  createdAt: Date;
}

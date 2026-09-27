import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ comment: '场地名称，如 阳光社区中心广场' })
  name: string;

  @Column({ comment: '详细地址' })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  lng: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  lat: number | null;

  @Column({ default: 200, comment: '建议最大观众容量' })
  capacity: number;

  @Column({ default: false, comment: '是否列入场地黑名单' })
  blacklisted: boolean;

  @Column({ default: '', comment: '黑名单原因' })
  blacklistReason: string;

  @Column({ type: 'timestamptz', nullable: true })
  blacklistedAt: Date | null;

  @Column({ default: 0, comment: '累计噪声投诉次数' })
  noiseCount: number;

  @Column({ default: 0, comment: '累计设备损坏次数' })
  damageCount: number;

  @Column({ default: 0, comment: '累计举办场次' })
  screeningCount: number;

  @CreateDateColumn()
  createdAt: Date;
}

/** 场地黑名单变动历史，便于街道复盘 */
@Entity('venue_blacklist_records')
export class VenueBlacklistRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  venueId: string;

  @Column({ type: 'varchar', length: 8, comment: 'ADD 加入 / REMOVE 移出' })
  action: string;

  @Column({ default: '' })
  reason: string;

  @Column()
  operatorName: string;

  @CreateDateColumn()
  createdAt: Date;
}

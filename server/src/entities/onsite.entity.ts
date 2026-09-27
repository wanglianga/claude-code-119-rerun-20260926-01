import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 放映当天现场巡检项 */
@Entity('onsite_checks')
export class OnsiteCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  screeningId: string;
  @ManyToOne('Screening', 'checks')
  @JoinColumn({ name: 'screeningId' })
  screening: any;

  @Column({
    type: 'varchar',
    length: 24,
    comment: 'SETUP_PHOTO 搭建照片 / TEST_PLAY 试播截图 / NOISE 噪声分贝 / AUDIENCE_ISOLATION 观众区域隔离 / FIRE_LANE 消防通道',
  })
  type: string;

  @Column({ type: 'text', default: '', comment: '照片/截图 URL 或文件名（本地用占位路径）' })
  mediaUrl: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true, comment: '噪声分贝读数' })
  dbValue: number | null;

  @Column({ default: true, comment: '是否达标' })
  qualified: boolean;

  @Column({ type: 'text', default: '', comment: '现场情况说明' })
  note: string;

  @Column()
  reporterName: string;

  @CreateDateColumn()
  createdAt: Date;
}

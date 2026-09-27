import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 平台角色：申请方、文化审核员、仓库、现场负责人、安保、财务、街道文体岗 */
export enum UserRole {
  APPLICANT = 'APPLICANT', // 社区/物业/商圈运营方
  AUDITOR = 'AUDITOR', // 文化审核员
  WAREHOUSE = 'WAREHOUSE', // 仓库管理员
  ONSITE = 'ONSITE', // 现场负责人
  SECURITY = 'SECURITY', // 安保
  FINANCE = 'FINANCE', // 财务
  STREET = 'STREET', // 街道文体岗
}

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ comment: '主办方名称' })
  name: string;

  @Column({
    type: 'varchar',
    length: 16,
    comment: '类型: community 社区 / property 物业 / business 商圈',
  })
  type: string;

  @Column({ default: 100, comment: '信用分（初始100）' })
  creditScore: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    comment: '押金账户余额',
  })
  depositBalance: string;

  @Column({ default: true, comment: '账户是否启用' })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 16 })
  role: UserRole;

  @Column({ default: '' })
  phone: string;

  @Index()
  @Column({ type: 'uuid', nullable: true, comment: '申请方账号关联的主办方' })
  orgId: string | null;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'orgId' })
  org?: Organization;

  @CreateDateColumn()
  createdAt: Date;
}

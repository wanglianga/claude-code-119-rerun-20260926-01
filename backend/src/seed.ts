import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  User, Organization, Venue, Equipment, ScreeningSession, SessionEquipment,
  Incident, IncidentMessage, Volunteer, FinanceRecord, CreditRecord, TimelineEvent,
} from './entities';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5433,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'openair_cinema',
  entities: [
    User, Organization, Venue, Equipment, ScreeningSession, SessionEquipment,
    Incident, IncidentMessage, Volunteer, FinanceRecord, CreditRecord, TimelineEvent,
  ],
  synchronize: true,
});

async function main() {
  await AppDataSource.initialize();

  // 清空重建（开发环境种子）
  await AppDataSource.query(`TRUNCATE TABLE
    incident_messages, incidents, timeline_events, finance_records, credit_records,
    volunteers, session_equipment, screening_sessions, equipment, venues, users, organizations
    RESTART IDENTITY CASCADE`);

  const hash = await bcrypt.hash('123456', 10);

  // ---------- 主办方 ----------
  const orgRepo = AppDataSource.getRepository(Organization);
  const org1 = await orgRepo.save(orgRepo.create({
    name: '阳光社区居委会', type: 'COMMUNITY', contactName: '陈芳', contactPhone: '13800000001',
    creditScore: 100, depositBalance: 5000,
  }));
  const org2 = await orgRepo.save(orgRepo.create({
    name: '安泰物业服务中心', type: 'PROPERTY', contactName: '赵磊', contactPhone: '13800000002',
    creditScore: 65, depositBalance: 3000,
  }));
  const org3 = await orgRepo.save(orgRepo.create({
    name: '星光商圈运营公司', type: 'BUSINESS_DISTRICT', contactName: '周琳', contactPhone: '13800000003',
    creditScore: 91, depositBalance: 8000,
  }));

  // ---------- 用户 ----------
  const userRepo = AppDataSource.getRepository(User);
  const mkUser = (username: string, name: string, role: any, organizationId: string | null = null, phone = '13900000000') =>
    userRepo.save(userRepo.create({ username, passwordHash: hash, name, role, organizationId, phone }));

  const applicant1 = await mkUser('applicant1', '陈芳（社区申请员）', 'APPLICANT', org1.id, '13800000001');
  await mkUser('applicant2', '赵磊（物业申请员）', 'APPLICANT', org2.id, '13800000002');
  await mkUser('applicant3', '周琳（商圈申请员）', 'APPLICANT', org3.id, '13800000003');
  const reviewer = await mkUser('reviewer', '李文（文化审核员）', 'CULTURE_REVIEWER');
  const warehouse = await mkUser('warehouse', '孙强（仓库管理员）', 'WAREHOUSE');
  const leader = await mkUser('leader', '吴勇（现场负责人）', 'FIELD_LEADER');
  const security = await mkUser('security', '郑凯（安保主管）', 'SECURITY');
  const finance = await mkUser('finance', '王敏（财务）', 'FINANCE');
  await mkUser('street', '街道文体岗-高主任', 'STREET_ADMIN');

  // ---------- 场地 ----------
  const venueRepo = AppDataSource.getRepository(Venue);
  const v1 = await venueRepo.save(venueRepo.create({
    name: '市民中心南广场', address: '人民路 88 号南广场', maxAudience: 300,
    powerCondition: '固定配电箱 220V/40A，双回路',
  }));
  const v2 = await venueRepo.save(venueRepo.create({
    name: '河畔小区中庭', address: '河畔路 12 号小区中庭', maxAudience: 120,
    powerCondition: '物业临时接电 220V/20A',
    noiseEventCount: 2, // 历史噪声 2 次，审核时会提示高风险
  }));
  const v3 = await venueRepo.save(venueRepo.create({
    name: '夜市步行街北口', address: '解放大道夜市步行街北口', maxAudience: 200,
    powerCondition: '商户接电',
    blacklisted: true,
    blacklistReason: '2026 年以来连续 3 次夜间噪声扰民投诉，邻近住宅楼',
    blacklistSource: '街道文体岗 高主任 手动拉黑',
    blacklistedAt: new Date('2026-08-20'),
    noiseEventCount: 4,
  }));

  // ---------- 设备台账（二维码编码） ----------
  const eqRepo = AppDataSource.getRepository(Equipment);
  const equipDefs: [string, string, any, number, string][] = [
    ['EQ-PJ-001', 'NEC 工程投影机 A', 'PROJECTOR', 12000, '5500 流明'],
    ['EQ-PJ-002', '爱普生工程投影机 B', 'PROJECTOR', 10000, '5000 流明'],
    ['EQ-SC-001', '300 寸充气幕布', 'SCREEN', 3500, '300 寸 16:9'],
    ['EQ-SC-002', '200 寸支架幕布', 'SCREEN', 1800, '200 寸 16:9'],
    ['EQ-SP-001', 'JBL 主音箱 1 号', 'SPEAKER', 2200, '300W'],
    ['EQ-SP-002', 'JBL 主音箱 2 号', 'SPEAKER', 2200, '300W'],
    ['EQ-SP-003', '辅助补声音箱 1 号', 'SPEAKER', 1200, '150W'],
    ['EQ-SP-004', '辅助补声音箱 2 号', 'SPEAKER', 1200, '150W'],
    ['EQ-CB-001', '30 米主电缆盘', 'CABLE', 600, '3×4mm²'],
    ['EQ-CB-002', '20 米分路电缆盘', 'CABLE', 400, '3×2.5mm²'],
    ['EQ-CB-003', '20 米分路电缆盘', 'CABLE', 400, '3×2.5mm²'],
    ['EQ-BL-001', '投影机备用灯泡 A', 'SPARE_BULB', 1500, 'NEC 原厂'],
    ['EQ-BL-002', '投影机备用灯泡 B', 'SPARE_BULB', 1300, '爱普生原厂'],
    ['EQ-RC-001', '设备防雨罩（大）', 'RAIN_COVER', 300, '投影机+播放器'],
    ['EQ-RC-002', '设备防雨罩（小）', 'RAIN_COVER', 200, '音箱/配电箱'],
  ];
  for (const [qrCode, name, category, value, model] of equipDefs) {
    await eqRepo.save(eqRepo.create({ qrCode, name, category, value, model, status: 'IDLE' }));
  }

  // ---------- 示例场次：待审核（位于风险点位 v2，审核时会要求确认风险） ----------
  const sRepo = AppDataSource.getRepository(ScreeningSession);
  const demo = await sRepo.save(sRepo.create({
    code: 'SS-20260927-001',
    title: '我和我的家乡',
    organizationId: org1.id,
    venueId: v2.id,
    screeningDate: new Date('2026-09-27T19:00:00+08:00'),
    expectedAudience: 100,
    copyrightProof: '/uploads/demo-copyright-proof.pdf',
    powerCondition: '物业临时接电 220V/20A，已备 30 米电缆盘',
    screenSize: '200 寸 16:9',
    speakerCount: 2,
    securityStaffCount: 4,
    rainPlan: '配备防雨罩 2 件；中雨以上立即停止放映，观众由 3 个单元门有序疏散，设备 10 分钟内遮盖转移至物业库房',
    applicantUserId: applicant1.id,
    fieldLeaderId: leader.id,
    status: 'PENDING_REVIEW',
  }));
  const tlRepo = AppDataSource.getRepository(TimelineEvent);
  await tlRepo.save(tlRepo.create({
    sessionId: demo.id, eventType: 'APPLIED', title: '提交放映申请',
    detail: `${org1.name} 申请在 ${v2.name} 放映《我和我的家乡》`,
    actorUserId: applicant1.id, actorName: applicant1.name,
  }));

  console.log('种子数据写入完成：');
  console.log('  账号密码统一为 123456');
  console.log('  applicant1/applicant2/applicant3 | reviewer | warehouse | leader | security | finance | street');
  console.log(`  示例待审核场次：${demo.code}（风险点位，审核需确认知悉风险）`);
  console.log('  黑名单场地：夜市步行街北口');

  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

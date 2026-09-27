import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';

loadEnv();
import {
  Complaint,
  CreditRecord,
  DepositTransaction,
  EquipmentCategory,
  EquipmentItem,
  EquipmentKitItem,
  EquipmentScanLog,
  Incident,
  IncidentMessage,
  OnsiteCheck,
  Organization,
  Screening,
  ScreeningStatus,
  TimelineEvent,
  User,
  UserRole,
  Venue,
  VenueBlacklistRecord,
  VolunteerCheckin,
} from './entities';

/**
 * 种子数据：清空并重建演示数据。
 * 用法：npm run seed（或 SEED_ONLY=true ts-node src/seed.ts）
 */
async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_SOCKET || process.env.DB_HOST || '/tmp/pgsock',
    port: Number(process.env.DB_PORT || 5433),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'cinema',
    entities: [
      User,
      Organization,
      Venue,
      VenueBlacklistRecord,
      Screening,
      TimelineEvent,
      EquipmentItem,
      EquipmentKitItem,
      EquipmentScanLog,
      OnsiteCheck,
      Incident,
      IncidentMessage,
      Complaint,
      VolunteerCheckin,
      CreditRecord,
      DepositTransaction,
    ],
    synchronize: true,
  });
  await ds.initialize();
  console.log('数据库已连接，开始写入种子数据...');

  await ds.transaction(async (m) => {
    // 顺序清空（外键较多，直接 CASCADE 全表截断）
    await m.query(
      `TRUNCATE TABLE
        deposit_transactions, credit_records, volunteer_checkins,
        complaints, incident_messages, incidents, onsite_checks,
        equipment_scan_logs, equipment_kit_items, equipment_items,
        timeline_events, screenings, venue_blacklist_records,
        venues, users, organizations
       RESTART IDENTITY CASCADE`,
    );

    // ---- 主办方 ----
    const orgCommunity = await m.save(
      m.create(Organization, {
        name: '阳光社区居委会',
        type: 'community',
        creditScore: 100,
        depositBalance: '10000.00',
      }),
    );
    const orgProperty = await m.save(
      m.create(Organization, {
        name: '安居物业管理有限公司',
        type: 'property',
        creditScore: 85,
        depositBalance: '6000.00',
      }),
    );
    const orgBusiness = await m.save(
      m.create(Organization, {
        name: '星光商圈运营方',
        type: 'business',
        creditScore: 72,
        depositBalance: '8000.00',
      }),
    );

    // ---- 用户（统一密码 123456） ----
    const hash = await bcrypt.hash('123456', 10);
    const users: Array<Partial<User> & { role: UserRole; orgId?: string | null }> = [
      { username: 'shequ', name: '李社区（申请方）', role: UserRole.APPLICANT, orgId: orgCommunity.id, phone: '13800000001' },
      { username: 'wuye', name: '王物业（申请方）', role: UserRole.APPLICANT, orgId: orgProperty.id, phone: '13800000002' },
      { username: 'shangquan', name: '赵商圈（申请方）', role: UserRole.APPLICANT, orgId: orgBusiness.id, phone: '13800000003' },
      { username: 'shenhe', name: '陈文化（审核员）', role: UserRole.AUDITOR, orgId: null, phone: '13800000004' },
      { username: 'cangku', name: '刘仓库（仓管）', role: UserRole.WAREHOUSE, orgId: null, phone: '13800000005' },
      { username: 'xianchang', name: '孙现场（负责人）', role: UserRole.ONSITE, orgId: null, phone: '13800000006' },
      { username: 'anbao', name: '周安保（队长）', role: UserRole.SECURITY, orgId: null, phone: '13800000007' },
      { username: 'caiwu', name: '吴财务', role: UserRole.FINANCE, orgId: null, phone: '13800000008' },
      { username: 'jiedao', name: '郑街道（文体岗）', role: UserRole.STREET, orgId: null, phone: '13800000009' },
    ];
    for (const u of users) {
      await m.save(
        m.create(User, {
          username: u.username,
          passwordHash: hash,
          name: u.name,
          role: u.role,
          orgId: u.orgId ?? null,
          phone: u.phone,
        }),
      );
    }

    // ---- 场地 ----
    const v1 = await m.save(
      m.create(Venue, {
        name: '阳光社区中心广场',
        address: '朝阳区阳光路 88 号中心广场',
        lng: 116.48,
        lat: 39.92,
        capacity: 300,
      }),
    );
    const v2 = await m.save(
      m.create(Venue, {
        name: '安居小区东区草坪',
        address: '朝阳区安居街 12 号东区',
        capacity: 150,
      }),
    );
    const v3 = await m.save(
      m.create(Venue, {
        name: '星光夜市外摆区',
        address: '朝阳区星光大道商圈南侧',
        capacity: 400,
        // 已发生 3 次噪声投诉、1 次设备损坏，用于风险点位演示
        noiseCount: 3,
        damageCount: 1,
        screeningCount: 6,
      }),
    );
    const v4 = await m.save(
      m.create(Venue, {
        name: '老城区滨河窄巷',
        address: '滨河路 3 号巷内',
        capacity: 80,
        blacklisted: true,
        blacklistReason: '通道狭窄，消防通道不达标且连续噪声投诉',
        blacklistedAt: new Date('2026-09-01'),
        noiseCount: 4,
        screeningCount: 5,
      }),
    );
    await m.save(
      m.create(VenueBlacklistRecord, {
        venueId: v4.id,
        action: 'ADD',
        reason: '通道狭窄，消防通道不达标且连续噪声投诉',
        operatorName: '郑街道（文体岗）',
      }),
    );

    // ---- 设备库存（六类） ----
    const defs: Array<[string, string, EquipmentCategory, string, number]> = [
      ['PJ-0001', '4K 激光投影机 A', EquipmentCategory.PROJECTOR, '8000.00', 3],
      ['SC-0001', '200 寸充气幕布', EquipmentCategory.SCREEN, '2500.00', 3],
      ['SP-0001', '有源主音箱', EquipmentCategory.SPEAKER, '1200.00', 6],
      ['CA-0001', '30 米阻燃电缆', EquipmentCategory.CABLE, '300.00', 6],
      ['BL-0001', '投影机备用灯泡', EquipmentCategory.BULB, '900.00', 4],
      ['RC-0001', '设备防雨罩', EquipmentCategory.RAIN_COVER, '150.00', 4],
    ];
    for (const [prefix, name, category, value, count] of defs) {
      for (let i = 1; i <= count; i++) {
        const code = `${prefix.split('-')[0]}-${String(i).padStart(4, '0')}`;
        await m.save(
          m.create(EquipmentItem, {
            qrCode: code,
            name: `${name} ${i}`,
            category,
            value,
            status: 'IDLE',
          }),
        );
      }
    }

    // ---- 一条已提交待审的示例场次 ----
    const day = new Date();
    day.setDate(day.getDate() + 2);
    day.setHours(19, 0, 0, 0);
    const end = new Date(day);
    end.setHours(21, 30, 0, 0);
    const screening = await m.save(
      m.create(Screening, {
        code: `OC-${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}-0001`,
        orgId: orgCommunity.id,
        venueId: v1.id,
        screeningDate: day,
        endTime: end,
        filmTitle: '我和我的家乡',
        copyrightProof: '授权书编号 BWQ-2026-0921（市影视版权服务中心出具）',
        eventRecordNo: '',
        expectedAudience: 220,
        powerCondition: '广场配电房 220V/30A 专用接口，距放映点 40 米',
        screenSize: '200.00',
        speakerCount: 2,
        securityStaffCount: 4,
        rainPlan: '启用 6 顶应急帐篷遮盖设备，启用防雨罩；中雨以上停映并组织观众有序撤离，改期至次周同时段',
        deposit: '2000.00',
        status: ScreeningStatus.SUBMITTED,
        submittedAt: new Date(),
      }),
    );
    orgCommunity.depositBalance = '8000.00';
    await m.save(orgCommunity);
    await m.save(
      m.create(DepositTransaction, {
        orgId: orgCommunity.id,
        screeningId: screening.id,
        type: 'FREEZE',
        amount: '2000.00',
        remark: `场次 ${screening.code} 冻结设备押金`,
        operatorName: '李社区（申请方）',
      }),
    );
    await m.save(
      m.create(TimelineEvent, {
        screeningId: screening.id,
        phase: 'SUBMIT',
        title: '放映申请已提交',
        detail: '影片《我和我的家乡》｜预计观众 220 人｜冻结押金 2000.00 元',
        actorName: '李社区（申请方）',
        actorRole: UserRole.APPLICANT,
      }),
    );

    // ---- 一条历史已结算场次（星光商圈，含噪声投诉，供街道复盘演示） ----
    const past = new Date();
    past.setDate(past.getDate() - 7);
    past.setHours(19, 0, 0, 0);
    const pastEnd = new Date(past);
    pastEnd.setHours(21, 20, 0, 0);
    const hist = await m.save(
      m.create(Screening, {
        code: `OC-${past.getFullYear()}${String(past.getMonth() + 1).padStart(2, '0')}${String(past.getDate()).padStart(2, '0')}-0009`,
        orgId: orgBusiness.id,
        venueId: v3.id,
        screeningDate: past,
        endTime: pastEnd,
        filmTitle: '夜市奇妙夜',
        copyrightProof: '授权书编号 BWQ-2026-0808',
        eventRecordNo: 'HDBA-2026-0815',
        expectedAudience: 350,
        powerCondition: '商户共用配电柜 220V',
        screenSize: '180.00',
        speakerCount: 4,
        securityStaffCount: 6,
        rainPlan: '各商户门口避雨',
        deposit: '2000.00',
        status: ScreeningStatus.SETTLED,
        submittedAt: new Date(past.getTime() - 9 * 86400000),
        auditedAt: new Date(past.getTime() - 8 * 86400000),
        auditorId: null,
        copyrightConfirmed: true,
        recordConfirmed: true,
        auditRemark: '影片授权与公共活动备案均已确认',
        compensation: '300.00',
        subsidy: '800.00',
        copyrightWrittenOff: true,
        settledAt: new Date(past.getTime() + 86400000),
        hasNoiseIssue: true,
        hasDamageIssue: true,
        reviewConclusion: '噪声偏高、音响损坏 1 只；建议该点位降音并控制在 2 只音响后再安排',
      }),
    );
    await m.save(
      m.create(TimelineEvent, {
        screeningId: hist.id,
        phase: 'SETTLE',
        title: '历史场次已核销（复盘示例）',
        detail: '噪声投诉 + 设备损坏，信用 -25，点位风险升高',
        actorName: '吴财务',
        actorRole: UserRole.FINANCE,
      }),
    );
    await m.save(
      m.create(CreditRecord, {
        orgId: orgBusiness.id,
        screeningId: hist.id,
        delta: -25,
        reason: '噪声投诉 -10；设备损坏 -15',
        operatorName: '吴财务',
      }),
    );

    console.log('种子数据写入完成 ✓');
  });

  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

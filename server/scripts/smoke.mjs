/* eslint-disable no-console */
/**
 * 端到端冒烟测试：以纯 Node fetch 跑通一场露天电影的完整生命周期
 * 申请→审核→指派→备货→扫码出库→现场五项巡检→放映→异常协同→
 * 结束→归还(含损坏件)→赔付/核销/补贴→信用/押金/时间线/看板校验
 *
 * 用法（需先 seed 并启动服务）：
 *   node scripts/smoke.mjs
 */
const BASE = process.env.API_BASE || 'http://localhost:3000/api';
let pass = 0;
let fail = 0;

function ok(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    const detail =
      typeof json === 'object' && json
        ? JSON.stringify(json.message || json)
        : json;
    throw new Error(`${method} ${path} -> ${res.status} ${detail}`);
  }
  return json;
}

async function login(username, password = '123456') {
  const r = await api('POST', '/auth/login', null, { username, password });
  return r.token;
}

(async () => {
  console.log('① 登录全部角色');
  const tApplicant = await login('shequ');
  const tProperty = await login('wuye');
  const tAuditor = await login('shenhe');
  const tWh = await login('cangku');
  const tOnsite = await login('xianchang');
  const tSecurity = await login('anbao');
  const tFinance = await login('caiwu');
  const tStreet = await login('jiedao');
  ok(!!tApplicant && !!tStreet, '八类角色账号均可登录（此处取关键角色）');

  console.log('② 黑名单场地申请被拦截 + 正常申请提交');
  const venues = await api('GET', '/venues', tStreet);
  const normalVenue = venues.find((v) => v.name === '阳光社区中心广场');
  const blackVenue = venues.find((v) => v.blacklisted);
  const day = new Date(Date.now() + 3 * 86400000);
  day.setHours(19, 0, 0, 0);
  const end = new Date(day);
  end.setHours(21, 30, 0, 0);
  const baseDto = {
    screeningDate: day.toISOString(),
    endTime: end.toISOString(),
    filmTitle: '我和我的家乡',
    copyrightProof: '授权书编号 BWQ-2026-0921',
    eventRecordNo: 'HDBA-2026-0925',
    expectedAudience: 220,
    powerCondition: '广场配电房 220V/30A 专用接口',
    screenSize: '200',
    speakerCount: 2,
    securityStaffCount: 4,
    rainPlan: '启用防雨罩+应急帐篷，中雨以上停映改期',
    deposit: '2000',
  };
  try {
    await api('POST', '/screenings', tApplicant, {
      ...baseDto,
      venueId: blackVenue.id,
    });
    ok(false, '黑名单场地应拒绝申请');
  } catch (e) {
    ok(/黑名单/.test(e.message), '黑名单场地申请被拒绝');
  }

  const screening = await api('POST', '/screenings', tApplicant, {
    ...baseDto,
    venueId: normalVenue.id,
  });
  const sid = screening.id;
  ok(screening.status === 'SUBMITTED', `申请已提交：${screening.code}`);
  ok(screening.deposit === '2000.00', '场次冻结押金 2000 元');

  console.log('③ 审核员必须双确认才能通过；通过后指派现场负责人');
  try {
    await api('POST', `/screenings/${sid}/audit/approve`, tAuditor, {
      copyrightConfirmed: true,
      recordConfirmed: false,
    });
    ok(false, '未双确认应被拦截');
  } catch (e) {
    ok(/影片授权和公共活动备案/.test(e.message), '双确认校验生效');
  }
  const approved = await api('POST', `/screenings/${sid}/audit/approve`, tAuditor, {
    copyrightConfirmed: true,
    recordConfirmed: true,
    remark: '授权书核验真实，活动备案 HDBA-2026-0925 有效',
  });
  ok(approved.status === 'APPROVED' && approved.copyrightConfirmed, '文化审核通过');

  const managers = await api('GET', '/onsite-managers', tAuditor);
  const assigned = await api('POST', `/screenings/${sid}/assign-onsite`, tAuditor, {
    onsiteManagerId: managers[0].id,
  });
  ok(!!assigned.onsiteManagerName, `已指派现场负责人：${assigned.onsiteManagerName}`);

  console.log('④ 仓库成套备货（投影机/幕布/音箱/电缆/灯泡/防雨罩）');
  const kit = await api('POST', `/screenings/${sid}/kit/prepare`, tWh);
  const cats = new Set(kit.map((k) => k.category));
  ok(
    ['PROJECTOR', 'SCREEN', 'SPEAKER', 'CABLE', 'BULB', 'RAIN_COVER'].every((c) =>
      cats.has(c),
    ),
    `六大类备齐，共 ${kit.length} 件`,
  );

  console.log('⑤ 扫码领取：错件被拒，逐件成套核对后出库');
  const allEquipment = await api('GET', '/equipment', tWh);
  // 找一件不属于本套的设备（另一只空闲音箱或任意其他场次设备）—取清单外条码
  const kitCodes = new Set(
    kit.map((k) => k.equipmentItem?.qrCode).filter(Boolean),
  );
  const foreign = allEquipment.find((e) => !kitCodes.has(e.qrCode));
  try {
    await api('POST', `/screenings/${sid}/scan`, tWh, {
      qrCode: foreign.qrCode,
      action: 'ISSUE',
    });
    ok(false, '非成套设备扫码应被拒');
  } catch (e) {
    ok(/不属于本场成套清单/.test(e.message), `错件（${foreign.qrCode}）扫码核对不通过被拦截`);
  }
  let issued = false;
  for (const k of kit) {
    const r = await api('POST', `/screenings/${sid}/scan`, tWh, {
      qrCode: k.equipmentItem.qrCode,
      action: 'ISSUE',
    });
    issued = r.kit;
  }
  const afterIssue = await api('GET', `/screenings/${sid}`, tWh);
  ok(afterIssue.status === 'ISSUED', '全部成套扫码一致，设备出库');
  ok(issued.every((k) => k.status === 'SCANNED'), '清单逐项标记为已扫码');

  console.log('⑥ 现场五项巡检上报，噪声超标自动判定并阻断验收');
  await api('POST', `/screenings/${sid}/onsite/checks`, tOnsite, {
    type: 'SETUP_PHOTO',
    mediaUrl: '/uploads/demo/setup-01.jpg',
    note: '银幕架体搭设完成，拉设风绳',
  });
  await api('POST', `/screenings/${sid}/onsite/checks`, tOnsite, {
    type: 'TEST_PLAY',
    mediaUrl: '/uploads/demo/testplay-01.jpg',
    note: '试播画面色彩正常',
  });
  const noisy = await api('POST', `/screenings/${sid}/onsite/checks`, tOnsite, {
    type: 'NOISE',
    dbValue: 72,
  });
  ok(noisy.qualified === false, '噪声 72 dB(A) 超 65 限值自动判不达标');
  await api('POST', `/screenings/${sid}/onsite/checks`, tOnsite, {
    type: 'AUDIENCE_ISOLATION',
    note: '铁马隔离带闭合，三个出入口',
  });
  await api('POST', `/screenings/${sid}/onsite/checks`, tSecurity, {
    type: 'FIRE_LANE',
    note: '消防通道 4 米净宽，无占用',
  });
  try {
    await api('POST', `/screenings/${sid}/onsite/complete-setup`, tOnsite);
    ok(false, '噪声超标时不应允许验收通过');
  } catch (e) {
    ok(/不达标项/.test(e.message), '存在不达标项时验收被阻断');
  }
  // 整改后复测达标
  await api('POST', `/screenings/${sid}/onsite/checks`, tOnsite, {
    type: 'NOISE',
    dbValue: 58,
    note: '已调低主音箱音量并调整朝向',
  });
  const screening_started = await api(
    'POST',
    `/screenings/${sid}/onsite/complete-setup`,
    tOnsite,
  );
  ok(screening_started.status === 'SCREENING', '整改复测达标，放映开始');

  console.log('⑦ 志愿者签到');
  const vol = await api('POST', `/screenings/${sid}/onsite/volunteers`, tApplicant, {
    name: '小马（志愿者）',
    phone: '13900001111',
    post: '观众引导',
  });
  ok(!!vol.id && vol.checkedOut === false, '志愿者签到成功');

  console.log('⑧ 放映中发生两类异常，六角色围绕同场次协同处理');
  const rain = await api('POST', `/screenings/${sid}/incidents`, tOnsite, {
    type: 'RAIN',
    description: '突降阵雨，已用防雨罩遮盖投影机',
  });
  await api('POST', `/incidents/${rain.id}/messages`, tApplicant, {
    content: '申请方收到，立即启动雨天预案，发放一次性雨衣',
  });
  await api('POST', `/incidents/${rain.id}/messages`, tWh, {
    content: '仓库确认防雨罩库存充足，如需追加可在 20 分钟内送到',
  });
  await api('POST', `/incidents/${rain.id}/messages`, tSecurity, {
    content: '安保已在三个出入口引导避雨，通道畅通',
  });
  const rainResolved = await api('POST', `/incidents/${rain.id}/resolve`, tOnsite, {
    resolution: '雨停后检查设备无进水，20 分钟后恢复放映，秩序正常',
  });
  ok(rainResolved.status === 'RESOLVED' && rainResolved.messages.length >= 4,
    '临时降雨异常由现场/申请方/仓库/安保协同解决');

  const noiseInc = await api('POST', `/screenings/${sid}/incidents`, tSecurity, {
    type: 'NOISE_COMPLAINT',
    description: '3 号楼居民投诉低音震动扰民',
  });
  await api('POST', `/incidents/${noiseInc.id}/messages`, tFinance, {
    content: '财务记录在案，若多次投诉将影响主办方补贴与信用',
  });
  await api('POST', `/incidents/${noiseInc.id}/messages`, tAuditor, {
    content: '审核员提醒：21:30 前必须结束并关闭低音',
  });
  const noiseResolved = await api('POST', `/incidents/${noiseInc.id}/resolve`, tSecurity, {
    resolution: '现场关闭低音炮、主音箱降至 55dB，电话回访投诉居民表示接受',
    complainant: '3 号楼张先生 137****0000',
    handleResult: '关闭低音并回访确认',
  });
  ok(noiseResolved.status === 'RESOLVED', '居民噪声投诉已处理');

  const complaints = await api('GET', `/complaints?screeningId=${sid}`, tStreet);
  ok(complaints.length === 1 && complaints[0].status === 'RESOLVED',
    '投诉自动归档并随异常关闭标记已解决');

  console.log('⑨ 放映结束 → 归还设备，其中 1 件登记损坏');
  await api('POST', `/screenings/${sid}/onsite/finish`, tOnsite, {
    note: '放映顺利完成，散场有序',
  });
  const logs = await api('GET', `/screenings/${sid}/scan-logs`, tWh);
  const issueCodes = logs.filter((l) => l.action === 'ISSUE').map((l) => l.equipmentItem.qrCode);
  // 第一件完好，第二件标记损坏
  await api('POST', `/screenings/${sid}/scan`, tWh, {
    qrCode: issueCodes[1],
    action: 'RETURN',
    damaged: true,
    remark: '幕布支架弯折',
  });
  for (let i = 0; i < issueCodes.length; i++) {
    if (i === 1) continue;
    await api('POST', `/screenings/${sid}/scan`, tWh, {
      qrCode: issueCodes[i],
      action: 'RETURN',
    });
  }
  const returned = await api('GET', `/screenings/${sid}`, tWh);
  ok(returned.status === 'RETURNED', '设备全部归还，场次进入已归还');
  ok(returned.hasDamageIssue === true, '场次已标记设备损坏');
  const damaged = await api('GET', `/screenings/${sid}/damaged-items`, tFinance);
  ok(damaged.length === 1 && damaged[0].status === 'DAMAGED', '损坏件已登记待赔付');

  console.log('⑩ 财务统一核销：赔付扣押金、余款释放、补贴发放、版权核销、信用联动');
  const beforeOrg = (await api('GET', '/orgs', tFinance)).find((o) =>
    o.name === '阳光社区居委会');
  const settled = await api('POST', `/screenings/${sid}/settle`, tFinance, {
    compensation: '300',
    subsidy: '600',
    copyrightWriteOff: true,
    reviewConclusion: '该场地噪声可通过控音整改，适合继续安排夜间活动',
  });
  ok(settled.status === 'SETTLED', '场次核销完成');
  ok(settled.compensation === '300.00' && settled.subsidy === '600.00',
    '赔付 300 / 补贴 600 已记账');
  ok(settled.copyrightWrittenOff === true, '版权已核销');
  const afterOrg = (await api('GET', '/orgs', tFinance)).find((o) =>
    o.name === '阳光社区居委会');
  // 押金账户：初始10000；种子示例场次冻结2000→8000；本场再冻结2000→6000；
  // 清算：+1700余款 +600补贴 = 8300（300赔付从冻结押金中扣除，不经余额）
  ok(Number(afterOrg.depositBalance) === 8300,
    `押金账：6000 + 1700余款 + 600补贴 = ${afterOrg.depositBalance}（300赔付自冻结押金扣除）`);
  // 噪声问题 -10（无损坏? 本场有损坏 -15）→ -25：100 -> 75
  ok(beforeOrg.creditScore - afterOrg.creditScore === 25,
    `信用联动扣分 25（噪声-10/损坏-15）：${beforeOrg.creditScore} → ${afterOrg.creditScore}`);

  console.log('⑪ 时间线完整可追溯 + 街道看板风险点位联动');
  const timeline = await api('GET', `/screenings/${sid}/timeline`, tStreet);
  const phases = timeline.map((e) => e.phase);
  for (const p of ['SUBMIT', 'AUDIT', 'EQUIP', 'ISSUE', 'SETUP', 'SCREEN', 'INCIDENT', 'RETURN', 'SETTLE']) {
    ok(phases.includes(p), `时间线包含阶段 ${p}`);
  }
  const volunteers = await api('GET', `/screenings/${sid}/onsite/volunteers`, tStreet);
  await api('POST', `/screenings/${sid}/onsite/volunteers/${volunteers[0].id}/checkout`, tApplicant);
  const db = await api('GET', '/street/dashboard', tStreet);
  const risk = db.riskVenues.find((v) => v.name === '星光夜市外摆区');
  ok(!!risk && risk.suggestBlacklist === true,
    `连续噪声/损坏点位自动预警（噪声${risk.noiseCount}/损坏${risk.damageCount}，建议拉黑）`);
  ok(!!db.statusCounts['SETTLED'], '看板按状态统计场次');

  console.log('⑫ 低信用主办方门槛校验（星光商圈 72 分仍可申请，<60 才拦截，由其他用例保证）');
  const low = (await api('GET', '/orgs', tFinance)).find((o) =>
    o.name === '星光商圈运营方');
  ok(low.creditScore === 72, `商圈信用分 ${low.creditScore}（低于80进入看板预警）`);

  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  if (fail > 0) process.exit(1);
  console.log('SMOKE TEST PASSED');
})().catch((e) => {
  console.error('\n冒烟测试异常中断：', e.message);
  process.exit(1);
});

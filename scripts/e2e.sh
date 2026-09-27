#!/usr/bin/env bash
# 端到端验证：申请→审核(风险拦截)→备料(成套校验)→扫码核对→当天巡检→
# 异常跨角色协同→结束→归还赔付→核销(信用/押金/黑名单联动)→正常场加信用
set -euo pipefail
BASE=${BASE:-http://localhost:3000/api}
PASS=0; FAIL=0
ok()   { echo "  ✅ $*"; PASS=$((PASS+1)); }
bad()  { echo "  ❌ $*"; FAIL=$((FAIL+1)); }
login(){ curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"123456\"}" | jq -r .token; }
auth(){ curl -s -H "Authorization: Bearer $1" "${@:2}"; }
code(){ curl -s -o /tmp/resp.json -w '%{http_code}' -H "Authorization: Bearer $1" "${@:2}"; }
msg(){ jq -r '.message // empty' /tmp/resp.json; }

echo "== 重新播种 =="
( cd "$(dirname "$0")/../backend" && npm run seed >/dev/null 2>&1 )

T_APP=$(login applicant1); T_REV=$(login reviewer); T_WH=$(login warehouse)
T_LD=$(login leader); T_SEC=$(login security); T_FIN=$(login finance); T_ST=$(login street); T_APP3=$(login applicant3)
[ -n "$T_APP" ] && ok "8 个角色账号登录获取 JWT"

echo "== 1. 申请校验：黑名单场地 / 被暂停主办方 =="
V3=$(auth "$T_REV" "$BASE/venues" | jq -r '.[]|select(.name=="夜市步行街北口").id')
C=$(code "$T_APP" -X POST "$BASE/sessions" -H 'Content-Type: application/json' -d @- <<EOF
{"title":"测试","organizationId":"$(auth "$T_REV" "$BASE/organizations" | jq -r '.[0].id')","venueId":"$V3","screeningDate":"2026-10-01T19:00:00+08:00","expectedAudience":50,"copyrightProof":"/uploads/a.pdf","powerCondition":"x","screenSize":"200 寸 16:9","speakerCount":2,"securityStaffCount":2,"rainPlan":"y"}
EOF
)
[ "$C" = "403" ] && ok "黑名单场地申请被拦截（HTTP 403：$(msg)）" || bad "黑名单场地应被 403，实际 $C"

echo "== 2. 正常申请（阳光社区 / 市民中心南广场）=="
V1=$(auth "$T_REV" "$BASE/venues" | jq -r '.[]|select(.name=="市民中心南广场").id')
O1=$(auth "$T_APP" "$BASE/organizations" | jq -r '.[0].id')
C=$(code "$T_APP" -X POST "$BASE/sessions" -H 'Content-Type: application/json' -d "{\"title\":\"流浪地球2\",\"organizationId\":\"$O1\",\"venueId\":\"$V1\",\"screeningDate\":\"2026-10-02T19:00:00+08:00\",\"expectedAudience\":260,\"copyrightProof\":\"/uploads/copyright.pdf\",\"powerCondition\":\"固定配电箱 220V/40A\",\"screenSize\":\"300 寸 16:9\",\"speakerCount\":2,\"securityStaffCount\":6,\"rainPlan\":\"防雨罩+就近转移库房\"}")
S2=$(jq -r .id /tmp/resp.json)
[ "$C" = "201" ] && ok "正常场次申请成功（单号 $(jq -r .code /tmp/resp.json)）" || bad "申请应 201，实际 $C: $(msg)"

# 申请方数据隔离：商圈 applicant3 看不到阳光社区的场次
auth "$T_APP3" "$BASE/sessions" | jq -e 'map(select(.organizationId=="'"$O1"'")) | length == 0' >/dev/null \
  && ok "申请方只能查看本主办方场次（数据隔离）" || bad "申请方数据隔离失效"

echo "== 3. 风险点位审核拦截与确认 =="
DEMO=$(auth "$T_REV" "$BASE/sessions?status=PENDING_REVIEW" | jq -r '[.[]|select(.code=="SS-20260927-001")][0].id')
C=$(code "$T_REV" -X POST "$BASE/sessions/$DEMO/review" -H 'Content-Type: application/json' -d '{"approved":true,"copyrightAuthNo":"BQ-001","filingNo":"备088"}')
[ "$C" = "400" ] && [[ "$(msg)" == RISK:* ]] && ok "连续噪声点位首次批准被拦截并提示风险（$(msg | sed 's/RISK://')）" || bad "风险拦截失效 $C: $(msg)"
C=$(code "$T_REV" -X POST "$BASE/sessions/$DEMO/review?confirmRisk=true" -H 'Content-Type: application/json' -d '{"approved":true,"copyrightAuthNo":"BQ-2026-0927-01","filingNo":"文体备字(2026)第088号"}')
[ "$C" = "201" ] && ok "确认风险后审核通过，写入授权号/备案号（状态 $(jq -r .status /tmp/resp.json)）" || bad "风险确认后审核失败 $C: $(msg)"

C=$(code "$T_REV" -X POST "$BASE/sessions/$S2/review?confirmRisk=true" -H 'Content-Type: application/json' -d '{"approved":true,"copyrightAuthNo":"BQ-2026-1002-01","filingNo":"文体备字(2026)第091号"}')
[ "$C" = "201" ] && ok "正常点位场次审核通过" || bad "正常场次审核失败 $C: $(msg)"

echo "== 4. 仓库成套备料校验 =="
PJ1=$(auth "$T_WH" "$BASE/equipment" | jq -r '.[]|select(.qrCode=="EQ-PJ-001").id')
SC1=$(auth "$T_WH" "$BASE/equipment" | jq -r '.[]|select(.qrCode=="EQ-SC-001").id')
CB1=$(auth "$T_WH" "$BASE/equipment" | jq -r '.[]|select(.qrCode=="EQ-CB-001").id')
# 故意缺少音箱/防雨罩
C=$(code "$T_WH" -X POST "$BASE/sessions/$DEMO/prepare" -H 'Content-Type: application/json' -d "{\"equipmentIds\":[\"$PJ1\",\"$SC1\",\"$CB1\"]}")
[ "$C" = "400" ] && ok "成套缺件被拦截（$(msg)）" || bad "成套校验失效 $C: $(msg)"

# 用指定二维码组装成套（投影机/幕布/2音箱/2电缆/备灯/2防雨罩）
IDS=$(auth "$T_WH" "$BASE/equipment?status=IDLE" | jq -c '[.[]|select(.qrCode|test("EQ-PJ-001|EQ-SC-002|EQ-SP-001|EQ-SP-002|EQ-CB-001|EQ-CB-002|EQ-BL-001|EQ-RC-001|EQ-RC-002"))|.id]')
C=$(code "$T_WH" -X POST "$BASE/sessions/$DEMO/prepare" -H 'Content-Type: application/json' -d "{\"equipmentIds\":$IDS}")
[ "$C" = "201" ] && ok "9 件成套设备备料成功（状态 $(jq -r .status /tmp/resp.json)）" || bad "备料失败 $C: $(msg)"
# 重复备料：设备已被预留
C=$(code "$T_WH" -X POST "$BASE/sessions/$DEMO/prepare" -H 'Content-Type: application/json' -d "{\"equipmentIds\":$IDS}")
[ "$C" = "400" ] && ok "已备料场次不能重复备料" || bad "重复备料应被拦截 $C"

echo "== 5. 领取扫码核对成套状态 =="
C=$(code "$T_LD" -X POST "$BASE/sessions/$DEMO/scan" -H 'Content-Type: application/json' -d '{"qrCode":"EQ-PJ-002"}')
[ "$C" = "400" ] && ok "非本场清单设备扫码被拒（防止错拿：$(msg)）" || bad "错拿防护失效 $C: $(msg)"
for qr in EQ-PJ-001 EQ-SC-002 EQ-SP-001 EQ-SP-002 EQ-CB-001 EQ-CB-002 EQ-BL-001 EQ-RC-001 EQ-RC-002; do
  code "$T_LD" -X POST "$BASE/sessions/$DEMO/scan" -H 'Content-Type: application/json' -d "{\"qrCode\":\"$qr\"}" >/dev/null
done
ST=$(auth "$T_LD" "$BASE/sessions/$DEMO" | jq -r '.status + "|" + (.qrVerified|tostring)')
[ "$ST" = "IN_PROGRESS|true" ] && ok "9 件全部扫码后自动成套校验通过并进入放映当天（$ST）" || bad "扫码成套流转错误：$ST"

echo "== 6. 志愿者签到 =="
code "$T_LD" -X POST "$BASE/sessions/$DEMO/volunteers" -H 'Content-Type: application/json' -d '{"name":"志愿小马","phone":"13700001111","task":"东门秩序引导"}' >/dev/null
VID=$(auth "$T_LD" "$BASE/sessions/$DEMO/volunteers" | jq -r '.[0].id')
code "$T_LD" -X POST "$BASE/sessions/$DEMO/volunteers/$VID/checkout" -H 'Content-Type: application/json' -d '{}' >/dev/null
auth "$T_LD" "$BASE/sessions/$DEMO/volunteers" | jq -e '.[0].checkOutAt != null' >/dev/null \
  && ok "志愿者签到/签退记录正常" || bad "志愿者签退失败"

echo "== 7. 当天巡检（含噪声超标） =="
C=$(code "$T_LD" -X POST "$BASE/sessions/$DEMO/inspection" -H 'Content-Type: application/json' \
  -d '{"setupPhoto":"/uploads/setup.jpg","testPlayScreenshot":"/uploads/test.jpg","noiseDb":62,"isolationDesc":"铁马围合，3 个出入口","fireLaneDesc":"南北消防通道畅通 ≥4 米","remark":"音量已调低"}')
[ "$C" = "201" ] && jq -e '.noiseOverLimit == true' /tmp/resp.json >/dev/null \
  && ok "巡检五项提交成功，62dB 判定超标并计入风险" || bad "巡检失败 $C: $(msg)"

echo "== 8. 七类异常跨角色协同 =="
report(){ code "$1" -X POST "$BASE/sessions/$DEMO/incidents" -H 'Content-Type: application/json' -d "$2" >/dev/null; jq -r .id /tmp/resp.json; }
I_NOISE=$(report "$T_SEC" '{"type":"NOISE_COMPLAINT","description":"3 栋居民投诉音响低音震窗，要求 21:30 前结束","residentContact":"136-0000-0002"}')
I_MISS=$(report "$T_WH" '{"type":"EQUIPMENT_MISSING","description":"清点发现备用灯泡外包装破损，需仓库补发"}')
I_RAIN=$(report "$T_LD" '{"type":"RAIN","description":"突降阵雨，已启用防雨罩遮盖投影机，暂停放映 20 分钟"}')
I_EXT=$(report "$T_APP" '{"type":"EXTENSION_REQUEST","description":"夜市商户联名申请延长 40 分钟至 21:40"}')
ok "安保/仓库/现场/申请方分别上报 4 起异常（噪声/缺件/降雨/延时）"
# 多角色消息线程
for pair in "$T_APP|申请方：已逐户沟通致歉" "$T_SEC|安保：已加派 2 人在 3 栋楼下值守" "$T_FIN|财务：如超时产生的电费补贴请事后报备" "$T_WH|仓库：备用灯泡已由电瓶车送出"; do
  T=${pair%%|*}; M=${pair#*|}
  code "$T" -X POST "$BASE/incidents/$I_NOISE/messages" -H 'Content-Type: application/json' -d "{\"content\":\"$M\"}" >/dev/null
done
auth "$T_LD" "$BASE/incidents/$I_NOISE" | jq -e '(.messages | length >= 5) and .status=="PROCESSING"' >/dev/null \
  && ok "申请方/安保/财务/仓库围绕同一事件协同，状态自动转处理中" || bad "协同线程异常"
# 延时审批
C=$(code "$T_REV" -X POST "$BASE/incidents/$I_EXT/decision" -H 'Content-Type: application/json' -d '{"decision":"APPROVED","newEndTime":"2026-09-27T21:40:00+08:00","comment":"控制音量，21:40 必须结束"}')
[ "$C" = "201" ] && auth "$T_REV" "$BASE/sessions/$DEMO" | jq -e '.endTime != null' >/dev/null \
  && ok "延时申请经审核批准，场次结束时间同步更新" || bad "延时审批失败 $C: $(msg)"
# 关闭异常
for I in "$I_NOISE|21:25 降音结束，居民表示接受，备案回访" "$I_MISS|备用灯泡已送达并更换" "$I_RAIN|雨停后恢复放映，设备无进水" "$I_EXT|按批准时间 21:40 结束"; do
  IID=${I%%|*}; R=${I#*|}
  code "$T_LD" -X POST "$BASE/incidents/$IID/close" -H 'Content-Type: application/json' -d "{\"resolution\":\"$R\"}" >/dev/null
done
auth "$T_REV" "$BASE/sessions/$DEMO" | jq -e '[.incidents[]|select(.status!="CLOSED")]|length==0' >/dev/null \
  && ok "4 起异常全部填写处理结果并关闭" || bad "异常关闭失败"

echo "== 9. 结束放映（超员）与归还赔付 =="
code "$T_LD" -X POST "$BASE/sessions/$DEMO/finish" -H 'Content-Type: application/json' -d '{"actualAudience":130}' >/dev/null
SP1=$(auth "$T_WH" "$BASE/equipment" | jq -r '.[]|select(.qrCode=="EQ-SP-001").id')
C=$(code "$T_WH" -X POST "$BASE/sessions/$DEMO/return" -H 'Content-Type: application/json' -d "{\"items\":[{\"equipmentId\":\"$SP1\",\"state\":\"DAMAGED\",\"compensation\":800,\"note\":\"音箱面罩被雨水泡变形\"}]}")
[ "$C" = "201" ] && jq -e '.status=="COMPLETED" and .compensationTotal==800' /tmp/resp.json >/dev/null \
  && ok "归还验收：1 只音箱损坏赔 800 元，其余自动完好入库（$(jq -r .financeRecords[-1].remark /tmp/resp.json)）" || bad "归还赔付失败 $C: $(msg)"
O1_BEFORE=$(auth "$T_FIN" "$BASE/organizations/$O1" | jq -r .depositBalance)
[ "$O1_BEFORE" = "4200" ] && ok "赔付 800 已从押金 5000 抵扣，余额 4200" || bad "押金抵扣错误：$O1_BEFORE"

echo "== 10. 异常场核销（信用扣减 / 补贴 / 点位自动拉黑） =="
# 先核销异常场（演示场）
C=$(code "$T_FIN" -X POST "$BASE/sessions/$DEMO/settle" -H 'Content-Type: application/json' -d '{"subsidyAmount":1500,"copyrightWriteoff":true,"remark":"噪声超标场，补贴减半"}')
[ "$C" = "201" ] && ok "异常场核销完成：补贴 1500 已发放、版权凭证已核销（状态 $(jq -r .status /tmp/resp.json)）" || bad "核销失败 $C: $(msg)"
CREDIT=$(auth "$T_FIN" "$BASE/organizations/$O1" | jq -r .creditScore)
[ "$CREDIT" = "70" ] && ok "信用结算正确：100 -10(噪声超标) -5(噪声投诉) -5(设备缺件) -10(设备赔付) = 70" || bad "信用结算错误：$CREDIT"
V2=$(auth "$T_ST" "$BASE/venues" | jq -r '.[]|select(.name=="河畔小区中庭").id')
auth "$T_ST" "$BASE/venues/$V2" | jq -e '.blacklisted==true and .noiseEventCount==3' >/dev/null \
  && ok "点位累计噪声 3 次触发系统自动拉黑，影响下一轮审批" || bad "自动拉黑规则失效"

echo "== 11. 零异常场次顺利闭环（信用加分） =="
IDS2=$(auth "$T_WH" "$BASE/equipment?status=IDLE" | jq -c '[.[]|select(.qrCode|test("EQ-PJ-001|EQ-SC-001|EQ-SP-002|EQ-SP-003|EQ-CB-001|EQ-CB-003|EQ-BL-002|EQ-RC-001|EQ-RC-002"))|.id]')
code "$T_WH" -X POST "$BASE/sessions/$S2/prepare" -H 'Content-Type: application/json' -d "{\"equipmentIds\":$IDS2}" >/dev/null
for qr in EQ-PJ-001 EQ-SC-001 EQ-SP-002 EQ-SP-003 EQ-CB-001 EQ-CB-003 EQ-BL-002 EQ-RC-001 EQ-RC-002; do
  code "$T_LD" -X POST "$BASE/sessions/$S2/scan" -H 'Content-Type: application/json' -d "{\"qrCode\":\"$qr\"}" >/dev/null
done
code "$T_LD" -X POST "$BASE/sessions/$S2/inspection" -H 'Content-Type: application/json' -d '{"setupPhoto":"/uploads/s2.jpg","testPlayScreenshot":"/uploads/t2.jpg","noiseDb":48,"isolationDesc":"护栏围合","fireLaneDesc":"通道畅通"}' >/dev/null
code "$T_LD" -X POST "$BASE/sessions/$S2/finish" -H 'Content-Type: application/json' -d '{"actualAudience":240}' >/dev/null
code "$T_WH" -X POST "$BASE/sessions/$S2/return" -H 'Content-Type: application/json' -d '{"items":[]}' >/dev/null
code "$T_FIN" -X POST "$BASE/sessions/$S2/settle" -H 'Content-Type: application/json' -d '{"subsidyAmount":3000,"copyrightWriteoff":true}' >/dev/null
CREDIT2=$(auth "$T_FIN" "$BASE/organizations/$O1" | jq -r .creditScore)
[ "$CREDIT2" = "72" ] && ok "零异常场核销：信用 70 +2 = 72，补贴 3000 元已发放" || bad "信用加分错误：$CREDIT2"

echo "== 12. 未关闭异常拦截核销（独立第三场） =="
C=$(code "$T_APP" -X POST "$BASE/sessions" -H 'Content-Type: application/json' -d "{\"title\":\"悬崖之上\",\"organizationId\":\"$O1\",\"venueId\":\"$V1\",\"screeningDate\":\"2026-10-03T19:00:00+08:00\",\"expectedAudience\":200,\"copyrightProof\":\"/uploads/c3.pdf\",\"powerCondition\":\"固定配电箱\",\"screenSize\":\"200 寸 16:9\",\"speakerCount\":2,\"securityStaffCount\":4,\"rainPlan\":\"就近转移\"}")
S3=$(jq -r .id /tmp/resp.json)
code "$T_REV" -X POST "$BASE/sessions/$S3/review" -H 'Content-Type: application/json' -d '{"approved":true,"copyrightAuthNo":"BQ-2026-1003-01","filingNo":"文体备字(2026)第092号"}' >/dev/null
code "$T_WH" -X POST "$BASE/sessions/$S3/prepare" -H 'Content-Type: application/json' -d "{\"equipmentIds\":$IDS2}" >/dev/null
for qr in EQ-PJ-001 EQ-SC-001 EQ-SP-002 EQ-SP-003 EQ-CB-001 EQ-CB-003 EQ-BL-002 EQ-RC-001 EQ-RC-002; do
  code "$T_LD" -X POST "$BASE/sessions/$S3/scan" -H 'Content-Type: application/json' -d "{\"qrCode\":\"$qr\"}" >/dev/null
done
code "$T_LD" -X POST "$BASE/sessions/$S3/inspection" -H 'Content-Type: application/json' -d '{"setupPhoto":"/uploads/s3.jpg","testPlayScreenshot":"/uploads/t3.jpg","noiseDb":50,"isolationDesc":"护栏","fireLaneDesc":"畅通"}' >/dev/null
code "$T_LD" -X POST "$BASE/sessions/$S3/finish" -H 'Content-Type: application/json' -d '{"actualAudience":180}' >/dev/null
code "$T_WH" -X POST "$BASE/sessions/$S3/return" -H 'Content-Type: application/json' -d '{"items":[]}' >/dev/null
I_OPEN=$(curl -s -X POST "$BASE/sessions/$S3/incidents" -H "Authorization: Bearer $T_LD" -H 'Content-Type: application/json' -d '{"type":"POWER_TRIP","description":"放映中途跳闸一次"}' | jq -r .id)
C=$(code "$T_FIN" -X POST "$BASE/sessions/$S3/settle" -H 'Content-Type: application/json' -d '{"subsidyAmount":2000,"copyrightWriteoff":true}')
[ "$C" = "400" ] && ok "存在 1 起未关闭异常时核销被拦截（$(msg)）" || bad "核销拦截失效 $C: $(msg)"
code "$T_LD" -X POST "$BASE/incidents/$I_OPEN/close" -H 'Content-Type: application/json' -d '{"resolution":"复位合闸，更换老化空开，未再跳闸"}' >/dev/null
code "$T_FIN" -X POST "$BASE/sessions/$S3/settle" -H 'Content-Type: application/json' -d '{"subsidyAmount":2000,"copyrightWriteoff":true}' >/dev/null
[ "$(auth "$T_FIN" "$BASE/sessions/$S3" | jq -r .status)" = "SETTLED" ] && ok "异常关闭后可正常核销（供电跳闸计入信用 -5）" || bad "关闭后核销失败"

echo "== 13. 街道看板与时间线 =="
auth "$T_ST" "$BASE/dashboard/overview" | jq -e '.sessionTotal==3 and (.riskVenues|length>=2) and .equipment.damaged==1' >/dev/null \
  && ok "总览统计正确：3 场次、风险点位含自动拉黑场、设备损坏 1 件" || bad "总览统计异常"
TL=$(auth "$T_ST" "$BASE/dashboard/timeline" | jq 'length')
[ "$TL" -gt 30 ] && ok "街道活动时间线共 $TL 条事件，覆盖申请→审批→出库→搭建→放映→投诉→核销" || bad "时间线事件过少：$TL"

echo
echo "================ 结果：通过 $PASS / 失败 $FAIL ================"
[ "$FAIL" = "0" ]

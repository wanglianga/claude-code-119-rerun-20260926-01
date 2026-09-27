# 城市露天电影放映审批与设备巡检平台

面向街道、社区/物业/商圈运营方的露天电影全流程协同平台：覆盖**申请 → 文化审核 → 仓库成套扫码出库 → 现场五项巡检 → 异常多方协同 → 设备归还赔付 → 版权核销/补贴发放 → 街道复盘**的完整活动时间线，并内置主办方信用、设备押金、志愿者签到、场地黑名单机制。

- 前端：Vue 3 + Vite + Pinia + Vue Router + Axios
- 后端：NestJS 10 + TypeORM + Passport/JWT
- 数据库：PostgreSQL 15

---

## 一、本地启动

### 环境要求

- Node.js ≥ 18（已在 Node 22 验证）
- PostgreSQL 15（本机已安装 `/usr/lib/postgresql/15`）
- Linux/macOS（脚本为 bash；Windows 可参考命令手动执行）

### 方式 A：一键初始化（推荐）

```bash
cd /workspace/119-b
chmod +x scripts/*.sh server/scripts/*.sh
./scripts/setup.sh        # 启动用户态 PG(5433) + 安装依赖 + 写入演示数据
```

> 说明：当前隔离环境没有系统 PostgreSQL 的 superuser 口令，项目使用 **initdb 在用户目录自建实例**
> （数据目录 `~/pgdata/cinema`，端口 **5433**，unix socket `/tmp/pgsock`，trust 认证，库名 `cinema`）。
> 数据库启停：`./scripts/start-db.sh`；手动停止：
> `/usr/lib/postgresql/15/bin/pg_ctl -D ~/pgdata/cinema stop`
>
> 如果你已有可用的 PostgreSQL，修改 `server/.env` 指向自己的实例即可（把 `DB_SOCKET` 留空走 TCP）：
> ```
> DB_HOST=localhost  DB_PORT=5432  DB_USER=xxx  DB_PASS=xxx  DB_NAME=cinema  DB_SOCKET=
> ```

### 方式 B：分步启动

```bash
# 1. 数据库
./scripts/start-db.sh

# 2. 后端（首次需安装依赖：npm --prefix server install）
cd server
npm run seed              # 写入演示/测试数据（TRUNCATE 后重建，可重复执行）
npm run start:dev         # http://localhost:3000/api （开发热更）
# 或 npm run build && npm run start:prod

# 3. 前端（另开终端，首次 npm --prefix web install）
cd web
npm run dev               # http://localhost:5173 （/api 已代理到 3000）
```

打开 http://localhost:5173 ，使用下方测试账号登录。

---

## 二、测试账号

密码统一为 **`123456`**（登录页可点击账号名快捷填充）。

| 账号 | 角色 | 主要工作台 |
|---|---|---|
| `shequ` | 申请方（阳光社区居委会） | 提交申请、冻结押金、志愿者签到、异常协同 |
| `wuye` | 申请方（安居物业） | 同上 |
| `shangquan` | 申请方（星光商圈，信用 72） | 低信用预警演示 |
| `shenhe` | 文化审核员 | 双确认（影片授权 + 公共活动备案）审核、指派现场负责人 |
| `cangku` | 仓库管理员 | 六类成套备货、扫码出库/归还、损坏登记、设备台账 |
| `xianchang` | 现场负责人 | 五项巡检上报、验收开映/结束、志愿者、异常上报 |
| `anbao` | 安保队长 | 消防通道/隔离巡检、安保类异常处置 |
| `caiwu` | 财务 | 损坏赔付、押金清算、补贴发放、版权核销 |
| `jiedao` | 街道文体岗 | 活动时间线追踪、场地黑名单、风险看板、复盘 |

种子数据还包含：4 个场地（含 1 个已拉黑场地、1 个风险预警点位）、六类设备库存（每类多件、条码可扫）、1 条待审核示例场次、1 条已结算历史场次。

---

## 三、业务流程与验证方式

### 推荐走一遍完整流程（约 5 分钟）

1. **申请方** `shequ` 登录 →「提交申请」，填写放映日期/场地/观众/版权凭证/供电/银幕尺寸/音响数/安保数/雨天预案，提交即冻结 2000 元押金。
   - 选择已拉黑场地会被直接拦截；观众超容量、信用低于 60、押金不足同样拦截。
2. **审核员** `shenhe` 进入场次 → 必须同时勾选「影片授权」「公共活动备案」才能通过；可驳回。通过后指派现场负责人。
3. **仓库** `cangku` →「按成套清单备货」自动预占投影机/幕布/音箱/电缆/备用灯泡/防雨罩；领取时逐件**扫码核对**（输入条码，如 `PJ-0001`），扫到清单外设备会被拒；全部一致自动出库。
4. **现场负责人** `xianchang` 依次上报：搭建照片、试播截图、噪声分贝（填 **72** 会自动判超标并阻断验收，整改后再报 **58** 复测通过）、观众隔离、消防通道（消防通道也可用 `anbao` 上报）→ 验收开映。
5. **异常协同**：放映中可上报 7 类异常（影片文件损坏/设备缺件/噪声投诉/降雨/超员/跳闸/商户延长），申请方、审核员、仓库、现场、安保、财务在同一异常下留言协同，再填写处理结果关闭；噪声投诉会自动生成并归档投诉工单。
6. 放映结束后由 **仓库** 逐件扫码归还，可把其中 1 件标记为「损坏归还」。
7. **财务** `caiwu` 在场次页「财务核销结算」：损坏赔付从冻结押金扣除、余款释放、发放补贴、勾选版权核销；系统自动联动主办方信用（噪声 -10、损坏 -15、正常 +3）。
8. **街道** `jiedao` 打开「街道看板」：查看场次状态分布、场地风险榜（连续噪声/损坏自动建议拉黑，影响下一轮审批）、低信用主办方预警；进入任意场次可看完整活动时间线与复盘结论。

### 自动化端到端验证

后端启动后执行：

```bash
node server/scripts/smoke.mjs
```

脚本用纯 Node fetch 串起上述全生命周期并断言（**38 项检查**），包括：黑名单拦截、双确认审核、错件扫码拒绝、成套出库、噪声超标阻断与复测放行、多角色异常协同、投诉归档、损坏归还、押金账（冻结/扣赔/退还/补贴）、信用联动、九段时间线、风险点位看板预警。

> 该脚本会新建并核销一条完整场次；跑完可用 `npm run seed`（server 目录）恢复干净演示数据。

### 后端接口自测示例

```bash
# 登录取 token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"shenhe","password":"123456"}' | jq -r .token)

curl -s http://localhost:3000/api/screenings -H "Authorization: Bearer $TOKEN" | jq '.[0].code'
curl -s http://localhost:3000/api/street/dashboard -H "Authorization: Bearer $TOKEN" | jq '.statusCounts'
```

主要接口（均在 `/api` 前缀下，除登录外需 Bearer JWT）：

| 模块 | 接口 |
|---|---|
| 认证 | `POST /auth/login` `GET /auth/profile` |
| 申请 | `POST /screenings` `GET /screenings` `GET /screenings/:id` `POST /screenings/:id/cancel` `POST /screenings/:id/assign-onsite` |
| 审核 | `POST /screenings/:id/audit/approve` `/audit/reject` |
| 仓库 | `GET/POST /equipment` `POST /screenings/:id/kit/prepare` `GET /screenings/:id/kit` `POST /screenings/:id/scan` `GET /screenings/:id/scan-logs` `/damaged-items` |
| 现场 | `GET/POST /screenings/:id/onsite/checks` `POST .../complete-setup` `.../finish` `GET/POST .../volunteers` |
| 异常 | `GET /incidents/open` `GET/POST /screenings/:id/incidents` `POST /incidents/:iid/messages` `.../resolve` `GET /complaints` |
| 财务 | `POST /screenings/:id/settle` `POST /deposits/recharge` `GET /deposits/logs` |
| 组织/场地 | `GET /orgs` `GET /credits` `GET/POST /venues` `POST /venues/:id/blacklist` `GET /onsite-managers` |
| 街道 | `GET /street/dashboard` `GET /screenings/:id/timeline` |

---

## 四、数据模型（围绕"同一场放映"聚合）

- `screenings` 场次主表（申请要素、审核结果、现场/财务结果、复盘标记、状态机）
- `timeline_events` 统一活动时间线（SUBMIT/AUDIT/EQUIP/ISSUE/SETUP/SCREEN/INCIDENT/RETURN/SETTLE…）
- `equipment_items / equipment_kit_items / equipment_scan_logs` 设备资产、场次成套清单、扫码流水
- `onsite_checks` 五项现场巡检（噪声按 65 dB(A) 自动判定，整改复测按最新记录生效）
- `incidents / incident_messages / complaints` 七类异常、六角色协同消息、投诉台账
- `volunteer_checkins` 志愿者签到签退
- `credit_records / deposit_transactions` 信用变动、押金流水（充值/冻结/扣赔/退还/补贴）
- `organizations / venues / venue_blacklist_records` 主办方信用押金、场地累计噪声/损坏与黑名单历史
- `users` 七类角色账号（JWT + RBAC）

场次状态机：
`SUBMITTED → APPROVED → EQUIPPED → ISSUED → SCREENING → FINISHED → RETURNED → SETTLED`
（另有 `REJECTED / CANCELED`）

### 关键业务规则

- **信用门槛**：信用分 < 60 禁止提交申请；核销时噪声 -10、设备损坏 -15、正常履约 +3。
- **押金**：提交时按申请额冻结；取消全额释放；核销时损坏赔付优先从冻结押金扣除，余款退还，补贴入账。
- **成套扫码**：备货把具体设备预占到场次，出库/归还逐件扫码，非本场清单一律拒绝，全部归还（含损坏）后才进入归还完成。
- **场地联动**：噪声投诉/设备损坏累计到场地，达到 3 次街道看板自动"建议拉黑"；拉黑后该场地新申请直接拦截。
- **噪声限值**：65 dB(A)，超标自动判不达标并阻断"验收开映"。

---

## 五、实际执行过的验证结论

- 后端 `tsc --noEmit` 类型检查 **0 错误**；前端 `vite build` **构建成功**。
- 用户态 PostgreSQL 15（端口 5433）正常建库建表（TypeORM synchronize），`npm run seed` 可重复写入演示数据。
- 后端服务在 http://localhost:3000/api 正常启动，九类账号 JWT 登录均通过。
- 前端 Vite 开发服务器在 http://localhost:5173 正常提供页面，`/api` 代理到 3000 端口验证通过。
- `node server/scripts/smoke.mjs` 端到端冒烟：**38 项检查全部通过（0 失败）**，覆盖上述完整业务生命周期与各项拦截/联动规则（最后一次运行结果：`SMOKE TEST PASSED`）。

> 说明：现场照片/试播截图以"文件 URL 或文件名文本"形式登记（`mediaUrl` 字段），未实现二进制上传；这是演示范围内的有意取舍，接口已为后续接入对象存储预留字段。

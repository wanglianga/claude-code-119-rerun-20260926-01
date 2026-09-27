<template>
  <div v-if="s">
    <div class="flex-between mb16" style="flex-wrap:wrap; gap:10px">
      <div>
        <h2 style="margin:0; font-size:18px">
          《{{ s.filmTitle }}》
          <span class="tag" :class="STATUS_LABELS[s.status]?.[1]" style="margin-left:6px">{{ STATUS_LABELS[s.status]?.[0] }}</span>
        </h2>
        <div class="muted small mt8 mono">{{ s.code }} ｜ {{ s.org?.name }} ｜ {{ s.venue?.name }}</div>
      </div>
      <RouterLink to="/" class="btn ghost sm">← 返回列表</RouterLink>
    </div>

    <div style="display:grid; grid-template-columns: 1.25fr 1fr; gap:16px; align-items:start">
      <div>
        <!-- 申请信息 -->
        <div class="card">
          <h3>申请信息</h3>
          <table>
            <tbody>
              <tr><th>放映时间</th><td>{{ fmtDate(s.screeningDate) }} 至 {{ fmtDate(s.endTime) }}</td></tr>
              <tr><th>场地 / 容量</th><td>{{ s.venue?.name }}（建议容量 {{ s.venue?.capacity }}，申报 {{ s.expectedAudience }} 人）</td></tr>
              <tr><th>供电条件</th><td>{{ s.powerCondition }}</td></tr>
              <tr><th>银幕尺寸</th><td>{{ s.screenSize }} 英寸</td></tr>
              <tr><th>音响 / 安保</th><td>{{ s.speakerCount }} 只音响 ｜ {{ s.securityStaffCount }} 名安保</td></tr>
              <tr><th>版权凭证</th><td>{{ s.copyrightProof }} <span v-if="s.copyrightConfirmed" class="tag green">授权已确认</span></td></tr>
              <tr><th>活动备案</th><td>{{ s.eventRecordNo || '待补录' }} <span v-if="s.recordConfirmed" class="tag green">备案已确认</span></td></tr>
              <tr><th>雨天预案</th><td style="white-space:pre-wrap">{{ s.rainPlan }}</td></tr>
              <tr><th>现场负责人</th><td>{{ s.onsiteManagerName || '待指派' }}</td></tr>
              <tr><th>冻结押金</th><td>{{ s.deposit }} 元</td></tr>
              <tr v-if="s.status==='SETTLED'"><th>赔付 / 补贴</th><td>赔付 {{ s.compensation }} ｜ 补贴 <b class="text-ok">{{ s.subsidy }}</b> ｜ <span :class="s.copyrightWrittenOff?'text-ok':'text-danger'">{{ s.copyrightWrittenOff ? '版权已核销' : '版权未核销' }}</span></td></tr>
              <tr v-if="s.reviewConclusion"><th>街道复盘结论</th><td>{{ s.reviewConclusion }}</td></tr>
            </tbody>
          </table>
        </div>

        <!-- 审核操作 -->
        <div class="card" v-if="isAuditor && ['SUBMITTED','AUDITING','REJECTED'].includes(s.status)">
          <h3>文化审核（确认影片授权与公共活动备案）</h3>
          <div class="flex gap8" style="flex-direction:column; align-items:stretch">
            <label class="flex gap8" style="margin:0"><input type="checkbox" style="width:auto" v-model="audit.copyrightConfirmed" /> 已核验影片版权授权真实有效</label>
            <label class="flex gap8" style="margin:0"><input type="checkbox" style="width:auto" v-model="audit.recordConfirmed" /> 已确认公共活动备案完成</label>
            <input v-model="audit.remark" placeholder="审核备注（可选）" />
            <div class="flex gap8">
              <button class="btn" @click="approve">审核通过</button>
              <button class="btn danger" @click="reject">驳回</button>
            </div>
          </div>
        </div>

        <!-- 指派现场负责人 -->
        <div class="card" v-if="['AUDITOR','STREET'].includes(auth.role) && ['APPROVED','EQUIPPED','ISSUED'].includes(s.status) && !s.onsiteManagerId">
          <h3>指派现场负责人</h3>
          <div class="flex gap8">
            <select v-model="assignId">
              <option value="" disabled>选择现场负责人</option>
              <option v-for="m in managers" :key="m.id" :value="m.id">{{ m.name }}（{{ m.phone }}）</option>
            </select>
            <button class="btn" :disabled="!assignId" @click="assign">指派</button>
          </div>
        </div>

        <!-- 仓库备货与扫码 -->
        <div class="card" v-if="['WAREHOUSE','ONSITE'].includes(auth.role) || ['EQUIPPED','ISSUED','SETUP','SCREENING','FINISHED','RETURNED'].includes(s.status)">
          <h3>仓库成套设备（六类）</h3>
          <div v-if="auth.role==='WAREHOUSE' && s.status==='APPROVED'">
            <button class="btn" @click="prepareKit">按成套清单备货（自动预占库存）</button>
            <span class="muted small" style="margin-left:8px">投影机×1 幕布×1 音箱×{{ s.speakerCount }} 电缆×2 灯泡×1 防雨罩×1</span>
          </div>
          <table v-if="kit.length">
            <thead><tr><th>类别</th><th>条码</th><th>状态</th><th>备注</th></tr></thead>
            <tbody>
              <tr v-for="k in kit" :key="k.id">
                <td>{{ EQUIP_LABELS[k.category] }}</td>
                <td class="mono small">{{ k.equipmentItem?.qrCode || '—' }}</td>
                <td><span class="tag" :class="kitTag(k.status)[1]">{{ kitTag(k.status)[0] }}</span></td>
                <td class="small">{{ k.remark }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="['WAREHOUSE','ONSITE'].includes(auth.role) && (s.status==='EQUIPPED' || s.status==='ISSUED' || s.status==='SETUP' || s.status==='SCREENING' || s.status==='FINISHED')">
            <div class="flex gap8 mt16" style="flex-wrap:wrap">
              <input v-model="scanCode" placeholder="扫描/输入设备条码，如 PJ-0001" style="flex:1; min-width:200px" />
              <button class="btn" :disabled="!canIssue" @click="doScan('ISSUE')">扫码领取</button>
              <button class="btn ghost" :disabled="s.status==='EQUIPPED'" @click="doScan('RETURN', false)">完好归还</button>
              <button class="btn danger" :disabled="s.status==='EQUIPPED'" @click="doScan('RETURN', true)">损坏归还</button>
            </div>
            <div class="muted small mt8">
              出库进度 {{ issueDone }}/{{ kit.length }}；
              <span v-if="s.status==='EQUIPPED'">全部成套扫码一致后自动出库</span>
              <span v-else>归还进度 {{ returnDone }}/{{ kit.length }}（含损坏 {{ damagedCount }} 件）</span>
            </div>
          </div>
        </div>

        <!-- 现场巡检 -->
        <div class="card" v-if="['ONSITE','SECURITY'].includes(auth.role) || checks.length">
          <h3>放映当天现场巡检</h3>
          <div v-if="['ISSUED','SETUP','SCREENING'].includes(s.status) && ['ONSITE','SECURITY'].includes(auth.role)">
            <div class="flex gap8" style="flex-wrap:wrap">
              <select v-model="check.type" style="width:150px">
                <option v-for="[v,l] in CHECK_TYPES" :key="v" :value="v">{{ l }}</option>
              </select>
              <input v-if="check.type==='NOISE'" v-model.number="check.dbValue" type="number" step="0.1" placeholder="分贝 dB(A)，限值65" style="width:170px" />
              <input v-if="['SETUP_PHOTO','TEST_PLAY'].includes(check.type)" v-model="check.mediaUrl" placeholder="照片/截图文件URL或文件名" style="flex:1; min-width:180px" />
              <input v-model="check.note" :placeholder="check.type==='NOISE'?'情况说明（可选）':'现场情况说明'" style="flex:1; min-width:180px" />
              <button class="btn" @click="reportCheck">上报</button>
            </div>
          </div>
          <table v-if="checks.length" class="mt16">
            <thead><tr><th>巡检项</th><th>读数/凭证</th><th>结论</th><th>上报人</th><th>时间</th></tr></thead>
            <tbody>
              <tr v-for="c in latestChecks" :key="c.id">
                <td>{{ CHECK_LABELS[c.type] }}</td>
                <td class="small">{{ c.dbValue != null ? c.dbValue + ' dB(A)' : (c.mediaUrl || '—') }}<div v-if="c.note" class="muted">{{ c.note }}</div></td>
                <td><span class="tag" :class="c.qualified?'green':'red'">{{ c.qualified?'达标':'不达标' }}</span></td>
                <td class="small">{{ c.reporterName }}</td>
                <td class="small">{{ fmtTime(c.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="auth.role==='ONSITE'" class="mt16 flex gap8" style="flex-wrap:wrap">
            <button v-if="['ISSUED','SETUP'].includes(s.status)" class="btn" @click="completeSetup">五项达标，验收并开始放映</button>
            <button v-if="s.status==='SCREENING'" class="btn" @click="finish">放映结束</button>
          </div>
        </div>

        <!-- 志愿者签到 -->
        <div class="card" v-if="['APPLICANT','ONSITE','STREET'].includes(auth.role) && showVolunteers">
          <h3>志愿者签到</h3>
          <div v-if="['APPLICANT','ONSITE'].includes(auth.role)" class="flex gap8 mb16" style="flex-wrap:wrap">
            <input v-model="vol.name" placeholder="志愿者姓名" style="width:120px" />
            <input v-model="vol.phone" placeholder="手机号" style="width:130px" />
            <input v-model="vol.post" placeholder="岗位（引导/秩序/后勤）" style="width:170px" />
            <button class="btn" @click="checkin">签到</button>
          </div>
          <table v-if="volunteers.length">
            <thead><tr><th>姓名</th><th>电话</th><th>岗位</th><th>签到</th><th>签退</th><th></th></tr></thead>
            <tbody>
              <tr v-for="v in volunteers" :key="v.id">
                <td>{{ v.name }}</td><td class="small">{{ v.phone }}</td><td>{{ v.post }}</td>
                <td class="small">{{ fmtTime(v.checkinAt) }}</td>
                <td class="small">{{ v.checkoutAt ? fmtTime(v.checkoutAt) : '—' }}</td>
                <td><button v-if="!v.checkedOut && ['APPLICANT','ONSITE'].includes(auth.role)" class="btn ghost sm" @click="checkout(v.id)">签退</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 异常协同 -->
        <div class="card">
          <h3>异常协同处理（申请方/审核员/仓库/现场/安保/财务）</h3>
          <div v-if="canCreateIncident" class="flex gap8 mb16" style="flex-wrap:wrap">
            <select v-model="inc.type" style="width:170px">
              <option v-for="[v,l] in INCIDENT_TYPES" :key="v" :value="v">{{ l }}</option>
            </select>
            <input v-model="inc.description" placeholder="异常情况描述" style="flex:1; min-width:220px" />
            <button class="btn danger" @click="createIncident">上报异常</button>
          </div>
          <div v-if="!incidents.length" class="empty">暂无异常，放映秩序正常</div>
          <div v-for="ic in incidents" :key="ic.id" class="incident-box">
            <div class="flex-between">
              <div>
                <span class="tag" :class="ic.status==='RESOLVED'?'green':(ic.status==='PROCESSING'?'orange':'red')">
                  {{ {OPEN:'待处理',PROCESSING:'处理中',RESOLVED:'已解决',CLOSED:'已关闭'}[ic.status] }}
                </span>
                <b style="margin-left:8px">{{ INCIDENT_LABELS[ic.type] }}</b>
                <span class="muted small">（严重 {{ ic.severity }} 级 · {{ ic.reporterName }} {{ fmtTime(ic.createdAt) }}）</span>
              </div>
            </div>
            <div class="chat mt8">
              <div v-for="m in ic.messages" :key="m.id" class="bubble" :class="{ mine: m.senderName === auth.user.name }">
                <div class="who">{{ m.senderName }} · {{ ROLE_LABELS[m.senderRole] }}<span class="when">{{ fmtTime(m.createdAt) }}</span></div>
                <div>{{ m.content }}</div>
              </div>
            </div>
            <div v-if="ic.status !== 'RESOLVED'" class="mt8">
              <div class="flex gap8">
                <input v-model="replyMap[ic.id]" placeholder="围绕该异常协同回复…" @keyup.enter="reply(ic.id)" />
                <button class="btn ghost" @click="reply(ic.id)">发送</button>
              </div>
              <div class="flex gap8 mt8" style="flex-wrap:wrap">
                <input v-model="resolveMap[ic.id]" placeholder="填写处理结果并关闭" style="flex:1; min-width:220px" />
                <button class="btn" @click="resolveIncident(ic.id, {})">解决并关闭</button>
                <button v-if="ic.type==='NOISE_COMPLAINT'" class="btn ghost" @click="resolveNoise(ic.id)">噪声投诉解决（含回访）</button>
                <template v-if="ic.type==='EXTENSION_REQ'">
                  <button class="btn" @click="resolveIncident(ic.id, { approved:true })">批准延长并关闭</button>
                  <button class="btn gray" @click="resolveIncident(ic.id, { approved:false })">驳回延长</button>
                </template>
              </div>
            </div>
            <div v-else class="small text-ok mt8">处理结果：{{ ic.resolution }}</div>
          </div>
        </div>
      </div>

      <!-- 右侧：时间线 + 财务核销 -->
      <div style="position:sticky; top:16px">
        <div class="card" v-if="['FINANCE','STREET'].includes(auth.role) && ['FINISHED','RETURNED'].includes(s.status)">
          <h3>财务核销结算</h3>
          <div class="form-row">
            <div><label>损坏赔付（元）</label><input v-model="settle.compensation" type="number" step="0.01" /></div>
            <div><label>补贴金额（元）</label><input v-model="settle.subsidy" type="number" step="0.01" /></div>
          </div>
          <label class="flex gap8" style="margin:0 0 10px"><input type="checkbox" style="width:auto" v-model="settle.copyrightWriteOff" /> 同步完成版权核销</label>
          <textarea v-model="settle.reviewConclusion" rows="2" placeholder="街道复盘结论：该场地是否适合继续安排夜间活动" style="margin-bottom:10px"></textarea>
          <button class="btn" style="width:100%" @click="doSettle">统一核销（赔付/押金/补贴/信用联动）</button>
          <div class="muted small mt8">噪声问题信用 -10、设备损坏 -15；正常履约 +3</div>
        </div>

        <div class="card">
          <h3>活动时间线（街道追踪）</h3>
          <div class="timeline">
            <div v-for="e in timeline" :key="e.id" class="tl-item" :class="{ incident: e.phase==='INCIDENT' }">
              <div class="t">{{ e.title }}</div>
              <div class="m">{{ PHASE_LABELS[e.phase] || e.phase }} · {{ e.actorName }}（{{ ROLE_LABELS[e.actorRole] }}） · {{ fmtTime(e.createdAt) }}</div>
              <div v-if="e.detail" class="d">{{ e.detail }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="empty">加载中…</div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { http, toast } from '../api';
import { useAuthStore } from '../stores/auth';
import {
  CHECK_LABELS, CHECK_TYPES, EQUIP_LABELS, INCIDENT_LABELS, INCIDENT_TYPES,
  PHASE_LABELS, ROLE_LABELS, STATUS_LABELS, fmtDate, fmtTime,
} from '../constants';

const route = useRoute();
const id = route.params.id;
const auth = useAuthStore();
const isAuditor = computed(() => auth.role === 'AUDITOR');

const s = ref(null);
const timeline = ref([]);
const kit = ref([]);
const checks = ref([]);
const incidents = ref([]);
const volunteers = ref([]);
const managers = ref([]);

const audit = reactive({ copyrightConfirmed: false, recordConfirmed: false, remark: '' });
const assignId = ref('');
const scanCode = ref('');
const check = reactive({ type: 'SETUP_PHOTO', dbValue: null, mediaUrl: '', note: '' });
const vol = reactive({ name: '', phone: '', post: '' });
const inc = reactive({ type: 'NOISE_COMPLAINT', description: '' });
const replyMap = reactive({});
const resolveMap = reactive({});
const settle = reactive({ compensation: '0', subsidy: '0', copyrightWriteOff: true, reviewConclusion: '' });

const showVolunteers = computed(() =>
  ['ISSUED','SETUP','SCREENING','FINISHED','RETURNED','SETTLED'].includes(s.value?.status));
const canIssue = computed(() => ['EQUIPPED'].includes(s.value?.status) || issueDone.value < kit.value.length);
const issueDone = computed(() => kit.value.filter((k) => k.status === 'SCANNED' || k.status === 'DAMAGED').length);
const returnDone = computed(() => kit.value.filter((k) => k.status === 'SCANNED' || k.status === 'DAMAGED').length);
const damagedCount = computed(() => kit.value.filter((k) => k.status === 'DAMAGED').length);
const canCreateIncident = computed(() =>
  ['APPROVED','EQUIPPED','ISSUED','SETUP','SCREENING','FINISHED'].includes(s.value?.status) &&
  ['APPLICANT','AUDITOR','WAREHOUSE','ONSITE','SECURITY','FINANCE'].includes(auth.role));

const latestChecks = computed(() => {
  const map = new Map();
  [...checks.value].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((c) => map.set(c.type, c));
  return [...map.values()];
});

function kitTag(st) {
  return { PREPARED: ['已备好', 'orange'], SCANNED: ['已核对', 'green'], DAMAGED: ['损坏', 'red'], PENDING: ['待备', 'gray'], MISSING: ['缺件', 'red'] }[st] || [st, 'gray'];
}

async function loadAll() {
  s.value = await http.get(`/screenings/${id}`);
  const [tl, k, ck, ic, vo] = await Promise.all([
    http.get(`/screenings/${id}/timeline`),
    http.get(`/screenings/${id}/kit`),
    http.get(`/screenings/${id}/onsite/checks`),
    http.get(`/screenings/${id}/incidents`),
    http.get(`/screenings/${id}/onsite/volunteers`),
  ]);
  timeline.value = tl;
  kit.value = k;
  checks.value = ck;
  incidents.value = ic;
  volunteers.value = vo;
  if (damagedCount.value) settle.compensation = String(damagedCount.value * 300);
}
onMounted(async () => {
  await loadAll();
  if (['AUDITOR', 'STREET'].includes(auth.role)) {
    managers.value = await http.get('/onsite-managers');
  }
});

async function approve() {
  await http.post(`/screenings/${id}/audit/approve`, audit);
  toast('审核通过');
  await loadAll();
}
async function reject() {
  const reason = prompt('请输入驳回原因');
  if (!reason) return;
  await http.post(`/screenings/${id}/audit/reject`, { reason });
  toast('已驳回', 'err');
  await loadAll();
}
async function assign() {
  await http.post(`/screenings/${id}/assign-onsite`, { onsiteManagerId: assignId.value });
  toast('已指派现场负责人');
  await loadAll();
}
async function prepareKit() {
  kit.value = await http.post(`/screenings/${id}/kit/prepare`, {});
  toast('成套备货完成，库存已预占');
  await loadAll();
}
async function doScan(action, damaged) {
  if (!scanCode.value.trim()) return toast('请输入条码', 'err');
  await http.post(`/screenings/${id}/scan`, {
    qrCode: scanCode.value.trim(), action, damaged: !!damaged,
    remark: damaged ? '归还时登记损坏' : undefined,
  });
  toast(action === 'ISSUE' ? '扫码核对一致' : (damaged ? '已登记损坏' : '已完好归还'));
  scanCode.value = '';
  await loadAll();
}
async function reportCheck() {
  const body = { type: check.type, note: check.note };
  if (check.type === 'NOISE') {
    if (check.dbValue == null) return toast('请输入分贝读数', 'err');
    body.dbValue = Number(check.dbValue);
  }
  if (['SETUP_PHOTO', 'TEST_PLAY'].includes(check.type)) body.mediaUrl = check.mediaUrl;
  await http.post(`/screenings/${id}/onsite/checks`, body);
  toast('巡检已上报');
  check.note = ''; check.mediaUrl = ''; check.dbValue = null;
  await loadAll();
}
async function completeSetup() {
  await http.post(`/screenings/${id}/onsite/complete-setup`, {});
  toast('验收通过，放映开始');
  await loadAll();
}
async function finish() {
  await http.post(`/screenings/${id}/onsite/finish`, { note: '现场操作放映结束' });
  toast('放映已结束');
  await loadAll();
}
async function checkin() {
  if (!vol.name) return toast('请填写志愿者姓名', 'err');
  await http.post(`/screenings/${id}/onsite/volunteers`, { ...vol });
  toast('签到成功');
  vol.name = vol.phone = vol.post = '';
  await loadAll();
}
async function checkout(vid) {
  await http.post(`/screenings/${id}/onsite/volunteers/${vid}/checkout`, {});
  await loadAll();
}
async function createIncident() {
  if (!inc.description.trim()) return toast('请描述异常情况', 'err');
  await http.post(`/screenings/${id}/incidents`, { ...inc });
  toast('异常已上报，相关角色可协同处理', 'err');
  inc.description = '';
  await loadAll();
}
async function reply(iid) {
  const content = replyMap[iid];
  if (!content?.trim()) return;
  await http.post(`/incidents/${iid}/messages`, { content });
  replyMap[iid] = '';
  await loadAll();
}
async function resolveIncident(iid, extra) {
  const resolution = resolveMap[iid];
  if (!resolution?.trim()) return toast('请填写处理结果', 'err');
  await http.post(`/incidents/${iid}/resolve`, { resolution, ...extra });
  toast('异常已解决关闭');
  resolveMap[iid] = '';
  await loadAll();
}
async function resolveNoise(iid) {
  const resolution = resolveMap[iid] || '降低音量并电话回访投诉居民，居民表示接受';
  const complainant = prompt('投诉居民联系方式/回访记录', '3号楼居民（已电话回访）');
  await http.post(`/incidents/${iid}/resolve`, {
    resolution, complainant: complainant || '', handleResult: resolution,
  });
  toast('噪声投诉已处理并归档');
  resolveMap[iid] = '';
  await loadAll();
}
async function doSettle() {
  await http.post(`/screenings/${id}/settle`, { ...settle });
  toast('场次核销结算完成');
  await loadAll();
}
</script>

<style scoped>
.incident-box {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
  background: #fcfdff;
}
</style>

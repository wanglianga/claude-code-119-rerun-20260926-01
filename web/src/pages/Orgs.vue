<template>
  <div>
    <h2 style="margin:0 0 16px; font-size:18px">主办方信用与押金</h2>

    <div class="card">
      <h3>主办方台账（信用记录影响申请资格）</h3>
      <table>
        <thead>
          <tr><th>主办方</th><th>类型</th><th>信用分</th><th>押金余额(元)</th><th>账户</th><th style="width:150px">押金充值</th></tr>
        </thead>
        <tbody>
          <tr v-for="o in rows" :key="o.id">
            <td><b>{{ o.name }}</b></td>
            <td>{{ ORG_TYPE_LABELS[o.type] }}</td>
            <td>
              <span class="tag" :class="o.creditScore>=80?'green':(o.creditScore>=60?'orange':'red')">{{ o.creditScore }}</span>
              <span v-if="o.creditScore<60" class="small text-danger"> 已禁申</span>
            </td>
            <td>{{ o.depositBalance }}</td>
            <td><span class="tag" :class="o.active?'green':'gray'">{{ o.active ? '启用' : '停用' }}</span></td>
            <td>
              <div class="flex gap8">
                <input v-model="rechargeMap[o.id]" type="number" placeholder="金额" style="width:80px" />
                <button
                  class="btn sm"
                  :disabled="!canRecharge(o)"
                  @click="recharge(o)"
                >充值</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="muted small mt8">信用规则：正常履约 +3；噪声投诉 -10；设备损坏 -15。低于 60 分不可提交新申请。</div>
    </div>

    <div class="card">
      <h3>信用变动记录</h3>
      <table>
        <thead><tr><th>时间</th><th>主办方</th><th>变动</th><th>原因</th><th>操作人</th></tr></thead>
        <tbody>
          <tr v-for="r in credits" :key="r.id">
            <td class="small">{{ fmtTime(r.createdAt) }}</td>
            <td class="small">{{ orgName(r.orgId) }}</td>
            <td><b :class="r.delta>=0?'text-ok':'text-danger'">{{ r.delta>=0?'+':'' }}{{ r.delta }}</b></td>
            <td class="small">{{ r.reason }}</td>
            <td class="small">{{ r.operatorName }}</td>
          </tr>
          <tr v-if="!credits.length"><td colspan="5"><div class="empty">暂无信用变动</div></td></tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3>押金流水</h3>
      <table>
        <thead><tr><th>时间</th><th>类型</th><th>金额(元)</th><th>备注</th><th>操作人</th></tr></thead>
        <tbody>
          <tr v-for="d in deposits" :key="d.id">
            <td class="small">{{ fmtTime(d.createdAt) }}</td>
            <td><span class="tag" :class="depTag(d.type)[1]">{{ depTag(d.type)[0] }}</span></td>
            <td>{{ d.amount }}</td>
            <td class="small">{{ d.remark }}</td>
            <td class="small">{{ d.operatorName }}</td>
          </tr>
          <tr v-if="!deposits.length"><td colspan="5"><div class="empty">暂无押金流水</div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { http, toast } from '../api';
import { useAuthStore } from '../stores/auth';
import { ORG_TYPE_LABELS, fmtTime } from '../constants';

const auth = useAuthStore();
const rows = ref([]);
const credits = ref([]);
const deposits = ref([]);
const rechargeMap = reactive({});

function orgName(id) {
  return rows.value.find((o) => o.id === id)?.name || id.slice(0, 8);
}
function canRecharge(o) {
  return auth.role === 'FINANCE' || (auth.role === 'APPLICANT' && auth.user.orgId === o.id);
}
function depTag(t) {
  return { RECHARGE: ['充值', 'green'], FREEZE: ['冻结', 'orange'], DEDUCT: ['扣赔', 'red'], RELEASE: ['退还', 'blue'], SUBSIDY: ['补贴', 'green'] }[t] || [t, 'gray'];
}

onMounted(async () => {
  rows.value = await http.get('/orgs');
  credits.value = await http.get('/credits');
  deposits.value = await http.get('/deposits/logs');
});

async function recharge(o) {
  const amount = String(rechargeMap[o.id] || '');
  if (!Number(amount) || Number(amount) <= 0) return toast('请输入有效金额', 'err');
  await http.post('/deposits/recharge', { orgId: o.id, amount });
  toast(`已为「${o.name}」充值 ${amount} 元`);
  rechargeMap[o.id] = '';
  rows.value = await http.get('/orgs');
  deposits.value = await http.get('/deposits/logs');
}
</script>

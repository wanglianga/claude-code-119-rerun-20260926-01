<template>
  <el-card header="活动主办方信用记录与设备押金">
    <el-alert type="info" :closable="false" style="margin-bottom: 12px"
      title="信用分初始 100 分：核销时按噪声超标、投诉、超员、缺件、赔付等扣减，零异常加 2 分；低于 60 分自动暂停申请资格。设备赔付优先从押金扣除。" />
    <el-table :data="orgs" v-loading="loading">
      <el-table-column prop="name" label="主办方" min-width="180" />
      <el-table-column label="类型" width="110"><template #default="{ row }">{{ ORG_TYPE[row.type] }}</template></el-table-column>
      <el-table-column prop="contactName" label="联系人" width="110" />
      <el-table-column prop="contactPhone" label="联系电话" width="130" />
      <el-table-column label="信用分" width="110">
        <template #default="{ row }">
          <el-progress :percentage="row.creditScore" :status="row.creditScore < 60 ? 'exception' : row.creditScore < 80 ? 'warning' : 'success'" :stroke-width="14" />
        </template>
      </el-table-column>
      <el-table-column label="押金余额" width="120"><template #default="{ row }">¥{{ row.depositBalance }}</template></el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }"><el-tag :type="row.status === 'SUSPENDED' ? 'danger' : 'success'" size="small">{{ row.status === 'SUSPENDED' ? '已暂停申请' : '正常' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="230">
        <template #default="{ row }">
          <el-button size="small" @click="showCredit(row)">信用明细</el-button>
          <el-button v-if="isFinance" size="small" type="warning" @click="depositDialog(row)">收取押金</el-button>
          <el-button v-if="isFinance" size="small" @click="refundDialog(row)">退押金</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="creditVisible" :title="`信用变动明细 - ${current?.name}`" width="640px">
      <el-timeline>
        <el-timeline-item v-for="r in creditRows" :key="r.id" :timestamp="fmt(r.createdAt)" placement="top"
          :type="r.delta < 0 ? 'danger' : 'success'">
          <el-tag :type="r.delta < 0 ? 'danger' : 'success'" size="small">{{ r.delta > 0 ? `+${r.delta}` : r.delta }}</el-tag>
          <b style="margin-left: 8px">{{ r.reason }}</b>
          <div style="color:#909399;font-size:12px">变动后信用分：{{ r.balanceAfter }}<span v-if="r.sessionId"> · 关联场次 {{ r.sessionId.slice(0, 8) }}</span></div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-if="!creditRows.length" description="暂无信用变动记录（首场核销后生成）" />
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';
import { ORG_TYPE } from '../constants';
import { useAuthStore } from '../store';

const auth = useAuthStore();
const isFinance = auth.user?.role === 'FINANCE';
const orgs = ref<any[]>([]);
const loading = ref(false);
const creditVisible = ref(false);
const current = ref<any>(null);
const creditRows = ref<any[]>([]);

function fmt(t: string) { return new Date(t).toLocaleString('zh-CN', { hour12: false }); }
async function load() {
  loading.value = true;
  const { data } = await api.get('/organizations');
  orgs.value = data;
  loading.value = false;
}
async function showCredit(row: any) {
  current.value = row;
  const { data } = await api.get(`/organizations/${row.id}/credit-records`);
  creditRows.value = data;
  creditVisible.value = true;
}
async function depositDialog(row: any) {
  const { value } = await ElMessageBox.prompt(`向「${row.name}」收取设备押金（元）`, '押金收取', { inputValue: '2000' });
  await api.post(`/finance/deposit/${row.id}`, { amount: Number(value), remark: '设备押金收取' });
  ElMessage.success('押金已收取');
  await load();
}
async function refundDialog(row: any) {
  const { value } = await ElMessageBox.prompt(`退还「${row.name}」押金（余额 ¥${row.depositBalance}）`, '押金退还', { inputValue: String(row.depositBalance) });
  await api.post(`/finance/deposit-refund/${row.id}`, { amount: Number(value), remark: '设备押金退还' });
  ElMessage.success('押金已退还');
  await load();
}
onMounted(load);
</script>

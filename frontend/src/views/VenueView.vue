<template>
  <el-card header="放映场地与黑名单（连续噪声/损坏点位影响下一轮审批）">
    <el-alert type="warning" :closable="false" style="margin-bottom: 12px"
      title="规则：核销时噪声超标累计噪声次数、设备赔付累计损坏次数；噪声累计 3 次系统自动拉黑；街道/审核员也可手动拉黑或解除。" />
    <el-table :data="venues" v-loading="loading">
      <el-table-column prop="name" label="场地名称" min-width="160" />
      <el-table-column prop="address" label="地址" min-width="200" />
      <el-table-column prop="maxAudience" label="容量(人)" width="90" />
      <el-table-column prop="powerCondition" label="供电条件" min-width="180" show-overflow-tooltip />
      <el-table-column label="噪声次数" width="90">
        <template #default="{ row }"><el-tag :type="row.noiseEventCount >= 2 ? 'danger' : 'info'" size="small">{{ row.noiseEventCount }}</el-tag></template>
      </el-table-column>
      <el-table-column label="损坏次数" width="90">
        <template #default="{ row }"><el-tag :type="row.damageEventCount >= 2 ? 'danger' : 'info'" size="small">{{ row.damageEventCount }}</el-tag></template>
      </el-table-column>
      <el-table-column label="黑名单状态" width="110">
        <template #default="{ row }"><el-tag :type="row.blacklisted ? 'danger' : 'success'" size="small">{{ row.blacklisted ? '已拉黑' : '可申请' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="拉黑原因/来源" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.blacklisted">{{ row.blacklistReason }}（{{ row.blacklistSource }}）</span>
          <span v-else style="color:#c0c4cc">—</span>
        </template>
      </el-table-column>
      <el-table-column v-if="canManage" label="操作" width="120">
        <template #default="{ row }">
          <el-button v-if="!row.blacklisted" size="small" type="danger" @click="toggle(row, true)">拉黑</el-button>
          <el-button v-else size="small" type="success" @click="toggle(row, false)">解除拉黑</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';
import { useAuthStore } from '../store';

const auth = useAuthStore();
const canManage = ['STREET_ADMIN', 'CULTURE_REVIEWER'].includes(auth.user?.role || '');
const venues = ref<any[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  const { data } = await api.get('/venues');
  venues.value = data;
  loading.value = false;
}
async function toggle(row: any, blacklisted: boolean) {
  let reason = '';
  if (blacklisted) {
    const r = await ElMessageBox.prompt('请填写拉黑原因（如连续夜间噪声扰民）', '场地拉黑', { inputType: 'textarea' });
    reason = r.value;
  } else {
    await ElMessageBox.confirm(`确认解除「${row.name}」黑名单？解除后可重新安排夜间活动`, '解除确认', { type: 'warning' });
  }
  await api.post(`/venues/${row.id}/blacklist`, { blacklisted, reason });
  ElMessage.success(blacklisted ? '场地已拉黑，新申请将被拦截' : '已解除黑名单');
  await load();
}
onMounted(load);
</script>

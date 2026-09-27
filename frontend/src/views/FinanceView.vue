<template>
  <el-card header="财务记录（押金 / 赔付 / 补贴）">
    <el-table :data="records" v-loading="loading">
      <el-table-column label="时间" width="180"><template #default="{ row }">{{ fmt(row.createdAt) }}</template></el-table-column>
      <el-table-column label="主办方" min-width="180">
        <template #default="{ row }">{{ orgName(row.organizationId) }}</template>
      </el-table-column>
      <el-table-column label="类型" width="110"><template #default="{ row }"><el-tag size="small">{{ FINANCE_TYPE[row.type] }}</el-tag></template></el-table-column>
      <el-table-column label="金额" width="120">
        <template #default="{ row }">
          <b :style="{ color: ['COMPENSATION', 'DEPOSIT'].includes(row.type) ? '#f56c6c' : '#67c23a' }">
            {{ ['SUBSIDY', 'DEPOSIT_REFUND'].includes(row.type) ? '+' : '-' }}¥{{ row.amount }}
          </b>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }"><el-tag :type="row.status === 'PAID' ? 'success' : row.status === 'PENDING' ? 'danger' : 'info'" size="small">{{ { PAID: '已发放', PENDING: '待补缴', CONFIRMED: '已确认' }[row.status] }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="remark" label="说明" min-width="260" show-overflow-tooltip />
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';
import { FINANCE_TYPE } from '../constants';

const records = ref<any[]>([]);
const orgs = ref<any[]>([]);
const loading = ref(false);
function fmt(t: string) { return new Date(t).toLocaleString('zh-CN', { hour12: false }); }
function orgName(id: string) { return orgs.value.find(o => o.id === id)?.name || id.slice(0, 8); }
onMounted(async () => {
  loading.value = true;
  const [r, o] = await Promise.all([api.get('/finance/records'), api.get('/organizations')]);
  records.value = r.data;
  orgs.value = o.data;
  loading.value = false;
});
</script>

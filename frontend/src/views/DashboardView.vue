<template>
  <div v-loading="loading">
    <el-row :gutter="14">
      <el-col :span="6" v-for="c in cards" :key="c.label">
        <el-card shadow="hover" class="stat">
          <div class="stat-num" :style="{ color: c.color }">{{ c.value }}</div>
          <div class="stat-label">{{ c.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="14" style="margin-top: 14px">
      <el-col :span="12">
        <el-card header="各状态场次分布">
          <div v-for="(n, st) in data.statusCount" :key="st" class="bar-row">
            <el-tag :type="STATUS_TYPE[st] || 'info'" size="small" style="width: 120px; text-align: center">{{ STATUS_LABELS[st] || st }}</el-tag>
            <el-progress :percentage="pct(n)" :stroke-width="16" style="flex: 1" :show-text="false" />
            <span class="bar-num">{{ n }}</span>
          </div>
          <el-empty v-if="!Object.keys(data.statusCount || {}).length" description="暂无场次" :image-size="60" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card header="设备概况">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="设备总数">{{ data.equipment?.total }}</el-descriptions-item>
            <el-descriptions-item label="空闲">{{ data.equipment?.idle }}</el-descriptions-item>
            <el-descriptions-item label="已预留">{{ data.equipment?.reserved }}</el-descriptions-item>
            <el-descriptions-item label="出库使用中">{{ data.equipment?.inUse }}</el-descriptions-item>
            <el-descriptions-item label="损坏/遗失">
              <el-tag type="danger" size="small">{{ data.equipment?.damaged }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="未闭环异常">
              <el-tag type="warning" size="small">{{ data.openIncidentCount }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="14" style="margin-top: 14px">
      <el-col :span="12">
        <el-card header="⚠️ 风险点位（连续噪声/设备损坏影响下一轮审批）">
          <el-table :data="data.riskVenues" size="small">
            <el-table-column prop="name" label="场地" />
            <el-table-column prop="noiseEventCount" label="噪声次数" width="80">
              <template #default="{ row }"><el-tag :type="row.noiseEventCount >= 2 ? 'danger' : 'info'" size="small">{{ row.noiseEventCount }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="damageEventCount" label="损坏次数" width="80">
              <template #default="{ row }"><el-tag :type="row.damageEventCount >= 2 ? 'danger' : 'info'" size="small">{{ row.damageEventCount }}</el-tag></template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }"><el-tag v-if="row.blacklisted" type="danger" size="small">已拉黑</el-tag><el-tag v-else type="warning" size="small">观察中</el-tag></template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!(data.riskVenues || []).length" description="暂无风险点位" :image-size="60" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card header="🏢 信用预警主办方（<80 分或已暂停）">
          <el-table :data="data.lowCreditOrgs" size="small">
            <el-table-column prop="name" label="主办方" />
            <el-table-column prop="creditScore" label="信用分" width="90">
              <template #default="{ row }"><b :style="{ color: row.creditScore < 60 ? '#f56c6c' : '#e6a23c' }">{{ row.creditScore }}</b></template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }"><el-tag :type="row.status === 'SUSPENDED' ? 'danger' : 'warning'" size="small">{{ row.status === 'SUSPENDED' ? '已暂停申请' : '观察中' }}</el-tag></template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!(data.lowCreditOrgs || []).length" description="所有主办方信用良好" :image-size="60" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import { STATUS_LABELS, STATUS_TYPE } from '../constants';

const loading = ref(true);
const data = reactive<any>({ statusCount: {}, riskVenues: [], lowCreditOrgs: [], equipment: {} });

const cards = computed(() => [
  { label: '放映场次总数', value: data.sessionTotal, color: '#409eff' },
  { label: '未闭环异常', value: data.openIncidentCount, color: '#e6a23c' },
  { label: '风险点位', value: (data.riskVenues || []).length, color: '#f56c6c' },
  { label: '信用预警主办方', value: (data.lowCreditOrgs || []).length, color: '#909399' },
]);

function pct(n: number) {
  return data.sessionTotal ? Math.round((n / data.sessionTotal) * 100) : 0;
}

onMounted(async () => {
  const { data: ov } = await api.get('/dashboard/overview');
  Object.assign(data, ov);
  loading.value = false;
});
</script>

<style scoped>
.stat { text-align: center; }
.stat-num { font-size: 34px; font-weight: 700; }
.stat-label { color: #909399; margin-top: 4px; }
.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.bar-num { width: 28px; text-align: right; font-weight: 600; }
</style>

<template>
  <el-card>
    <div style="margin-bottom: 12px; display: flex; gap: 10px">
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 160px" @change="load">
        <el-option value="OPEN" label="待处理" />
        <el-option value="PROCESSING" label="协同处理中" />
        <el-option value="CLOSED" label="已关闭" />
      </el-select>
      <el-select v-model="typeFilter" placeholder="全部类型" clearable style="width: 180px" @change="load">
        <el-option v-for="(label, key) in INCIDENT_LABELS" :key="key" :value="key" :label="label" />
      </el-select>
    </div>
    <el-table :data="incidents" v-loading="loading">
      <el-table-column label="状态" width="120">
        <template #default="{ row }"><el-tag :type="INCIDENT_STATUS[row.status].type" size="small">{{ INCIDENT_STATUS[row.status].label }}</el-tag></template>
      </el-table-column>
      <el-table-column label="类型" width="150"><template #default="{ row }">{{ INCIDENT_LABELS[row.type] }}</template></el-table-column>
      <el-table-column prop="description" label="情况说明" min-width="260" show-overflow-tooltip />
      <el-table-column label="所属场次" width="190">
        <template #default="{ row }">
          <el-link type="primary" @click="$router.push(`/sessions/${row.sessionId}`)">{{ row.session?.code }} 《{{ row.session?.title }}》</el-link>
        </template>
      </el-table-column>
      <el-table-column label="上报时间" width="170"><template #default="{ row }">{{ fmt(row.createdAt) }}</template></el-table-column>
      <el-table-column label="处理结果" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">{{ row.resolution || '—' }}</template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';
import { INCIDENT_LABELS, INCIDENT_STATUS } from '../constants';

const incidents = ref<any[]>([]);
const loading = ref(false);
const statusFilter = ref('');
const typeFilter = ref('');
function fmt(t: string) { return new Date(t).toLocaleString('zh-CN', { hour12: false }); }
async function load() {
  loading.value = true;
  const params: any = {};
  if (statusFilter.value) params.status = statusFilter.value;
  if (typeFilter.value) params.type = typeFilter.value;
  const { data } = await api.get('/incidents', { params });
  incidents.value = data;
  loading.value = false;
}
onMounted(load);
</script>

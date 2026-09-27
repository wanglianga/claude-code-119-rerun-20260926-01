<template>
  <el-card>
    <div class="toolbar">
      <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 170px" @change="load">
        <el-option v-for="(label, st) in STATUS_LABELS" :key="st" :value="st" :label="label" />
      </el-select>
      <el-select v-if="auth.isStaff" v-model="filters.organizationId" placeholder="全部主办方" clearable style="width: 200px" @change="load">
        <el-option v-for="o in orgs" :key="o.id" :value="o.id" :label="o.name" />
      </el-select>
      <el-select v-model="filters.venueId" placeholder="全部场地" clearable style="width: 200px" @change="load">
        <el-option v-for="v in venues" :key="v.id" :value="v.id" :label="v.name" />
      </el-select>
      <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" @change="load" />
      <div style="flex: 1"></div>
      <el-button type="primary" @click="$router.push('/sessions/new')">新建放映申请</el-button>
    </div>

    <el-table :data="sessions" v-loading="loading" style="margin-top: 12px" @row-click="go" highlight-current-row>
      <el-table-column prop="code" label="单号" width="170" />
      <el-table-column prop="title" label="影片" min-width="140" />
      <el-table-column label="主办方" min-width="150"><template #default="{ row }">{{ row.organization?.name }}</template></el-table-column>
      <el-table-column label="场地" min-width="140"><template #default="{ row }">{{ row.venue?.name }}</template></el-table-column>
      <el-table-column label="放映时间" width="165"><template #default="{ row }">{{ fmt(row.screeningDate) }}</template></el-table-column>
      <el-table-column label="观众(预计/实际)" width="120">
        <template #default="{ row }">{{ row.expectedAudience }}<span v-if="row.actualAudience != null"> / {{ row.actualAudience }}</span></template>
      </el-table-column>
      <el-table-column label="噪声" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.noiseOverLimit" type="danger" size="small">{{ row.noiseDb }}dB</el-tag>
          <span v-else-if="row.noiseDb != null" style="color: #67c23a">{{ row.noiseDb }}dB</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="130">
        <template #default="{ row }"><el-tag :type="STATUS_TYPE[row.status]" size="small">{{ STATUS_LABELS[row.status] }}</el-tag></template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { STATUS_LABELS, STATUS_TYPE } from '../constants';
import { useAuthStore } from '../store';

const auth = useAuthStore();
const router = useRouter();
const sessions = ref<any[]>([]);
const orgs = ref<any[]>([]);
const venues = ref<any[]>([]);
const dateRange = ref<string[] | null>(null);
const loading = ref(false);
const filters = reactive<{ status: string; organizationId: string; venueId: string }>({ status: '', organizationId: '', venueId: '' });

function fmt(t: string) {
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}
function go(row: any) {
  router.push(`/sessions/${row.id}`);
}
async function load() {
  loading.value = true;
  const params: any = { ...filters };
  if (!params.status) delete params.status;
  if (!params.organizationId) delete params.organizationId;
  if (!params.venueId) delete params.venueId;
  if (dateRange.value) { params.from = dateRange.value[0]; params.to = dateRange.value[1]; }
  const { data } = await api.get('/sessions', { params });
  sessions.value = data;
  loading.value = false;
}
onMounted(async () => {
  const [o, v] = await Promise.all([api.get('/organizations'), api.get('/venues')]);
  orgs.value = o.data;
  venues.value = v.data;
  await load();
});
</script>

<style scoped>
.toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
</style>

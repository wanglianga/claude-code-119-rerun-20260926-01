<template>
  <div>
    <div class="flex-between mb16">
      <h2 style="margin:0; font-size:18px">放映场次</h2>
      <RouterLink v-if="auth.role === 'APPLICANT'" to="/screenings/new" class="btn">➕ 新建放映申请</RouterLink>
    </div>

    <div class="card">
      <div class="flex gap8 mb16" style="flex-wrap:wrap">
        <button
          v-for="f in filters" :key="f.v"
          class="btn sm" :class="status === f.v ? '' : 'ghost'"
          @click="status = f.v"
        >{{ f.l }}</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>场次编号</th><th>影片 / 主办方</th><th>场地</th><th>放映时间</th>
            <th>观众</th><th>状态</th><th>风险标记</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in rows" :key="s.id">
            <td class="mono small">{{ s.code }}</td>
            <td>
              <div style="font-weight:600">《{{ s.filmTitle }}》</div>
              <div class="muted small">{{ s.org?.name }}</div>
            </td>
            <td>
              {{ s.venue?.name }}
              <span v-if="s.venue?.blacklisted" class="tag red">黑名单</span>
            </td>
            <td class="small">{{ fmtDate(s.screeningDate) }}<br />至 {{ fmtDate(s.endTime) }}</td>
            <td>{{ s.expectedAudience }} 人</td>
            <td><span class="tag" :class="STATUS_LABELS[s.status]?.[1]">{{ STATUS_LABELS[s.status]?.[0] }}</span></td>
            <td>
              <span v-if="s.hasNoiseIssue" class="tag orange" title="噪声问题">🔊 噪声</span>
              <span v-if="s.hasDamageIssue" class="tag red" title="设备损坏">🔧 损坏</span>
            </td>
            <td><RouterLink :to="`/screenings/${s.id}`" class="btn ghost sm">进入场次</RouterLink></td>
          </tr>
          <tr v-if="!rows.length"><td colspan="8"><div class="empty">暂无场次数据</div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { http } from '../api';
import { useAuthStore } from '../stores/auth';
import { STATUS_LABELS, fmtDate } from '../constants';

const auth = useAuthStore();
const rows = ref([]);
const status = ref('');
const filters = [
  { v: '', l: '全部' },
  { v: 'SUBMITTED', l: '待审核' },
  { v: 'APPROVED', l: '已批准' },
  { v: 'EQUIPPED', l: '已备货' },
  { v: 'ISSUED', l: '已出库' },
  { v: 'SCREENING', l: '放映中' },
  { v: 'FINISHED', l: '放映结束' },
  { v: 'RETURNED', l: '已归还' },
  { v: 'SETTLED', l: '已核销' },
];

async function load() {
  rows.value = await http.get('/screenings', status.value ? { status: status.value } : {});
}
watch(status, load);
onMounted(load);
</script>

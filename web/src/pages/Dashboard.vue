<template>
  <div>
    <h2 style="margin:0 0 16px; font-size:18px">街道文体岗复盘看板</h2>

    <div class="card">
      <h3>场次状态分布（按活动时间线）</h3>
      <div class="stat-grid">
        <div class="stat" v-for="([st, n]) in statusEntries" :key="st">
          <div class="num" :style="{ color: STATUS_LABELS[st]?.[1] === 'red' ? 'var(--danger)' : 'var(--primary)' }">{{ n }}</div>
          <div class="lbl">{{ STATUS_LABELS[st]?.[0] || st }}</div>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; align-items:start">
      <div class="card">
        <h3>场地风险榜（连续噪声/损坏点位）</h3>
        <table>
          <thead><tr><th>场地</th><th>场次</th><th>噪声</th><th>损坏</th><th>风险分</th><th>结论</th></tr></thead>
          <tbody>
            <tr v-for="v in db.riskVenues" :key="v.id">
              <td>
                <b>{{ v.name }}</b>
                <div class="small muted">{{ v.address }}</div>
              </td>
              <td>{{ v.screeningCount }}</td>
              <td :class="v.noiseCount>=db.blacklistThreshold?'text-danger':''">{{ v.noiseCount }}</td>
              <td :class="v.damageCount>=db.blacklistThreshold?'text-danger':''">{{ v.damageCount }}</td>
              <td><b>{{ v.riskScore }}</b></td>
              <td>
                <span v-if="v.blacklisted" class="tag red">已拉黑</span>
                <span v-else-if="v.suggestBlacklist" class="tag orange">建议拉黑</span>
                <span v-else class="tag blue">重点观察</span>
              </td>
            </tr>
            <tr v-if="!db.riskVenues?.length"><td colspan="6"><div class="empty">暂无风险点位</div></td></tr>
          </tbody>
        </table>
        <div class="muted small mt8">风险分 = 噪声次数×2 + 损坏次数×3；任一项达到 {{ db.blacklistThreshold }} 次将建议拉黑，影响下一轮审批。</div>
      </div>

      <div class="card">
        <h3>低信用主办方预警</h3>
        <table>
          <thead><tr><th>主办方</th><th>类型</th><th>信用分</th><th>申请资格</th></tr></thead>
          <tbody>
            <tr v-for="o in db.lowCreditOrgs" :key="o.id">
              <td><b>{{ o.name }}</b></td>
              <td>{{ ORG_TYPE_LABELS[o.type] }}</td>
              <td><span class="tag" :class="o.canApply?'orange':'red'">{{ o.creditScore }}</span></td>
              <td><span :class="o.canApply?'text-warn':'text-danger'">{{ o.canApply ? '可申请（重点关注）' : '已禁申' }}</span></td>
            </tr>
            <tr v-if="!db.lowCreditOrgs?.length"><td colspan="4"><div class="empty">各主办方信用良好</div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3>近期场次复盘（时间线入口）</h3>
      <table>
        <thead>
          <tr><th>场次</th><th>主办方/场地</th><th>放映时间</th><th>状态</th><th>噪声</th><th>损坏</th><th>复盘结论</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="s in db.recentScreenings" :key="s.id">
            <td class="mono small">{{ s.code }}<br /><b>《{{ s.filmTitle }}》</b></td>
            <td class="small">{{ s.org?.name }}<br /><span class="muted">{{ s.venue?.name }}</span></td>
            <td class="small">{{ fmtDate(s.screeningDate) }}</td>
            <td><span class="tag" :class="STATUS_LABELS[s.status]?.[1]">{{ STATUS_LABELS[s.status]?.[0] }}</span></td>
            <td><span v-if="s.hasNoiseIssue" class="tag orange">有</span><span v-else class="muted">无</span></td>
            <td><span v-if="s.hasDamageIssue" class="tag red">有</span><span v-else class="muted">无</span></td>
            <td class="small" style="max-width:240px">{{ s.reviewConclusion || '—' }}</td>
            <td><RouterLink :to="`/screenings/${s.id}`" class="btn ghost sm">查看时间线</RouterLink></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { http } from '../api';
import { ORG_TYPE_LABELS, STATUS_LABELS, fmtDate } from '../constants';

const db = ref({});
const statusEntries = computed(() => Object.entries(db.value.statusCounts || {}));
onMounted(async () => {
  db.value = await http.get('/street/dashboard');
});
</script>

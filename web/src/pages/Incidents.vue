<template>
  <div>
    <h2 style="margin:0 0 16px; font-size:18px">异常协同工作台</h2>
    <div class="card">
      <div class="muted small mb16">汇集全部进行中的异常，申请方、审核员、仓库、现场、安保、财务围绕同一场放映协同处理。</div>
      <table>
        <thead>
          <tr><th>异常类型</th><th>场次 / 场地</th><th>描述</th><th>严重</th><th>上报</th><th>状态</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="i in rows" :key="i.id">
            <td><b>{{ INCIDENT_LABELS[i.type] }}</b></td>
            <td class="small">
              <span class="mono">{{ i.screening?.code }}</span><br />
              《{{ i.screening?.filmTitle }}》<br />
              <span class="muted">{{ i.screening?.venue?.name }}</span>
            </td>
            <td style="max-width:260px">{{ i.description }}</td>
            <td><span class="tag" :class="i.severity>=2?'red':'orange'">{{ i.severity }} 级</span></td>
            <td class="small">{{ i.reporterName }}<br /><span class="muted">{{ fmtTime(i.createdAt) }}</span></td>
            <td><span class="tag" :class="i.status==='PROCESSING'?'orange':'red'">{{ i.status==='PROCESSING'?'处理中':'待处理' }}</span></td>
            <td><RouterLink :to="`/screenings/${i.screeningId}`" class="btn ghost sm">进入协同</RouterLink></td>
          </tr>
          <tr v-if="!rows.length"><td colspan="7"><div class="empty">当前没有待处理异常 🎉</div></td></tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3>居民投诉处理台账</h3>
      <table>
        <thead><tr><th>场次</th><th>投诉人</th><th>内容</th><th>处理结果</th><th>状态</th><th>处理人</th></tr></thead>
        <tbody>
          <tr v-for="c in complaints" :key="c.id">
            <td class="small"><RouterLink :to="`/screenings/${c.screeningId}`" class="mono">{{ c.screeningId.slice(0,8) }}</RouterLink></td>
            <td class="small">{{ c.complainant }}</td>
            <td style="max-width:240px">{{ c.content }}</td>
            <td class="small">{{ c.handleResult || '—' }}</td>
            <td><span class="tag" :class="c.status==='RESOLVED'?'green':'orange'">{{ c.status==='RESOLVED'?'已解决':'处理中' }}</span></td>
            <td class="small">{{ c.handlerName }}</td>
          </tr>
          <tr v-if="!complaints.length"><td colspan="6"><div class="empty">暂无投诉记录</div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { http } from '../api';
import { INCIDENT_LABELS, fmtTime } from '../constants';

const rows = ref([]);
const complaints = ref([]);
onMounted(async () => {
  rows.value = await http.get('/incidents/open');
  complaints.value = await http.get('/complaints');
});
</script>

<template>
  <el-card header="街道活动时间线（申请 → 审批 → 出库 → 搭建 → 放映 → 投诉 → 核销）">
    <el-timeline>
      <el-timeline-item v-for="e in events" :key="e.id" :timestamp="fmt(e.createdAt)" placement="top" :type="colorOf(e.eventType)">
        <el-card shadow="never">
          <div>
            <el-tag size="small" :type="colorOf(e.eventType)" style="margin-right: 8px">{{ stageLabel(e.eventType) }}</el-tag>
            <b>{{ e.title }}</b>
          </div>
          <div v-if="e.detail" style="color: #606266; margin-top: 6px">{{ e.detail }}</div>
          <div style="color: #909399; font-size: 12px; margin-top: 4px">操作人：{{ e.actorName || '系统' }}</div>
        </el-card>
      </el-timeline-item>
    </el-timeline>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';

const events = ref<any[]>([]);
onMounted(async () => {
  const { data } = await api.get('/dashboard/timeline');
  events.value = data;
});
function fmt(t: string) {
  return new Date(t).toLocaleString('zh-CN', { hour12: false });
}
function stageLabel(t: string) {
  const map: Record<string, string> = {
    APPLIED: '申请', RESUBMITTED: '申请', REVIEW_APPROVED: '审批', REVIEW_REJECTED: '审批',
    KIT_PREPARED: '出库', SCAN_PICKUP: '出库', KIT_VERIFIED: '出库',
    INSPECTION: '搭建', FINISHED: '放映',
    INCIDENT_REPORTED: '投诉/异常', INCIDENT_MESSAGE: '投诉/异常', INCIDENT_CLOSED: '投诉/异常', INCIDENT_DECISION: '投诉/异常',
    RETURNED: '归还', SETTLED: '核销', CANCELLED: '取消',
  };
  return map[t] || '其他';
}
function colorOf(t: string) {
  if (t.startsWith('REVIEW') || t === 'KIT_PREPARED' || t === 'KIT_VERIFIED' || t === 'SCAN_PICKUP') return 'primary';
  if (t.startsWith('INCIDENT')) return 'danger';
  if (t === 'SETTLED') return 'success';
  if (t === 'CANCELLED' || t === 'REVIEW_REJECTED') return 'info';
  return 'warning';
}
</script>

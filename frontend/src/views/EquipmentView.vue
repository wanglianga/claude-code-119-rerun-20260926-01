<template>
  <el-card>
    <div style="margin-bottom: 12px; display: flex; gap: 10px; align-items: center">
      <el-select v-model="catFilter" placeholder="全部类别" clearable style="width: 150px" @change="load">
        <el-option v-for="(label, key) in EQUIP_CATEGORY" :key="key" :value="key" :label="label" />
      </el-select>
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 150px" @change="load">
        <el-option v-for="(v, key) in EQUIP_STATUS" :key="key" :value="key" :label="v.label" />
      </el-select>
      <div style="flex:1"></div>
      <el-input v-model="scanCode" placeholder="扫码/输入二维码核对" style="width: 240px" clearable @clear="scanResult = null" @keyup.enter="doScan" />
      <el-button type="primary" @click="doScan">扫码核对</el-button>
    </div>

    <el-alert v-if="scanResult" :type="scanResult.status === 'IDLE' ? 'success' : 'warning'" :closable="false" show-icon style="margin-bottom: 12px">
      <template #title>
        扫码结果：{{ scanResult.name }}（{{ EQUIP_CATEGORY[scanResult.category] }} / {{ scanResult.model }}）
        — 当前状态：<el-tag :type="EQUIP_STATUS[scanResult.status].type" size="small">{{ EQUIP_STATUS[scanResult.status].label }}</el-tag>
        ，设备价值 ¥{{ scanResult.value }}
      </template>
    </el-alert>
    <el-alert v-else-if="scanned" type="error" title="未查询到该二维码对应的在册设备" :closable="false" show-icon style="margin-bottom: 12px" />

    <el-table :data="equipment" v-loading="loading">
      <el-table-column label="二维码" width="140"><template #default="{ row }"><span class="mono">{{ row.qrCode }}</span></template></el-table-column>
      <el-table-column prop="name" label="设备名称" min-width="180" />
      <el-table-column label="类别" width="100"><template #default="{ row }">{{ EQUIP_CATEGORY[row.category] }}</template></el-table-column>
      <el-table-column prop="model" label="规格型号" min-width="140" />
      <el-table-column label="价值" width="100"><template #default="{ row }">¥{{ row.value }}</template></el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }"><el-tag :type="EQUIP_STATUS[row.status].type" size="small">{{ EQUIP_STATUS[row.status].label }}</el-tag></template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../api';
import { EQUIP_CATEGORY, EQUIP_STATUS } from '../constants';

const equipment = ref<any[]>([]);
const loading = ref(false);
const catFilter = ref('');
const statusFilter = ref('');
const scanCode = ref('');
const scanResult = ref<any>(null);
const scanned = ref(false);

async function load() {
  loading.value = true;
  const params: any = {};
  if (catFilter.value) params.category = catFilter.value;
  if (statusFilter.value) params.status = statusFilter.value;
  const { data } = await api.get('/equipment', { params });
  equipment.value = data;
  loading.value = false;
}
async function doScan() {
  if (!scanCode.value) return;
  const { data } = await api.get(`/equipment/scan/${encodeURIComponent(scanCode.value.trim())}`);
  scanResult.value = data;
  scanned.value = true;
}
load();
</script>

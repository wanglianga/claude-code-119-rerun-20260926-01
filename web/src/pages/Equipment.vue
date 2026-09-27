<template>
  <div>
    <h2 style="margin:0 0 16px; font-size:18px">设备库存台账</h2>

    <div class="card" v-if="auth.role==='WAREHOUSE'">
      <h3>设备入库登记（生成扫码条码）</h3>
      <div class="flex gap8" style="flex-wrap:wrap">
        <input v-model="form.qrCode" placeholder="条码，如 PJ-0004" style="width:150px" />
        <input v-model="form.name" placeholder="设备名称" style="width:180px" />
        <select v-model="form.category" style="width:130px">
          <option v-for="[v,l] in EQUIP_TYPES" :key="v" :value="v">{{ l }}</option>
        </select>
        <input v-model="form.value" type="number" placeholder="资产价值" style="width:120px" />
        <button class="btn" @click="create">登记入库</button>
      </div>
    </div>

    <div class="card">
      <div class="flex gap8 mb16" style="flex-wrap:wrap">
        <select v-model="cat" style="width:150px" @change="load">
          <option value="">全部类别</option>
          <option v-for="[v,l] in EQUIP_TYPES" :key="v" :value="v">{{ l }}</option>
        </select>
        <select v-model="st" style="width:140px" @change="load">
          <option value="">全部状态</option>
          <option value="IDLE">库存中</option>
          <option value="RESERVED">已预占</option>
          <option value="ISSUED">已出库</option>
          <option value="DAMAGED">损坏</option>
        </select>
      </div>
      <table>
        <thead><tr><th>条码</th><th>名称</th><th>类别</th><th>价值(元)</th><th>状态</th><th>备注</th></tr></thead>
        <tbody>
          <tr v-for="e in rows" :key="e.id">
            <td class="mono">{{ e.qrCode }}</td>
            <td>{{ e.name }}</td>
            <td>{{ EQUIP_LABELS[e.category] }}</td>
            <td>{{ e.value }}</td>
            <td><span class="tag" :class="eqStatus(e.status)[1]">{{ eqStatus(e.status)[0] }}</span></td>
            <td class="small muted">{{ e.remark }}</td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6"><div class="empty">无匹配设备</div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { http, toast } from '../api';
import { useAuthStore } from '../stores/auth';
import { EQUIP_LABELS, EQUIP_TYPES } from '../constants';

const auth = useAuthStore();
const rows = ref([]);
const cat = ref('');
const st = ref('');
const form = reactive({ qrCode: '', name: '', category: 'PROJECTOR', value: '1000' });

function eqStatus(s) {
  return { IDLE: ['库存中', 'green'], RESERVED: ['已预占', 'orange'], ISSUED: ['已出库', 'blue'], RETURNED: ['已归还', 'green'], DAMAGED: ['损坏', 'red'], LOST: ['丢失', 'gray'] }[s] || [s, 'gray'];
}

async function load() {
  rows.value = await http.get('/equipment', {
    ...(cat.value ? { category: cat.value } : {}),
    ...(st.value ? { status: st.value } : {}),
  });
}
onMounted(load);

async function create() {
  if (!form.qrCode || !form.name) return toast('条码和名称必填', 'err');
  await http.post('/equipment', { ...form, value: String(form.value) });
  toast('设备已入库');
  form.qrCode = form.name = '';
  await load();
}
</script>

<template>
  <div>
    <h2 style="margin:0 0 16px; font-size:18px">场地与黑名单管理</h2>

    <div class="card" v-if="auth.role==='STREET'">
      <h3>新增场地</h3>
      <div class="flex gap8" style="flex-wrap:wrap">
        <input v-model="form.name" placeholder="场地名称" style="width:180px" />
        <input v-model="form.address" placeholder="详细地址" style="flex:1; min-width:220px" />
        <input v-model.number="form.capacity" type="number" placeholder="建议容量" style="width:120px" />
        <button class="btn" @click="create">新增</button>
      </div>
    </div>

    <div class="card">
      <h3>场地台账（连续噪声/损坏影响下一轮审批）</h3>
      <table>
        <thead>
          <tr><th>场地</th><th>地址</th><th>容量</th><th>已办场次</th><th>噪声投诉</th><th>设备损坏</th><th>状态</th><th style="width:170px">操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="v in rows" :key="v.id">
            <td><b>{{ v.name }}</b></td>
            <td class="small">{{ v.address }}</td>
            <td>{{ v.capacity }}</td>
            <td>{{ v.screeningCount }}</td>
            <td :class="v.noiseCount>=3?'text-danger':''">{{ v.noiseCount }}</td>
            <td :class="v.damageCount>=3?'text-danger':''">{{ v.damageCount }}</td>
            <td>
              <span v-if="v.blacklisted" class="tag red">黑名单</span>
              <span v-else-if="v.noiseCount>=3||v.damageCount>=3" class="tag orange">风险预警</span>
              <span v-else class="tag green">正常</span>
              <div v-if="v.blacklistReason" class="small muted">{{ v.blacklistReason }}</div>
            </td>
            <td v-if="auth.role==='STREET'">
              <button v-if="!v.blacklisted" class="btn danger sm" @click="setBl(v, true)">加入黑名单</button>
              <button v-else class="btn ghost sm" @click="setBl(v, false)">移出黑名单</button>
            </td>
            <td v-else class="muted small">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { http, toast } from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const rows = ref([]);
const form = reactive({ name: '', address: '', capacity: 300 });

async function load() {
  rows.value = await http.get('/venues');
}
onMounted(load);

async function create() {
  if (!form.name || !form.address) return toast('名称地址必填', 'err');
  await http.post('/venues', { ...form, capacity: Number(form.capacity) });
  toast('场地已新增');
  form.name = form.address = '';
  await load();
}
async function setBl(v, blacklisted) {
  let reason = '';
  if (blacklisted) {
    reason = prompt(`说明将「${v.name}」加入黑名单的原因（连续噪声${v.noiseCount}次/损坏${v.damageCount}次）`);
    if (!reason) return;
  }
  await http.post(`/venues/${v.id}/blacklist`, { blacklisted, reason });
  toast(blacklisted ? '已加入黑名单' : '已移出黑名单');
  await load();
}
</script>

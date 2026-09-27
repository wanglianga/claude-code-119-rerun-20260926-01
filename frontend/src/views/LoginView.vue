<template>
  <div class="login-wrap">
    <el-card class="login-card">
      <div class="brand">🎬</div>
      <h2 style="text-align: center">城市露天电影放映审批与设备巡检平台</h2>
      <p style="text-align: center; color: #909399; margin-top: -6px">申请 · 审批 · 出库 · 搭建 · 放映 · 投诉 · 核销 全流程</p>
      <el-form :model="form" @submit.prevent>
        <el-form-item>
          <el-input v-model="form.username" size="large" placeholder="账号" :prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" size="large" type="password" placeholder="密码（123456）" :prefix-icon="Lock" show-password @keyup.enter="submit" />
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="submit">登 录</el-button>
      </el-form>
      <el-divider>测试账号（密码均为 123456）</el-divider>
      <div class="accounts">
        <el-button v-for="a in accounts" :key="a.u" size="small" @click="fill(a.u)">{{ a.label }}</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { User, Lock } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../store';

const form = reactive({ username: 'street', password: '123456' });
const loading = ref(false);
const router = useRouter();
const auth = useAuthStore();

const accounts = [
  { u: 'applicant1', label: '申请方·阳光社区' },
  { u: 'applicant2', label: '申请方·安泰物业(低信用)' },
  { u: 'reviewer', label: '文化审核员' },
  { u: 'warehouse', label: '仓库管理员' },
  { u: 'leader', label: '现场负责人' },
  { u: 'security', label: '安保' },
  { u: 'finance', label: '财务' },
  { u: 'street', label: '街道文体岗' },
];
function fill(u: string) {
  form.username = u;
  form.password = '123456';
}
async function submit() {
  loading.value = true;
  try {
    await auth.login(form.username, form.password);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrap { height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1f2d3d, #2c5f7a); }
.login-card { width: 460px; padding: 12px 20px 22px; }
.brand { font-size: 48px; text-align: center; }
.accounts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
</style>

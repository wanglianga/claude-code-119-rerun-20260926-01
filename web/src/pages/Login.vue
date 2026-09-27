<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="title">🎬 城市露天电影放映<br />审批与设备巡检平台</div>
      <div class="sub">申请 · 文化审核 · 仓库成套扫码 · 现场巡检 · 异常协同 · 核销复盘</div>
      <div class="field">
        <label>账号</label>
        <input v-model="username" placeholder="请输入账号" @keyup.enter="doLogin" />
      </div>
      <div class="field">
        <label>密码</label>
        <input v-model="password" type="password" placeholder="请输入密码" @keyup.enter="doLogin" />
      </div>
      <button class="btn" style="width: 100%; justify-content: center; padding: 10px" :disabled="loading" @click="doLogin">
        {{ loading ? '登录中…' : '登 录' }}
      </button>

      <div class="accounts">
        <div class="acc-title">测试账号（密码统一 123456，点击填充）</div>
        <div class="acc-grid">
          <span v-for="a in accounts" :key="a.u" class="acc" @click="fill(a.u)">
            <b>{{ a.label }}</b><span class="mono">{{ a.u }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const username = ref('shequ');
const password = ref('123456');
const loading = ref(false);
const auth = useAuthStore();
const router = useRouter();

const accounts = [
  { label: '申请方-社区', u: 'shequ' },
  { label: '申请方-物业', u: 'wuye' },
  { label: '申请方-商圈', u: 'shangquan' },
  { label: '文化审核员', u: 'shenhe' },
  { label: '仓库管理员', u: 'cangku' },
  { label: '现场负责人', u: 'xianchang' },
  { label: '安保队长', u: 'anbao' },
  { label: '财务', u: 'caiwu' },
  { label: '街道文体岗', u: 'jiedao' },
];

function fill(u) {
  username.value = u;
  password.value = '123456';
}

async function doLogin() {
  if (!username.value || !password.value) return;
  loading.value = true;
  try {
    await auth.login(username.value.trim(), password.value);
    router.push('/');
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}
bindToast(() => {});
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #16396b 0%, #1f5fbf 100%);
  padding: 24px;
}
.login-card {
  background: #fff;
  border-radius: 14px;
  padding: 34px 36px 26px;
  width: 430px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
}
.title {
  font-size: 21px;
  font-weight: 700;
  line-height: 1.4;
  text-align: center;
}
.sub {
  color: var(--muted);
  font-size: 12.5px;
  text-align: center;
  margin: 10px 0 22px;
}
.field { margin-bottom: 14px; }
.accounts {
  margin-top: 22px;
  border-top: 1px dashed var(--border);
  padding-top: 14px;
}
.acc-title { font-size: 12px; color: var(--muted); margin-bottom: 9px; }
.acc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 7px;
}
.acc {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 11.5px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.3;
}
.acc:hover { border-color: var(--primary); background: #f5f9ff; }
.acc b { font-weight: 600; }
.acc .mono { color: var(--muted); font-size: 10.5px; }
</style>

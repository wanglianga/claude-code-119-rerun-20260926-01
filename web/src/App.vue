<template>
  <template v-if="auth.isLogin">
    <aside class="sidebar">
      <div class="logo">🎬 露天电影平台</div>
      <nav>
        <RouterLink to="/">📋 放映场次</RouterLink>
        <RouterLink v-if="auth.role === 'APPLICANT'" to="/screenings/new">➕ 提交申请</RouterLink>
        <RouterLink to="/incidents">🚨 异常协同</RouterLink>
        <RouterLink v-if="['WAREHOUSE','ONSITE'].includes(auth.role)" to="/equipment">📦 设备台账</RouterLink>
        <RouterLink v-if="auth.role === 'STREET'" to="/venues">📍 场地黑名单</RouterLink>
        <RouterLink v-if="['STREET','FINANCE','AUDITOR'].includes(auth.role)" to="/orgs">🏛️ 主办方信用</RouterLink>
        <RouterLink v-if="['STREET','AUDITOR','FINANCE'].includes(auth.role)" to="/dashboard">📊 街道看板</RouterLink>
      </nav>
      <div class="side-foot">
        <div class="who">
          <div class="name">{{ auth.user.name }}</div>
          <div class="role">{{ ROLE_LABELS[auth.role] }}</div>
        </div>
        <button class="btn gray sm" @click="logout">退出</button>
      </div>
    </aside>
    <main class="main">
      <RouterView />
    </main>
  </template>
  <RouterView v-else />
  <div v-if="toast" class="toast" :class="toast.type">{{ toast.text }}</div>
</template>

<script setup>
import { onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { bindToast } from './api';
import { ROLE_LABELS } from './constants';

const auth = useAuthStore();
const router = useRouter();
const toast = reactive({ text: '', type: 'ok', timer: null });

bindToast((text, type = 'ok') => {
  toast.text = text;
  toast.type = type;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (toast.text = ''), 3200);
});

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<style scoped>
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 208px;
  background: #132c4e;
  color: #cdd9ea;
  display: flex;
  flex-direction: column;
  z-index: 10;
}
.logo {
  padding: 18px 18px 14px;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
nav {
  flex: 1;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
nav a {
  color: #b9c8dd;
  padding: 9px 12px;
  border-radius: 7px;
  font-size: 13.5px;
}
nav a:hover { background: rgba(255, 255, 255, 0.07); color: #fff; }
nav a.router-link-active { background: #1f5fbf; color: #fff; }
.side-foot {
  padding: 12px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.who .name { color: #fff; font-size: 13px; font-weight: 600; }
.who .role { color: #8aa0bd; font-size: 12px; margin: 2px 0 8px; }
.main {
  margin-left: 208px;
  padding: 22px 26px 40px;
  max-width: 1240px;
}
</style>

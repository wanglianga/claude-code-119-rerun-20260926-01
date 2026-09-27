<template>
  <el-container v-if="auth.isLogged" style="height: 100vh">
    <el-aside width="230px" class="aside">
      <div class="logo">🎬 露天电影平台</div>
      <el-menu :default-active="activeMenu" router background-color="#1f2d3d" text-color="#c0ccda" active-text-color="#ffd04b">
        <el-menu-item index="/dashboard"><el-icon><DataLine /></el-icon><span>街道总览</span></el-menu-item>
        <el-menu-item index="/timeline"><el-icon><Timer /></el-icon><span>活动时间线</span></el-menu-item>
        <el-menu-item index="/sessions"><el-icon><Film /></el-icon><span>放映场次</span></el-menu-item>
        <el-menu-item index="/sessions/new"><el-icon><Plus /></el-icon><span>新建放映申请</span></el-menu-item>
        <el-menu-item index="/incidents"><el-icon><Warning /></el-icon><span>异常协同</span></el-menu-item>
        <el-menu-item index="/equipment"><el-icon><Box /></el-icon><span>设备台账/扫码</span></el-menu-item>
        <el-menu-item index="/organizations"><el-icon><OfficeBuilding /></el-icon><span>主办方信用</span></el-menu-item>
        <el-menu-item index="/venues"><el-icon><Location /></el-icon><span>场地黑名单</span></el-menu-item>
        <el-menu-item index="/finance"><el-icon><Money /></el-icon><span>财务记录</span></el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="title">{{ $route.meta.title || '' }}</div>
        <div>
          <el-tag type="info" effect="plain" style="margin-right: 12px">{{ auth.roleLabel }}</el-tag>
          <span style="margin-right: 16px">{{ auth.user?.name }}</span>
          <el-button size="small" @click="logout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
  <router-view v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './store';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const activeMenu = computed(() => (route.path.startsWith('/sessions/') && route.path !== '/sessions/new' ? '/sessions' : route.path));
function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<style>
html, body, #app { margin: 0; height: 100%; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.aside { background: #1f2d3d; overflow-y: auto; }
.logo { color: #ffd04b; font-size: 17px; font-weight: 700; text-align: center; padding: 18px 8px; line-height: 1.4; }
.aside .el-menu { border-right: none; }
.header { display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #e4e7ed; }
.header .title { font-size: 18px; font-weight: 600; }
.main { background: #f0f2f5; padding: 18px; }
.page-card { margin-bottom: 16px; }
.mono { font-family: ui-monospace, Menlo, monospace; }
.timeline-event-type { font-weight: 600; }
</style>

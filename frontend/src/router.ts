import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from './store';

const routes = [
  { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: () => import('./views/DashboardView.vue'), meta: { title: '街道总览' } },
  { path: '/timeline', component: () => import('./views/TimelineView.vue'), meta: { title: '活动时间线' } },
  { path: '/sessions', component: () => import('./views/SessionListView.vue'), meta: { title: '放映场次' } },
  { path: '/sessions/new', component: () => import('./views/SessionFormView.vue'), meta: { title: '新建放映申请' } },
  { path: '/sessions/:id', component: () => import('./views/SessionDetailView.vue'), meta: { title: '场次详情' } },
  { path: '/incidents', component: () => import('./views/IncidentListView.vue'), meta: { title: '异常协同' } },
  { path: '/equipment', component: () => import('./views/EquipmentView.vue'), meta: { title: '设备台账' } },
  { path: '/organizations', component: () => import('./views/OrgView.vue'), meta: { title: '主办方信用与押金' } },
  { path: '/venues', component: () => import('./views/VenueView.vue'), meta: { title: '场地与黑名单' } },
  { path: '/finance', component: () => import('./views/FinanceView.vue'), meta: { title: '财务记录' } },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isLogged) return '/login';
  if (to.path === '/login' && auth.isLogged) return '/dashboard';
  return true;
});

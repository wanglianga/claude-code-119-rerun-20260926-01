import { createRouter, createWebHashHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', component: () => import('./pages/Login.vue'), meta: { public: true } },
    { path: '/', component: () => import('./pages/ScreeningsList.vue') },
    { path: '/screenings/new', component: () => import('./pages/NewScreening.vue') },
    { path: '/screenings/:id', component: () => import('./pages/ScreeningDetail.vue') },
    { path: '/incidents', component: () => import('./pages/Incidents.vue') },
    { path: '/equipment', component: () => import('./pages/Equipment.vue') },
    { path: '/venues', component: () => import('./pages/Venues.vue') },
    { path: '/orgs', component: () => import('./pages/Orgs.vue') },
    { path: '/dashboard', component: () => import('./pages/Dashboard.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('cinema_token');
  if (!to.meta.public && !token) return '/login';
  if (to.path === '/login' && token) return '/';
  return true;
});

import { defineStore } from 'pinia';
import { http } from '../api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('cinema_token') || '',
    user: JSON.parse(localStorage.getItem('cinema_user') || 'null'),
  }),
  getters: {
    isLogin: (s) => !!s.token,
    role: (s) => s.user?.role || '',
  },
  actions: {
    async login(username, password) {
      const r = await http.post('/auth/login', { username, password });
      this.token = r.token;
      this.user = r.user;
      localStorage.setItem('cinema_token', r.token);
      localStorage.setItem('cinema_user', JSON.stringify(r.user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('cinema_token');
      localStorage.removeItem('cinema_user');
    },
  },
});

import { defineStore } from 'pinia';
import { api } from './api';
import { ROLE_LABELS } from './constants';

interface UserInfo {
  sub: string;
  username: string;
  name: string;
  role: string;
  organizationId: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null') as UserInfo | null,
  }),
  getters: {
    isLogged: (s) => !!s.token,
    roleLabel: (s) => (s.user ? ROLE_LABELS[s.user.role] : ''),
    isStaff: (s) => !!s.user && s.user.role !== 'APPLICANT',
  },
  actions: {
    async login(username: string, password: string) {
      const { data } = await api.post('/auth/login', { username, password });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});

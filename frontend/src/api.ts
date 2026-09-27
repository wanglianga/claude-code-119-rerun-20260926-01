import axios from 'axios';
import { ElMessage } from 'element-plus';

export const api = axios.create({ baseURL: '/api', timeout: 20000 });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const msg = err.response?.data?.message;
    if (status === 401 && !err.config?.url?.includes('auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (location.hash !== '#/login') location.hash = '#/login';
    }
    const text = Array.isArray(msg) ? msg.join('；') : msg || err.message;
    // RISK: 前缀的业务提示需要弹窗二次确认，交给调用方处理
    if (!String(text).startsWith('RISK:')) ElMessage.error(text);
    return Promise.reject(err);
  },
);

export function apiError(e: any): string {
  const msg = e.response?.data?.message;
  return Array.isArray(msg) ? msg.join('；') : msg || '请求失败';
}

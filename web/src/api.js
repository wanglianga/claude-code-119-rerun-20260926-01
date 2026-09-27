import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('cinema_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let toastFn = null;
export function bindToast(fn) {
  toastFn = fn;
}
export function toast(text, type = 'ok') {
  if (toastFn) toastFn(text, type);
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const data = err.response?.data;
    const msg =
      (Array.isArray(data?.message) ? data.message.join('；') : data?.message) ||
      err.message ||
      '请求失败';
    if (err.response?.status === 401) {
      localStorage.removeItem('cinema_token');
      localStorage.removeItem('cinema_user');
      if (location.hash !== '#/login') location.hash = '#/login';
    } else if (toastFn) {
      toastFn(msg, 'err');
    }
    return Promise.reject(new Error(msg));
  },
);

export const http = {
  get: (url, params) => api.get(url, { params }).then((r) => r.data),
  post: (url, body) => api.post(url, body).then((r) => r.data),
};

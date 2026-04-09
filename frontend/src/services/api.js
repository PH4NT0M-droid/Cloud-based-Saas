import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

const hasStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

api.interceptors.request.use((config) => {
  const token = hasStorage ? window.localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message || '';

    if (status === 401 && hasStorage) {
      const normalized = String(message).toLowerCase();
      const isAuthTokenIssue =
        normalized.includes('invalid or expired token') || normalized.includes('missing or invalid authorization token');

      if (isAuthTokenIssue) {
        window.localStorage.removeItem('token');
        window.localStorage.removeItem('user');

        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;

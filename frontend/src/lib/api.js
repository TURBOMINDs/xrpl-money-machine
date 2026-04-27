import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Attach token from localStorage if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('umm_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  signin: () => api.post('/auth/xaman/signin'),
  status: (uuid) => api.get(`/auth/xaman/status/${uuid}`),
  mockResolve: (payload_uuid, address) =>
    api.post('/auth/xaman/mock-resolve', { payload_uuid, address }),
  me: () => api.get('/me'),
  logout: () => api.post('/auth/xaman/logout'),
};

export const subsApi = {
  plans: () => api.get('/subscriptions/plans'),
  startTrial: () => api.post('/subscriptions/start-trial'),
  subscribe: (tier) => api.post('/subscriptions/subscribe', { tier }),
  getIntent: (id) => api.get(`/subscriptions/intent/${id}`),
  mockResolvePayment: (id) => api.post(`/subscriptions/mock-resolve/${id}`),
};

export const ammApi = {
  list: () => api.get('/amm/pairs'),
  create: (lp_address, pair_name) =>
    api.post('/amm/pairs', { lp_address, pair_name }),
  delete: (id) => api.delete(`/amm/pairs/${id}`),
  toggle: (id) => api.patch(`/amm/pairs/${id}/status`),
  stats: (id) => api.get(`/amm/pairs/${id}/stats`),
  chart: (id, interval = '1h', range = '30d') =>
    api.get(`/amm/pairs/${id}/chart`, { params: { interval, range_: range } }),
};

export const alertsApi = {
  list: () => api.get('/alerts'),
  create: (data) => api.post('/alerts', data),
  toggle: (id) => api.patch(`/alerts/${id}/toggle`),
  remove: (id) => api.delete(`/alerts/${id}`),
  events: (params = {}) => api.get('/alerts/events', { params }),
};

export const ranksApi = {
  definitions: () => api.get('/ranks/definitions'),
  classify: (address) => api.get(`/ranks/classify/${address}`),
  config: () => api.get('/ranks/config'),
  upsert: (data) => api.post('/ranks/config', data),
};

export const notifApi = {
  config: () => api.get('/notifications/onesignal/config'),
  subscribe: (player_id) =>
    api.post('/notifications/onesignal/subscribe', { player_id }),
  test: (heading, content) =>
    api.post('/notifications/test', { heading, content }),
  log: () => api.get('/notifications/log'),
};

export const statsApi = {
  subscriptions: () => api.get('/stats/subscriptions'),
  supportHistory: (limit = 10) => api.get('/stats/support-history', { params: { limit } }),
};

export const liquidityApi = {
  status: () => api.get('/liquidity/status'),
  executions: (limit = 20) => api.get('/liquidity/executions', { params: { limit } }),
  runNow: ({ force = false, override_amount } = {}) => {
    const params = { force };
    if (override_amount !== undefined) params.override_amount = override_amount;
    return api.post('/liquidity/run-now', null, { params });
  },
};

export default api;

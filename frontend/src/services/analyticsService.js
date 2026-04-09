import api from './api';

const analyticsService = {
  getRevenue: (params) => api.get('/analytics/revenue', { params }).then((res) => res.data.data),
  getOccupancy: (params) => api.get('/analytics/occupancy', { params }).then((res) => res.data.data),
  getOtaPerformance: () => api.get('/analytics/ota-performance').then((res) => res.data.data),
  getMetrics: (params) => api.get('/analytics/metrics', { params }).then((res) => res.data.data),
};

export default analyticsService;

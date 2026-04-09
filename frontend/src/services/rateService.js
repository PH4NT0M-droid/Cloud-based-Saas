import api from './api';

const rateService = {
  update: (payload) => api.post('/rates/update', payload).then((res) => res.data.data),
  bulkUpdate: (payload) => api.post('/rates/bulk-update', payload).then((res) => res.data.data),
  getRates: (params) => api.get('/rates', { params }).then((res) => res.data.data),
};

export default rateService;

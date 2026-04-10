import api from './api';

const promotionService = {
  getAll: () => api.get('/promotions').then((res) => res.data.data),
  create: (payload) => api.post('/promotions', payload).then((res) => res.data.data),
  update: (id, payload) => api.put(`/promotions/${id}`, payload).then((res) => res.data.data),
  remove: (id) => api.delete(`/promotions/${id}`).then((res) => res.data.data),
};

export default promotionService;

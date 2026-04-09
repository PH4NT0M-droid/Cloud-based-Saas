import api from './api';

const bookingService = {
  getAll: (params) => api.get('/bookings', { params }).then((res) => res.data.data),
  getById: (id) => api.get(`/bookings/${id}`).then((res) => res.data.data),
  updateStatus: (id, status) => api.put(`/bookings/${id}/status`, { status }).then((res) => res.data.data),
  sync: (payload) => api.post('/bookings/sync', payload).then((res) => res.data.data),
};

export default bookingService;

import api from './api';

const bookingService = {
  getAll: (params) => api.get('/bookings', { params }).then((res) => res.data.data),
  getById: (id) => api.get(`/bookings/${id}`).then((res) => res.data.data),
  updateStatus: (id, status) => api.put(`/bookings/${id}/status`, { status }).then((res) => res.data.data),
  update: (id, payload) => api.put(`/bookings/${id}`, payload).then((res) => res.data.data),
  cancel: (id) => api.delete(`/bookings/${id}`).then((res) => res.data.data),
  createManual: (payload) => api.post('/bookings/manual', payload).then((res) => res.data.data),
  sync: (payload) => api.post('/bookings/sync', payload).then((res) => res.data.data),
};

export default bookingService;

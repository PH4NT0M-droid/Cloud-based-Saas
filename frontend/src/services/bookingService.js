import api from './api';

const bookingService = {
  getAll: (params) => api.get('/bookings', { params }).then((res) => res.data.data),
  getById: (id) => api.get(`/bookings/${id}`).then((res) => res.data.data),
  updateStatus: (id, status) => api.put(`/bookings/${id}/status`, { status }).then((res) => res.data.data),
  update: (id, payload) => api.put(`/bookings/${id}`, payload).then((res) => res.data.data),
  cancel: (id) => api.put(`/bookings/${id}/status`, { status: 'CANCELLED' }).then((res) => res.data.data),
  remove: (id) => api.delete(`/bookings/${id}`).then((res) => res.data.data),
  createManual: (payload) => api.post('/bookings/manual', payload).then((res) => res.data.data),
  create: (payload) => api.post('/bookings/create', payload).then((res) => res.data.data),
  previewInvoice: (id) => api.get(`/bookings/${id}/invoice/preview`).then((res) => res.data.data),
  downloadInvoice: async (id) => {
    const response = await api.get(`/bookings/${id}/invoice`, { responseType: 'arraybuffer' });
    return new Blob([response.data], { type: response.headers['content-type'] || 'application/pdf' });
  },
  sync: (payload) => api.post('/bookings/sync', payload).then((res) => res.data.data),
};

export default bookingService;

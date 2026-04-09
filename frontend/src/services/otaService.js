import api from './api';

const otaService = {
  syncInventory: (payload) => api.post('/ota/sync-inventory', payload).then((res) => res.data.data),
  syncRates: (payload) => api.post('/ota/sync-rates', payload).then((res) => res.data.data),
  fetchBookings: (params) => api.get('/ota/bookings', { params }).then((res) => res.data.data),
};

export default otaService;

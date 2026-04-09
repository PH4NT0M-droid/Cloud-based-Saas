import api from './api';

const inventoryService = {
  update: (payload) => api.post('/inventory/update', payload).then((res) => res.data.data),
  bulkUpdate: (payload) => api.post('/inventory/bulk-update', payload).then((res) => res.data.data),
  getCalendar: (params) => api.get('/inventory/calendar', { params }).then((res) => res.data.data),
};

export default inventoryService;

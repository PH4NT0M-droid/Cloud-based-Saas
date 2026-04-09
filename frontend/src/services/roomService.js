import api from './api';

const roomService = {
  create: (payload) => api.post('/rooms', payload).then((res) => res.data.data),
  update: (id, payload) => api.put(`/rooms/${id}`, payload).then((res) => res.data.data),
  remove: (id) => api.delete(`/rooms/${id}`),
  getByProperty: (propertyId) => api.get('/rooms', { params: { propertyId } }).then((res) => res.data.data),
};

export default roomService;

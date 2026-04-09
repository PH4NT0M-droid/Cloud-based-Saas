import api from './api';

const adminService = {
  getUsers: () => api.get('/admin/users').then((res) => res.data.data),
  createUser: (payload) => api.post('/admin/users', payload).then((res) => res.data.data),
  updateUser: (id, payload) => api.put(`/admin/users/${id}`, payload).then((res) => res.data.data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`).then((res) => res.data.data),
  assignProperty: (payload) => api.post('/admin/assign-property', payload).then((res) => res.data.data),
  removeProperty: (payload) => api.delete('/admin/remove-property', { data: payload }).then((res) => res.data.data),
};

export default adminService;
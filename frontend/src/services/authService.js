import api from './api';

const authService = {
  login: async (payload) => {
    const res = await api.post('/auth/login', payload);
    return res.data.data;
  },
};

export default authService;

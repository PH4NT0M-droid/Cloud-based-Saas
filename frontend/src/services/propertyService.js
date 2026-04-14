import api from './api';

const normalizePayload = (payload) => {
  const normalized = { ...payload };

  if (!normalized.managerId) {
    delete normalized.managerId;
  }

  return normalized;
};

const toRequestPayload = (payload) => {
  const normalized = normalizePayload(payload);

  if (!(normalized.propertyLogo instanceof File)) {
    return normalized;
  }

  const formData = new FormData();
  Object.entries(normalized).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    formData.append(key, value);
  });

  return formData;
};

const propertyService = {
  getAll: () => api.get('/properties').then((res) => res.data.data),
  getOverview: (id, params) => api.get(`/properties/${id}/overview`, { params }).then((res) => res.data.data),
  create: (payload) => api.post('/properties', toRequestPayload(payload)).then((res) => res.data.data),
  update: (id, payload) => api.put(`/properties/${id}`, toRequestPayload(payload)).then((res) => res.data.data),
  remove: (id) => api.delete(`/properties/${id}`),
};

export default propertyService;

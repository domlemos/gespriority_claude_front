import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/incidentes', { params }).then((res) => res.data)
  },
  dashboard(params = {}) {
    return api.get('/dashboard/incidentes', { params }).then((res) => res.data)
  },
  get(id) {
    return api.get(`/incidentes/${id}`).then((res) => res.data.data)
  },
  create(payload) {
    return api.post('/incidentes', payload).then((res) => res.data.data)
  },
  update(id, payload) {
    return api.put(`/incidentes/${id}`, payload).then((res) => res.data.data)
  },
}

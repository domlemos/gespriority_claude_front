import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/clients', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/clients', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/clients/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/clients/${id}`)
  },
}

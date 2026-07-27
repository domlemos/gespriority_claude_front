import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/politicas-sla', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/politicas-sla', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/politicas-sla/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/politicas-sla/${id}`)
  },
}

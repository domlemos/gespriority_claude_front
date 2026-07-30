import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/customers', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/customers', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/customers/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/customers/${id}`)
  },
}

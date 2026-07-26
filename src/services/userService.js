import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/users', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/users', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/users/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/users/${id}`)
  },
}

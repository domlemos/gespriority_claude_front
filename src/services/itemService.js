import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/itens', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/itens', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/itens/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/itens/${id}`)
  },
}

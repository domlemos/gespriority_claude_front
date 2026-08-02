import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/categorias', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/categorias', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/categorias/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/categorias/${id}`)
  },
}

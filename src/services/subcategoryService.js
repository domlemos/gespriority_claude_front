import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/subcategorias', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/subcategorias', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/subcategorias/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/subcategorias/${id}`)
  },
}

import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/grupos-solucao', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/grupos-solucao', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/grupos-solucao/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/grupos-solucao/${id}`)
  },
  getPermissions(id) {
    return api.get(`/grupos-solucao/${id}/permissoes`).then((res) => res.data)
  },
  updatePermissions(id, payload) {
    return api.put(`/grupos-solucao/${id}/permissoes`, payload).then((res) => res.data)
  },
}

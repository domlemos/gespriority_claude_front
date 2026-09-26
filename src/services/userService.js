import api from '@/services/api'

export default {
  // Lista enxuta e sem paginação pra selects de telas operacionais (painel,
  // chamado, relatórios) — liberada a quem vê chamados/relatórios, ao
  // contrário do CRUD (`list`), que exige permissão de administração.
  lookup() {
    return api.get('/lookups/users').then((res) => res.data)
  },
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
  sendInvite(id) {
    return api.post(`/users/${id}/convite`).then((res) => res.data)
  },
  getVisibleGroups(id) {
    return api.get(`/users/${id}/grupos-visiveis`).then((res) => res.data)
  },
  updateVisibleGroups(id, payload) {
    return api.put(`/users/${id}/grupos-visiveis`, payload).then((res) => res.data)
  },
}

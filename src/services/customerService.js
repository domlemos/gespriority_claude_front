import api from '@/services/api'

export default {
  // Lista enxuta e sem paginação pra selects de telas operacionais (painel,
  // chamado, relatórios) — liberada a quem vê chamados/relatórios, ao
  // contrário do CRUD (`list`), que exige permissão de administração.
  lookup() {
    return api.get('/lookups/customers').then((res) => res.data)
  },
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
  sendInvite(id) {
    return api.post(`/customers/${id}/convite`).then((res) => res.data)
  },
}

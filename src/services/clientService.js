import api from '@/services/api'

export default {
  // Lista enxuta e sem paginação pra selects de telas operacionais (painel,
  // chamado, relatórios) — liberada a quem vê chamados/relatórios, ao
  // contrário do CRUD (`list`), que exige permissão de administração.
  lookup() {
    return api.get('/lookups/clients').then((res) => res.data)
  },
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

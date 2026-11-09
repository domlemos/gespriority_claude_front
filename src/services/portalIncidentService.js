import api from '@/services/api'

// Portal do cliente (guard "customer") — só os próprios chamados, sem dados
// internos do atendimento (ver Portal\IncidenteController no backend).
export default {
  list(params = {}) {
    return api.get('/customer/incidentes', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/customer/incidentes', payload).then((res) => res.data.data)
  },
}

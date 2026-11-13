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
  // Detalhe com `descricoes`: só a abertura, os comentários do próprio
  // cliente e a mensagem de encerramento — o resto do feed é interno.
  get(id) {
    return api.get(`/customer/incidentes/${id}`).then((res) => res.data.data)
  },
  comment(id, descricao) {
    return api.post(`/customer/incidentes/${id}/comentarios`, { descricao }).then((res) => res.data.data)
  },
  // Só chamado fechado, até 7 dias do fechamento (regra no backend). Devolve
  // o chamado no formato do detalhe, já reaberto.
  reopen(id, motivo) {
    return api.post(`/customer/incidentes/${id}/reabrir`, { motivo }).then((res) => res.data.data)
  },
}

import api from '@/services/api'

// Log de ações (Administração > Logs de ações). A API exige período
// (data_inicio/data_fim) — a tela nunca consulta sem filtro.
export default {
  options() {
    return api.get('/audit-logs/opcoes').then((res) => res.data)
  },
  search(params = {}) {
    return api.get('/audit-logs', { params }).then((res) => res.data)
  },
}

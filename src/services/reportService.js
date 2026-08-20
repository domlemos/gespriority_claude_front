import api from '@/services/api'

export default {
  gerar(params = {}) {
    if (params.formato === 'xlsx') {
      return api.get('/relatorios/incidentes', { params, responseType: 'blob' }).then((res) => res.data)
    }
    return api.get('/relatorios/incidentes', { params }).then((res) => res.data)
  },
  listSaved(params = {}) {
    return api.get('/relatorios-salvos', { params }).then((res) => res.data)
  },
  createSaved(payload) {
    return api.post('/relatorios-salvos', payload).then((res) => res.data.data)
  },
  removeSaved(id) {
    return api.delete(`/relatorios-salvos/${id}`)
  },
  executarSaved(id, formato = 'json') {
    if (formato === 'xlsx') {
      return api
        .get(`/relatorios-salvos/${id}/executar`, { params: { formato }, responseType: 'blob' })
        .then((res) => res.data)
    }
    return api.get(`/relatorios-salvos/${id}/executar`, { params: { formato } }).then((res) => res.data)
  },
}

import api from '@/services/api'

export default {
  list(incidentId, params = {}) {
    return api
      .get(`/incidentes/${incidentId}/descricoes`, { params })
      .then((res) => res.data)
  },
  create(incidentId, payload) {
    return api
      .post(`/incidentes/${incidentId}/descricoes`, payload)
      .then((res) => res.data.data)
  },
  // Resposta ao cliente: entra no feed como 'resposta', aparece no portal e
  // vai por e-mail ao cliente. Imutável depois de enviada.
  reply(incidentId, payload) {
    return api
      .post(`/incidentes/${incidentId}/respostas`, payload)
      .then((res) => res.data.data)
  },
  update(incidentId, descriptionId, payload) {
    return api
      .put(`/incidentes/${incidentId}/descricoes/${descriptionId}`, payload)
      .then((res) => res.data.data)
  },
  remove(incidentId, descriptionId) {
    return api.delete(`/incidentes/${incidentId}/descricoes/${descriptionId}`)
  },
}

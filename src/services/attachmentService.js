import api from '@/services/api'

export default {
  list(incidentId, params = {}) {
    return api.get(`/incidentes/${incidentId}/anexos`, { params }).then((res) => res.data)
  },
  upload(incidentId, file) {
    const formData = new FormData()
    formData.append('arquivo', file)
    return api
      .post(`/incidentes/${incidentId}/anexos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data.data)
  },
  download(incidentId, attachmentId) {
    return api
      .get(`/incidentes/${incidentId}/anexos/${attachmentId}/download`, { responseType: 'blob' })
      .then((res) => res.data)
  },
  remove(incidentId, attachmentId) {
    return api.delete(`/incidentes/${incidentId}/anexos/${attachmentId}`)
  },
}

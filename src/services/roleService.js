import api from '@/services/api'

export default {
  list() {
    return api.get('/roles').then((res) => res.data)
  },
}

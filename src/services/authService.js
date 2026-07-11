import api from '@/services/api'

const loginPath = (guard) => (guard === 'customer' ? '/customer/login' : '/login')
const forgotPath = (guard) => (guard === 'customer' ? '/customer/forgot-password' : '/forgot-password')
const resetPath = (guard) => (guard === 'customer' ? '/customer/reset-password' : '/reset-password')

export default {
  login(guard, credentials) {
    return api.post(loginPath(guard), credentials).then((res) => res.data)
  },
  me() {
    return api.get('/me').then((res) => res.data)
  },
  refresh() {
    return api.post('/refresh').then((res) => res.data)
  },
  logout() {
    return api.post('/logout').then((res) => res.data)
  },
  logoutAll() {
    return api.post('/logout-all').then((res) => res.data)
  },
  forgotPassword(guard, email) {
    return api.post(forgotPath(guard), { email }).then((res) => res.data)
  },
  resetPassword(guard, payload) {
    return api.post(resetPath(guard), payload).then((res) => res.data)
  },
}

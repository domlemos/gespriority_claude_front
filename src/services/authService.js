import api from '@/services/api'

// Rotas por perfil: o mesmo navegador pode ter sessão de staff e de cliente
// ao mesmo tempo, então "quem sou eu"/"sair" dizem de qual perfil.
const prefixo = (guard) => (guard === 'customer' ? '/customer' : '')

export default {
  login(guard, credentials) {
    return api.post(`${prefixo(guard)}/login`, credentials).then((res) => res.data)
  },
  me(guard) {
    return api.get(`${prefixo(guard)}/me`).then((res) => res.data)
  },
  logout(guard) {
    return api.post(`${prefixo(guard)}/logout`).then((res) => res.data)
  },
  logoutAll(guard) {
    return api.post(`${prefixo(guard)}/logout-all`).then((res) => res.data)
  },
  forgotPassword(guard, email) {
    return api.post(`${prefixo(guard)}/forgot-password`, { email }).then((res) => res.data)
  },
  resetPassword(guard, payload) {
    return api.post(`${prefixo(guard)}/reset-password`, payload).then((res) => res.data)
  },
}

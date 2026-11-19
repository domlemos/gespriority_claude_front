import { defineStore } from 'pinia'
import authService from '@/services/authService'
import { definirCsrf } from '@/services/csrf'
import api from '@/services/api'
import {
  currentLocale,
  fromBackendLocale,
  hasExplicitLocale,
  setLocale,
  toBackendLocale,
} from '@/plugins/i18n'

// Sessão por cookie HttpOnly (Sanctum SPA, padrão OWASP): o front nunca vê
// nem guarda credencial — nada em sessionStorage/localStorage. O estado aqui
// é só "quem está logado neste perfil", conferido com o backend (`/me`) ao
// abrir a aplicação ou ao entrar numa rota de outro perfil. Como o cookie vale
// para o site todo, uma aba nova já nasce logada. Ver BACKEND_SPECS.md §1.3.

// Chave do armazenamento antigo (token em sessionStorage) — limpa na
// primeira carga para não deixar token velho para trás.
const CHAVE_LEGADA = 'upITSM.auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    guard: null, // 'web' (staff) | 'customer'
    user: null,
    // Perfis já conferidos com o backend nesta carga da aplicação.
    conferidos: { web: false, customer: false },
    hydrated: false,
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.user),
    isStaff: (state) => state.guard === 'web',
    isCustomer: (state) => state.guard === 'customer',
    roles: (state) => state.user?.roles ?? [],
    permissions: (state) => state.user?.permissions ?? [],
  },

  actions: {
    hasPermission(slug) {
      return this.permissions.includes(slug)
    },

    async login(guard, credentials) {
      const data = await authService.login(guard, credentials)
      if (data.csrf_token) definirCsrf(data.csrf_token)
      this.guard = guard
      this.user = data.user
      this.conferidos[guard] = true
      this.syncLocale()
      return data
    },

    async fetchMe() {
      if (!this.guard) return null
      const user = await authService.me(this.guard)
      this.user = user
      this.syncLocale()
      return user
    },

    // Confere com o backend se há sessão do perfil pedido (uma vez por carga).
    // Achou: passa a ser o perfil ativo desta aba.
    async conferir(guard) {
      if (this.guard === guard && this.user) return true
      if (this.conferidos[guard]) return false

      this.conferidos[guard] = true

      try {
        const user = await authService.me(guard)
        this.guard = guard
        this.user = user
        this.syncLocale()
        return true
      } catch {
        return false
      }
    },

    // Chamada depois de carregar o usuário. Escolha explícita neste navegador
    // vence e vai ao servidor se diferir; sem escolha, adota a do servidor.
    // Aplicar o locale do servidor usa setLocale direto (não saveLocale): sem eco/loop.
    syncLocale() {
      if (!this.user) return
      const serverLocale = fromBackendLocale(this.user.locale)
      if (hasExplicitLocale()) {
        if (currentLocale() !== serverLocale) return this.saveLocale(currentLocale())
      } else {
        setLocale(serverLocale)
      }
    },

    // Grava a escolha do seletor na conta (no-op deslogado). Falha só loga.
    async saveLocale(locale) {
      if (!this.isAuthenticated) return
      try {
        const prefixo = this.guard === 'customer' ? '/customer' : ''
        await api.patch(`${prefixo}/me/locale`, { locale: toBackendLocale(locale) })
        this.user = { ...this.user, locale: toBackendLocale(locale) }
      } catch (error) {
        console.warn('Could not save the language preference to the account.', error)
      }
    },

    async logout() {
      try {
        const data = await authService.logout(this.guard)
        if (data?.csrf_token) definirCsrf(data.csrf_token)
      } finally {
        this.clearState()
      }
    },

    async logoutAll() {
      try {
        const data = await authService.logoutAll(this.guard)
        if (data?.csrf_token) definirCsrf(data.csrf_token)
      } finally {
        this.clearState()
      }
    },

    forgotPassword(guard, email) {
      return authService.forgotPassword(guard, email)
    },

    resetPassword(guard, payload) {
      return authService.resetPassword(guard, payload)
    },

    clearState() {
      if (this.guard) this.conferidos[this.guard] = true
      this.guard = null
      this.user = null
    },

    // Interceptor 401 do axios: a sessão expirou/foi invalidada no servidor.
    forceLogout() {
      this.clearState()
    },

    hydrate() {
      try {
        sessionStorage.removeItem(CHAVE_LEGADA)
      } catch {
        // armazenamento indisponível: nada a limpar
      }
      this.hydrated = true
    },
  },
})

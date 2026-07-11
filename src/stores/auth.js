import { defineStore } from 'pinia'
import authService from '@/services/authService'

const STORAGE_KEY = 'itsm.auth'

// sessionStorage (não localStorage) por decisão da spec do backend: minimiza
// exposição a XSS, mas ainda permite sobreviver a um reload de página — o
// ideal seria manter só em memória, mas isso derrubaria a sessão a cada F5.
function persist(state) {
  if (!state.token) {
    sessionStorage.removeItem(STORAGE_KEY)
    return
  }

  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token: state.token,
      guard: state.guard,
      expiresAt: state.expiresAt,
      user: state.user,
    }),
  )
}

function readPersisted() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    return null
  }
}

let refreshTimeoutId = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null,
    guard: null, // 'web' (staff) | 'customer'
    user: null,
    expiresAt: null,
    hydrated: false,
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    isStaff: (state) => state.guard === 'web',
    isCustomer: (state) => state.guard === 'customer',
    roles: (state) => state.user?.roles ?? [],
    permissions: (state) => state.user?.permissions ?? [],
  },

  actions: {
    hasPermission(slug) {
      return this.permissions.includes(slug)
    },

    setSession({ token, expires_at: expiresAt, user }, guard) {
      this.token = token
      this.guard = guard
      this.user = user
      this.expiresAt = expiresAt
      persist(this.$state)
      this.scheduleRefresh()
    },

    async login(guard, credentials) {
      const data = await authService.login(guard, credentials)
      this.setSession(data, guard)
      return data
    },

    async fetchMe() {
      const user = await authService.me()
      this.user = user
      persist(this.$state)
      return user
    },

    async refresh() {
      try {
        const data = await authService.refresh()
        this.token = data.token
        this.expiresAt = data.expires_at
        persist(this.$state)
        this.scheduleRefresh()
      } catch {
        this.forceLogout()
      }
    },

    scheduleRefresh() {
      if (refreshTimeoutId) clearTimeout(refreshTimeoutId)
      if (!this.expiresAt) return

      const msUntilExpiry = new Date(this.expiresAt).getTime() - Date.now()
      // Aos 80% do TTL, conforme sugerido na spec do backend (seção 1.3).
      const delay = Math.max(msUntilExpiry * 0.8, 5_000)

      refreshTimeoutId = setTimeout(() => this.refresh(), delay)
    },

    async logout() {
      try {
        await authService.logout()
      } finally {
        this.clearState()
      }
    },

    async logoutAll() {
      try {
        await authService.logoutAll()
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
      if (refreshTimeoutId) clearTimeout(refreshTimeoutId)
      refreshTimeoutId = null
      this.token = null
      this.guard = null
      this.user = null
      this.expiresAt = null
      sessionStorage.removeItem(STORAGE_KEY)
    },

    // Usado pelo interceptor 401 do axios — sem chamar o backend de volta
    // (o token já é inválido do lado do servidor).
    forceLogout() {
      this.clearState()
    },

    // Restaura a sessão do sessionStorage e confirma com o backend que o
    // token ainda é válido (pode ter expirado enquanto a aba ficava fechada).
    async hydrate() {
      const saved = readPersisted()

      if (saved?.token) {
        this.token = saved.token
        this.guard = saved.guard
        this.user = saved.user
        this.expiresAt = saved.expiresAt

        try {
          await this.fetchMe()
          this.scheduleRefresh()
        } catch {
          this.clearState()
        }
      }

      this.hydrated = true
    },
  },
})

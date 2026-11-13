import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { garantirCsrf } from '@/services/csrf'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

// withCredentials: o navegador envia o cookie de sessão HttpOnly da API. Não
// há header Authorization — o front não tem token (BACKEND_SPECS.md §1.3).
const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

const METODOS_DE_ESCRITA = ['post', 'put', 'patch', 'delete']

api.interceptors.request.use(async (config) => {
  if (METODOS_DE_ESCRITA.includes((config.method ?? 'get').toLowerCase())) {
    config.headers['X-CSRF-TOKEN'] = await garantirCsrf(baseURL)
  }

  // Axios serializes JS booleans as the literal strings "true"/"false", but
  // Laravel's `boolean` validation rule only accepts true/false, 0/1, '0'/'1'
  // — not those word-strings. Normalize to 0/1 here, once, for every request,
  // instead of in each service/view that happens to send a boolean filter.
  if (config.params) {
    for (const key of Object.keys(config.params)) {
      if (typeof config.params[key] === 'boolean') {
        config.params[key] = config.params[key] ? 1 : 0
      }
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config ?? {}
    const status = error.response?.status

    // 419 = token CSRF vencido (sessão expirou ou foi trocada): busca outro e
    // repete a requisição uma única vez.
    if (status === 419 && !config._csrfRenovado) {
      config._csrfRenovado = true
      config.headers['X-CSRF-TOKEN'] = await garantirCsrf(baseURL, { renovar: true })
      return api(config)
    }

    // 401 fora do login/"quem sou eu": a sessão expirou ou foi invalidada.
    const rotaDeSessao = ['/login', '/me'].some((path) => config.url?.endsWith(path))
    if (status === 401 && !rotaDeSessao) {
      useAuthStore().forceLogout()
    }

    return Promise.reject(error)
  },
)

export default api

import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
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
  (error) => {
    const isAuthRoute = ['/login', '/refresh'].some((path) =>
      error.config?.url?.includes(path),
    )

    if (error.response?.status === 401 && !isAuthRoute) {
      useAuthStore().forceLogout()
    }

    return Promise.reject(error)
  },
)

export default api

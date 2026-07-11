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

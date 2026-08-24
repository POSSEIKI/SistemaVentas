import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({ baseURL: BASE_URL, timeout: 120000 })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    const msg = error.response?.data?.detail || error.message || 'Error de conexión'
    return Promise.reject(new Error(msg))
  }
)

export default api

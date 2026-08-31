import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const PRODUCTION_API_URL = 'https://factur-aap-api.onrender.com/api/v1'

let rawBase = (import.meta.env.VITE_API_URL || '').trim()

// Si estamos en producción (en Vercel o en cualquier dominio web), apuntar directamente a Render
if (!rawBase || rawBase === '/api/v1') {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    rawBase = PRODUCTION_API_URL
  } else {
    rawBase = '/api/v1'
  }
}

if (rawBase.startsWith('http') && !rawBase.includes('/api/v1')) {
  rawBase = rawBase.replace(/\/+$/, '') + '/api/v1'
}

const BASE_URL = rawBase

const api = axios.create({ baseURL: BASE_URL, timeout: 90000 })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const config = error.config
    if (!config) return Promise.reject(error)

    // Configurar contador de reintentos para desconexiones o reinicios de servidor
    config.__retryCount = config.__retryCount || 0

    const isNetworkOrServerRestart = 
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.message === 'Network Error' ||
      [502, 503, 504].includes(error.response?.status)

    // Si el servidor se está reiniciando/despertando, reintentar hasta 3 veces automáticamente
    if (isNetworkOrServerRestart && config.__retryCount < 3) {
      config.__retryCount += 1
      const delayMs = config.__retryCount * 1200 // 1.2s, 2.4s, 3.6s
      await new Promise((res) => setTimeout(res, delayMs))
      return api(config)
    }

    const isLoginRequest = config.url?.includes('/auth/login')
    const isAuthPage = typeof window !== 'undefined' && (window.location.pathname.includes('/login') || window.location.pathname.includes('/registro'))

    if (error.response?.status === 401 && !isLoginRequest && !isAuthPage) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }

    let msg = error.response?.data?.detail
    if (Array.isArray(msg)) {
      msg = msg.map(e => e.msg || JSON.stringify(e)).join(', ')
    } else if (typeof msg === 'object' && msg !== null) {
      msg = msg.mensaje || msg.detail || JSON.stringify(msg)
    }

    if (!msg) {
      if (error.response?.data?.mensaje) {
        msg = error.response.data.mensaje
      } else if (error.response?.status === 403) {
        msg = 'No tienes permisos de administrador para realizar esta acción.'
      } else if (error.response?.status === 404) {
        msg = 'Recurso no encontrado en el servidor.'
      } else if (error.response?.status >= 500) {
        msg = 'Error interno del servidor. Por favor reintenta.'
      } else if (isNetworkOrServerRestart) {
        msg = 'El servidor se está reconectando. Por favor reintenta en unos segundos.'
      } else {
        msg = error.message || 'Error de conexión con el servidor'
      }
    }
    return Promise.reject(new Error(msg))
  }
)

export default api

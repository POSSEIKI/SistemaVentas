import { create } from 'zustand'

const TOKEN_KEY = 'sv_token'
const USER_KEY  = 'sv_user'

export const useAuthStore = create((set, get) => ({
  token:   sessionStorage.getItem(TOKEN_KEY) || null,
  usuario: JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'),

  setAuth: (token, usuario) => {
    sessionStorage.setItem(TOKEN_KEY, token)
    sessionStorage.setItem(USER_KEY, JSON.stringify(usuario))
    set({ token, usuario })
  },

  logout: () => {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    set({ token: null, usuario: null })
  },

  tienePermiso: (permiso) => {
    const u = get().usuario
    if (!u) return false
    if (u.permisos?.administrador_total) return true
    return !!u.permisos?.[permiso]
  },

  esAdmin: () => get().usuario?.permisos?.administrador_total === true,
}))

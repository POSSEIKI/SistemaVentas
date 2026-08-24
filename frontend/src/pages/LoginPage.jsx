import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../api/services'
import { ShoppingCart, Lock, User, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !codigo.trim()) {
      setError('Ingresa tu usuario y código')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await authApi.login(username.trim(), codigo.trim())
      setAuth(data.access_token, {
        id: data.usuario_id,
        nombre: data.nombre,
        username: data.username,
        rol: data.rol,
        permisos: data.permisos,
      })
      toast.success(`¡Bienvenido, ${data.nombre}!`)
      navigate('/ventas')
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <ShoppingCart size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SistemaVentas</h1>
          <p className="text-dark-500 text-sm mt-1">Ingresa tus credenciales</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-dark-500 mb-2">
              Usuario
            </label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="tu_usuario"
                autoCapitalize="none"
                autoCorrect="off"
                className="input-field pl-10"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-500 mb-2">
              Código PIN
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                type="password"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder="••••••"
                inputMode="numeric"
                className="input-field pl-10"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full text-center"
            disabled={loading}
          >
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-dark-500 text-xs mt-6">
          SistemaVentas v1.0.0
        </p>
      </div>
    </div>
  )
}

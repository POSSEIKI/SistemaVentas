import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../api/services'
import { ShoppingCart, Lock, User, Mail, AlertCircle, ArrowLeft, ArrowRight, Sparkles, UserPlus } from 'lucide-react'
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
      setError('Ingresa tu correo / usuario y contraseña o PIN')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await authApi.login(username.trim().toLowerCase(), codigo.trim())
      setAuth(data.access_token, {
        id: data.usuario_id,
        nombre: data.nombre,
        username: data.username,
        rol: data.rol,
        permisos: data.permisos,
      })
      toast.success(`¡Bienvenido, ${data.nombre}!`)
      
      const esSuper = data.rol === 'SUPER_ADMIN' || data.permisos?.super_admin || data.username === 'superadmin'
      if (esSuper) {
        navigate('/super-admin')
      } else {
        navigate('/ventas')
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white font-sans antialiased py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Glow ambient */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Header */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Volver al Inicio</span>
        </Link>

        <Link
          to="/registro"
          className="text-xs sm:text-sm font-semibold text-emerald-400 hover:underline"
        >
          Crear cuenta
        </Link>
      </div>

      {/* Main Card */}
      <div className="max-w-md mx-auto w-full">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative z-10">
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-8">
            <Link to="/" className="w-14 h-14 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/25 hover:scale-105 transition-transform">
              <ShoppingCart size={28} className="text-white" />
            </Link>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Iniciar Sesión</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Ingresa tu correo electrónico y contraseña para acceder</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 text-red-400 bg-red-950/40 border border-red-800/80 rounded-xl px-4 py-3 text-xs sm:text-sm">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo Electrónico <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="username email"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="tu_correo@ejemplo.com (o usuario)"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Contraseña / PIN de Acceso <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? (
                <span className="animate-pulse">Verificando acceso...</span>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Sign Up Banner CTA */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-400 mb-3">¿Eres nuevo o quieres registrar tu droguería?</p>
            <Link
              to="/registro"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <UserPlus size={14} />
              <span>Crear Nueva Cuenta (14 Días Gratis)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto w-full text-center text-xs text-slate-500">
        FACTUR-AAP Cloud • Alta Disponibilidad & Cifrado SSL
      </div>
    </div>
  )
}

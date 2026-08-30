import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { suscripcionesApi } from '../api/services'
import {
  ShoppingCart, Building2, User, Lock, Mail, Phone,
  MapPin, CheckCircle, AlertCircle, ArrowRight, ArrowLeft,
  Sparkles, ShieldCheck, Pill, Wrench, Store, Briefcase
} from 'lucide-react'
import toast from 'react-hot-toast'

const RUBROS = [
  { id: 'FARMACIA', label: 'Droguería / Farmacia', icon: Pill, desc: 'Fraccionamiento caja/blíster/unidad, lotes y vencimientos' },
  { id: 'FERRETERIA', label: 'Ferretería / Eléctricos', icon: Wrench, desc: 'Metros, kilos, unidades y artículos técnicos' },
  { id: 'MINIMARKET', label: 'Minimarket / Supermercado', icon: Store, desc: 'Ventas de alta rotación, lectores de código de barras' },
  { id: 'COMERCIO_GENERAL', label: 'Comercio General / Ropa / Varios', icon: Briefcase, desc: 'Punto de venta y control de inventario' },
]

export default function SignUpPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const initialPlan = searchParams.get('plan') || 'PRO'
  const initialPeriodo = searchParams.get('periodo') || 'MENSUAL'

  const [paso, setPaso] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    empresa_nombre: '',
    empresa_nit: '',
    empresa_ciudad: '',
    empresa_telefono: '',
    empresa_direccion: '',
    rubro: 'FARMACIA',
    admin_nombre: '',
    admin_username: '',
    admin_email: '',
    admin_codigo: '',
    admin_codigo_confirm: '',
    plan_codigo: initialPlan,
    periodo: initialPeriodo,
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleNextStep1 = (e) => {
    e.preventDefault()
    if (!formData.empresa_nombre.trim()) {
      setError('Por favor ingresa el nombre de tu negocio o empresa')
      return
    }
    setError('')
    setPaso(2)
  }

  const handleNextStep2 = (e) => {
    e.preventDefault()
    if (!formData.admin_nombre.trim()) {
      setError('Ingresa el nombre del administrador')
      return
    }
    if (!formData.admin_email.trim() || !formData.admin_email.includes('@')) {
      setError('Ingresa un correo electrónico válido para tu cuenta')
      return
    }
    if (!formData.admin_username.trim()) {
      setError('Ingresa un nombre de usuario para acceder')
      return
    }
    if (!formData.admin_codigo.trim() || formData.admin_codigo.length < 4) {
      setError('La contraseña o PIN de acceso debe tener mínimo 4 caracteres')
      return
    }
    if (formData.admin_codigo !== formData.admin_codigo_confirm) {
      setError('Las contraseñas o PIN no coinciden')
      return
    }
    setError('')
    setPaso(3)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const payload = {
        empresa_nombre: formData.empresa_nombre.trim(),
        empresa_nit: formData.empresa_nit.trim(),
        empresa_ciudad: formData.empresa_ciudad.trim(),
        empresa_telefono: formData.empresa_telefono.trim(),
        empresa_direccion: formData.empresa_direccion.trim(),
        rubro: formData.rubro,
        admin_nombre: formData.admin_nombre.trim(),
        admin_username: formData.admin_username.trim().toLowerCase(),
        admin_email: formData.admin_email.trim(),
        admin_codigo: formData.admin_codigo.trim(),
        plan_codigo: formData.plan_codigo,
        periodo: formData.periodo,
      }

      const res = await suscripcionesApi.registroEmpresa(payload)

      setAuth(res.access_token, {
        id: res.usuario_id,
        nombre: res.nombre,
        username: res.username,
        rol: res.rol,
        permisos: res.permisos,
        empresa: res.empresa,
        suscripcion: res.suscripcion,
      })

      toast.success(`¡Bienvenido a FACTUR-AAP, ${res.nombre}! Tu prueba gratis de 14 días ha iniciado.`, {
        duration: 5000
      })
      navigate('/ventas')
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Error registrando la empresa'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white font-sans antialiased py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Glow ambient background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Header */}
      <div className="max-w-xl mx-auto w-full flex items-center justify-between mb-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <ShoppingCart size={20} className="text-white" />
          </div>
          <span className="font-extrabold text-white text-lg tracking-tight group-hover:text-emerald-400 transition-colors">
            FACTUR-AAP
          </span>
        </Link>

        <Link
          to="/login"
          className="text-xs sm:text-sm font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
        >
          ¿Ya tienes cuenta? <span className="text-emerald-400 underline">Inicia Sesión</span>
        </Link>
      </div>

      {/* Card Container */}
      <div className="max-w-xl mx-auto w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative z-10">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              paso === 1 ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : paso > 1 ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-slate-800 text-slate-400'
            }`}>
              1
            </div>
            <span className={`text-xs font-semibold ${paso === 1 ? 'text-white' : 'text-slate-500'}`}>Negocio</span>
          </div>

          <div className="w-8 h-0.5 bg-slate-800" />

          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              paso === 2 ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : paso > 2 ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-slate-800 text-slate-400'
            }`}>
              2
            </div>
            <span className={`text-xs font-semibold ${paso === 2 ? 'text-white' : 'text-slate-500'}`}>Acceso</span>
          </div>

          <div className="w-8 h-0.5 bg-slate-800" />

          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              paso === 3 ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : 'bg-slate-800 text-slate-400'
            }`}>
              3
            </div>
            <span className={`text-xs font-semibold ${paso === 3 ? 'text-white' : 'text-slate-500'}`}>Plan & Activación</span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 text-red-400 bg-red-950/40 border border-red-800/80 rounded-xl px-4 py-3 mb-6 text-sm">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ─── PASO 1: DATOS DEL NEGOCIO ───────────────────────────────────── */}
        {paso === 1 && (
          <form onSubmit={handleNextStep1} className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">Datos de tu Negocio</h2>
              <p className="text-xs text-slate-400 mt-1">Ingresa la información básica de tu droguería o comercio.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombre del Negocio / Droguería <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Building2 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  name="empresa_nombre"
                  value={formData.empresa_nombre}
                  onChange={handleChange}
                  placeholder="Ej: Droguería La Esperanza"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">NIT o Cédula (Opcional)</label>
                <input
                  type="text"
                  name="empresa_nit"
                  value={formData.empresa_nit}
                  onChange={handleChange}
                  placeholder="Ej: 900123456-1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Ciudad</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    name="empresa_ciudad"
                    value={formData.empresa_ciudad}
                    onChange={handleChange}
                    placeholder="Ej: Bogotá, Medellín..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Tipo de Negocio / Rubro
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(Array.isArray(RUBROS) ? RUBROS : []).map((r) => {
                  const Icon = r.icon
                  const selected = formData.rubro === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, rubro: r.id }))}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        selected
                          ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Icon size={20} className={selected ? 'text-emerald-400' : 'text-slate-500'} />
                      <div>
                        <div className="text-xs font-bold text-white">{r.label}</div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{r.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
              >
                <span>Continuar a Crear Cuenta</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* ─── PASO 2: DATOS DE ACCESO / ADMINISTRADOR ─────────────────────── */}
        {paso === 2 && (
          <form onSubmit={handleNextStep2} className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">Tu Cuenta de Administrador</h2>
              <p className="text-xs text-slate-400 mt-1">Con estos datos iniciarás sesión en el sistema POS.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombre Completo <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  name="admin_nombre"
                  value={formData.admin_nombre}
                  onChange={handleChange}
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nombre de Usuario <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  name="admin_username"
                  value={formData.admin_username}
                  onChange={handleChange}
                  placeholder="Ej: adminesperanza"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Teléfono / WhatsApp</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    name="empresa_telefono"
                    value={formData.empresa_telefono}
                    onChange={handleChange}
                    placeholder="Ej: 3001234567"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo Electrónico <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  name="admin_email"
                  value={formData.admin_email}
                  onChange={handleChange}
                  placeholder="admin@midrogueria.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Contraseña o PIN (Mín. 4 dígitos) <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    name="admin_codigo"
                    value={formData.admin_codigo}
                    onChange={handleChange}
                    placeholder="••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirmar Contraseña / PIN <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    name="admin_codigo_confirm"
                    value={formData.admin_codigo_confirm}
                    onChange={handleChange}
                    placeholder="••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPaso(1)}
                className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm flex items-center justify-center gap-1.5 transition-all"
              >
                <ArrowLeft size={16} />
                <span>Atrás</span>
              </button>
              <button
                type="submit"
                className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
              >
                <span>Revisar Plan & Activar</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* ─── PASO 3: CONFIRMACIÓN DE PLAN & ACTIVACIÓN ───────────────────── */}
        {paso === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Confirma y Activa tu Prueba Gratis</h2>
              <p className="text-xs text-slate-400 mt-1">Obtén 14 días con acceso total a todas las funciones.</p>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-b from-emerald-950/40 to-slate-950 border border-emerald-600/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Plan Seleccionado</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold">
                  14 DÍAS GRATIS
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">
                {formData.plan_codigo === 'BASICO' ? 'Plan Emprendedor' : formData.plan_codigo === 'ENTERPRISE' ? 'Plan Empresarial & Multi-Sede' : 'Plan Pro Negocios'}
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                {formData.plan_codigo === 'BASICO'
                  ? 'Punto de venta esencial, control de inventario, tickets y cuadre de caja.'
                  : formData.plan_codigo === 'ENTERPRISE'
                  ? 'Multi-sucursales, reportes gerenciales, auditoría avanzada y backups dedicados.'
                  : 'Productos y ventas ilimitadas, facturas electrónicas DIAN, importador de facturas y control total de inventario.'}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Total a pagar hoy:</span>
                <span className="text-emerald-400 font-extrabold text-base">$0 COP</span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 text-xs space-y-2 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Negocio:</span>
                <span className="font-semibold text-white">{formData.empresa_nombre} ({formData.rubro})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Administrador:</span>
                <span className="font-semibold text-white">{formData.admin_nombre} (@{formData.admin_username})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Período de prueba:</span>
                <span className="font-semibold text-emerald-400">14 Días Ilimitados</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setPaso(2)}
                className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm flex items-center justify-center gap-1.5 transition-all"
              >
                <ArrowLeft size={16} />
                <span>Atrás</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSubmit}
                className="flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 hover:scale-[1.01] transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="animate-pulse">Activando tu cuenta...</span>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>¡Activar mi Prueba Gratis y Entrar!</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="max-w-xl mx-auto w-full text-center text-xs text-slate-500 mt-6">
        Al registrarte aceptas los términos de servicio. Soporte 24/7 disponible para ayudarte a configurar tu catálogo.
      </div>
    </div>
  )
}

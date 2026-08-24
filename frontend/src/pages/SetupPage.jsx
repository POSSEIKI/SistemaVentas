import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/services'
import { ShoppingCart, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const PASOS = ['Administrador', 'Empresa']

export default function SetupPage({ onSetupComplete }) {
  const [paso, setPaso] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const [form, setForm] = useState({
    admin_nombre: '',
    admin_username: '',
    admin_codigo: '',
    admin_codigo2: '',
    empresa_nombre: '',
    empresa_nit: '',
    empresa_telefono: '',
    empresa_ciudad: '',
    empresa_direccion: '',
  })

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  const validarPaso1 = () => {
    if (!form.admin_nombre.trim()) return 'Ingresa tu nombre completo'
    if (!form.admin_username.trim()) return 'Ingresa un nombre de usuario'
    if (form.admin_codigo.length < 4) return 'El código debe tener al menos 4 caracteres'
    if (form.admin_codigo !== form.admin_codigo2) return 'Los códigos no coinciden'
    return null
  }

  const siguientePaso = () => {
    setError('')
    if (paso === 0) {
      const err = validarPaso1()
      if (err) { setError(err); return }
    }
    setPaso(p => p + 1)
  }

  const handleSubmit = async () => {
    if (!form.empresa_nombre.trim()) { setError('Ingresa el nombre de la empresa'); return }
    setLoading(true)
    setError('')
    try {
      await authApi.setup({
        admin_nombre: form.admin_nombre,
        admin_username: form.admin_username,
        admin_codigo: form.admin_codigo,
        empresa_nombre: form.empresa_nombre,
        empresa_nit: form.empresa_nit,
        empresa_telefono: form.empresa_telefono,
        empresa_ciudad: form.empresa_ciudad,
        empresa_direccion: form.empresa_direccion,
      })
      toast.success('¡Sistema configurado! Ahora inicia sesión.')
      onSetupComplete?.()
      navigate('/login')
    } catch (err) {
      setError(err.message || 'Error al configurar el sistema')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mb-4">
            <ShoppingCart size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Configuración inicial</h1>
          <p className="text-dark-500 text-sm mt-1">Solo se hace una vez</p>
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {PASOS.map((nombre, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${i < paso ? 'bg-primary-600 text-white'
                : i === paso ? 'bg-primary-600 text-white ring-4 ring-primary-900'
                : 'bg-dark-700 text-dark-500'}`}>
                {i < paso ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span className={`text-sm ${i === paso ? 'text-white font-medium' : 'text-dark-500'}`}>
                {nombre}
              </span>
              {i < PASOS.length - 1 && (
                <div className={`w-8 h-0.5 ${i < paso ? 'bg-primary-600' : 'bg-dark-700'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="card space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Paso 1: Datos del administrador */}
          {paso === 0 && (
            <>
              <h2 className="text-lg font-semibold text-white">Cuenta de administrador</h2>
              <div>
                <label className="block text-sm text-dark-500 mb-1">Nombre completo *</label>
                <input
                  className="input-field"
                  value={form.admin_nombre}
                  onChange={e => set('admin_nombre', e.target.value)}
                  placeholder="Felipe García"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-500 mb-1">Nombre de usuario *</label>
                <input
                  className="input-field"
                  value={form.admin_username}
                  onChange={e => set('admin_username', e.target.value.toLowerCase())}
                  placeholder="admin"
                  autoCapitalize="none"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-500 mb-1">Código PIN * (mínimo 4 caracteres)</label>
                <input
                  type="password"
                  className="input-field"
                  value={form.admin_codigo}
                  onChange={e => set('admin_codigo', e.target.value)}
                  placeholder="••••••"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-500 mb-1">Confirmar código *</label>
                <input
                  type="password"
                  className="input-field"
                  value={form.admin_codigo2}
                  onChange={e => set('admin_codigo2', e.target.value)}
                  placeholder="••••••"
                  inputMode="numeric"
                />
              </div>
              <button className="btn-primary w-full" onClick={siguientePaso}>
                Siguiente →
              </button>
            </>
          )}

          {/* Paso 2: Datos de la empresa */}
          {paso === 1 && (
            <>
              <h2 className="text-lg font-semibold text-white">Datos de la empresa</h2>
              <div>
                <label className="block text-sm text-dark-500 mb-1">Nombre de la empresa *</label>
                <input
                  className="input-field"
                  value={form.empresa_nombre}
                  onChange={e => set('empresa_nombre', e.target.value)}
                  placeholder="Aromas del Valle"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-500 mb-1">NIT / RUT</label>
                <input
                  className="input-field"
                  value={form.empresa_nit}
                  onChange={e => set('empresa_nit', e.target.value)}
                  placeholder="900.123.456-7"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-500 mb-1">Teléfono</label>
                <input
                  className="input-field"
                  value={form.empresa_telefono}
                  onChange={e => set('empresa_telefono', e.target.value)}
                  placeholder="3101234567"
                  inputMode="tel"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-500 mb-1">Ciudad</label>
                <input
                  className="input-field"
                  value={form.empresa_ciudad}
                  onChange={e => set('empresa_ciudad', e.target.value)}
                  placeholder="Bogotá"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-500 mb-1">Dirección</label>
                <input
                  className="input-field"
                  value={form.empresa_direccion}
                  onChange={e => set('empresa_direccion', e.target.value)}
                  placeholder="Cra 15 # 85-32"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button className="btn-secondary flex-1" onClick={() => setPaso(0)}>
                  ← Atrás
                </button>
                <button className="btn-primary flex-1" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Guardando...' : '✓ Finalizar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

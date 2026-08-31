import { useState, useEffect } from 'react'
import {
  Users, UserCheck, Key, Lock, X, Check, RefreshCw,
  ShieldCheck, Eye, EyeOff, Sparkles, ArrowRight
} from 'lucide-react'
import { usuariosApi, authApi } from '../../api/services'
import { useAuthStore } from '../../stores/authStore'
import toast from 'react-hot-toast'

export default function ModalCambioCajero({ abierto, alCerrar }) {
  const { usuario: currentUser, setAuth } = useAuthStore()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null)
  const [pin, setPin] = useState('')
  const [cambiando, setCambiando] = useState(false)
  const [mostrarPin, setMostrarPin] = useState(false)

  useEffect(() => {
    if (abierto) {
      setLoading(true)
      setPin('')
      setUsuarioSeleccionado(null)
      usuariosApi.listar()
        .then(data => {
          setUsuarios(Array.isArray(data) ? data.filter(u => u.activo) : [])
        })
        .catch(() => {
          // Si no tiene permisos de listar usuarios, dejamos al menos opción de ingresar usuario y pin
          setUsuarios([])
        })
        .finally(() => setLoading(false))
    }
  }, [abierto])

  if (!abierto) return null

  const handleSeleccionarUsuario = (u) => {
    if (u.id === currentUser?.id) {
      toast('Ya estás activo con este usuario', { icon: 'ℹ️' })
      return
    }
    setUsuarioSeleccionado(u)
    setPin('')
  }

  const handleConfirmarCambio = async (e) => {
    e?.preventDefault()
    if (!usuarioSeleccionado) {
      toast.error('Selecciona el usuario al que deseas cambiar el turno')
      return
    }
    if (!pin || pin.length < 4) {
      toast.error('Ingresa el PIN o contraseña (mínimo 4 caracteres)')
      return
    }

    setCambiando(true)
    try {
      const loginId = usuarioSeleccionado.email || usuarioSeleccionado.username
      const res = await authApi.login(loginId, pin.trim())
      setAuth(res.access_token, res)
      toast.success(`✓ Turno cambiado a ${res.nombre} (${res.rol})`, {
        duration: 3500,
        icon: '👤'
      })
      alCerrar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'PIN o contraseña incorrecta')
    } finally {
      setCambiando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-dark-700 flex items-center justify-between bg-dark-850">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <RefreshCw size={18} className="text-primary-400" />
              <span>Cambio Rápido de Cajero / Turno</span>
            </h3>
            <p className="text-dark-400 text-[11px] mt-0.5">
              Pasa el control de caja a otro vendedor sin cerrar la aplicación
            </p>
          </div>
          <button
            onClick={alCerrar}
            className="text-dark-400 hover:text-white p-1 rounded-lg hover:bg-dark-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Usuario Actual */}
          <div className="bg-dark-900/80 p-3 rounded-xl border border-dark-700/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary-600/30 border border-primary-500/40 flex items-center justify-center font-bold text-primary-300 text-xs">
                {(currentUser?.nombre || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="text-[10px] text-dark-500 font-bold uppercase tracking-wider block">
                  Cajero Actual en Turno:
                </span>
                <span className="text-xs font-bold text-white">
                  {currentUser?.nombre}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              {currentUser?.rol || 'Activo'}
            </span>
          </div>

          {/* Selección de Usuario */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-dark-300">
              Selecciona quién tomará el turno:
            </label>

            {loading ? (
              <div className="py-6 text-center text-dark-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-primary-400" />
                <span>Cargando cajeros...</span>
              </div>
            ) : usuarios.length === 0 ? (
              <div className="text-center py-4 bg-dark-900/40 rounded-xl border border-dark-700">
                <p className="text-xs text-dark-400">No hay otros cajeros registrados.</p>
                <p className="text-[11px] text-dark-500 mt-1">
                  Puedes crearlos en <b>Parametrización ➡️ Usuarios</b>.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {usuarios.map(u => {
                  const esActual = u.id === currentUser?.id
                  const esSeleccionado = usuarioSeleccionado?.id === u.id

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSeleccionarUsuario(u)}
                      disabled={esActual}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        esActual
                          ? 'bg-dark-900/30 border-dark-800 opacity-50 cursor-not-allowed'
                          : esSeleccionado
                          ? 'bg-primary-600/20 border-primary-500 text-white shadow-sm'
                          : 'bg-dark-900/60 border-dark-700 text-dark-300 hover:border-dark-600 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          esSeleccionado
                            ? 'bg-primary-500 text-white'
                            : 'bg-dark-800 text-dark-400 border border-dark-700'
                        }`}>
                          {(u.nombre || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">
                            {u.nombre}
                          </div>
                          <div className="text-[10px] text-dark-500 font-mono truncate">
                            @{u.username}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-dark-800 border border-dark-700 text-dark-300 font-medium">
                          {u.rol_nombre || 'Cajero'}
                        </span>
                        {esActual && (
                          <span className="text-[10px] text-dark-500 font-bold">
                            (En uso)
                          </span>
                        )}
                        {esSeleccionado && (
                          <Check size={16} className="text-primary-400" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Ingreso de PIN del usuario seleccionado */}
          {usuarioSeleccionado && (
            <form onSubmit={handleConfirmarCambio} className="space-y-3 pt-3 border-t border-dark-700 animate-in fade-in">
              <div>
                <label className="block text-xs font-semibold text-white mb-1 flex items-center justify-between">
                  <span>
                    PIN / Contraseña de <strong className="text-primary-400">{usuarioSeleccionado.nombre}</strong>:
                  </span>
                  <button
                    type="button"
                    onClick={() => setMostrarPin(!mostrarPin)}
                    className="text-[11px] text-dark-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {mostrarPin ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{mostrarPin ? 'Ocultar' : 'Ver'}</span>
                  </button>
                </label>

                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                  <input
                    type={mostrarPin ? 'text' : 'password'}
                    autoFocus
                    className="input-field pl-9 py-2 text-xs font-mono font-bold tracking-widest text-center"
                    placeholder="Ingresa tu PIN (ej: 1234)"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUsuarioSeleccionado(null)}
                  className="btn-secondary py-2 px-3 text-xs font-bold"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={cambiando || !pin}
                  className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary-900/30"
                >
                  {cambiando ? (
                    <span>Validando PIN...</span>
                  ) : (
                    <>
                      <UserCheck size={15} />
                      <span>Ingresar a Turno</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import {
  Users, UserPlus, ShieldCheck, ShieldAlert, Key, Lock, Mail,
  Check, X, AlertCircle, Edit2, UserCheck, UserX, ShoppingCart,
  BarChart2, FileText, Sliders, RefreshCw, Eye, EyeOff
} from 'lucide-react'
import { usuariosApi } from '../../api/services'
import { useAuthStore } from '../../stores/authStore'
import toast from 'react-hot-toast'

const ROLES_PRESET = [
  {
    id: 'VENDEDOR',
    label: 'Vendedor / Mostrador',
    desc: 'Atención al cliente, ventas rápidas en caja y consulta de productos',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    permisosDefault: {
      ver_ventas: true,
      crear_ventas: true,
      ver_inventario: true,
      editar_productos: false,
      ver_reportes: false,
      anular_facturas: false,
      parametrizacion: false,
    }
  },
  {
    id: 'CAJERO',
    label: 'Cajero / Punto de Cobro',
    desc: 'Recepción de pagos, cobro de facturas y apertura/cierre de turno',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    permisosDefault: {
      ver_ventas: true,
      crear_ventas: true,
      ver_inventario: true,
      editar_productos: false,
      ver_reportes: false,
      anular_facturas: false,
      parametrizacion: false,
    }
  },
  {
    id: 'CONTADOR',
    label: 'Contador / Auditor',
    desc: 'Acceso exclusivo a reportes financieros, libros de ventas y facturas para impuestos',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    permisosDefault: {
      ver_ventas: false,
      crear_ventas: false,
      ver_inventario: true,
      editar_productos: false,
      ver_reportes: true,
      anular_facturas: false,
      parametrizacion: false,
    }
  },
  {
    id: 'ADMINISTRADOR',
    label: 'Administrador Total',
    desc: 'Control total de la empresa, inventario, precios, reportes y configuración',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    permisosDefault: {
      administrador_total: true,
      ver_ventas: true,
      crear_ventas: true,
      ver_inventario: true,
      editar_productos: true,
      ver_reportes: true,
      anular_facturas: true,
      parametrizacion: true,
    }
  },
]

const LISTA_PERMISOS = [
  { key: 'crear_ventas', label: 'Ventas y Cobro (POS)', desc: 'Puede registrar ventas, cobrar y emitir tickets', icon: ShoppingCart },
  { key: 'ver_inventario', label: 'Consultar Catálogo e Inventario', desc: 'Puede buscar productos, ver existencias y precios', icon: FileText },
  { key: 'editar_productos', label: 'Crear / Modificar Productos y Precios', desc: 'Permite cambiar costos, precios de venta y stock', icon: Edit2 },
  { key: 'ver_reportes', label: 'Ver Reportes y Ganancias Financieras', desc: 'Acceso a balances, utilidades y cierres de caja', icon: BarChart2 },
  { key: 'anular_facturas', label: 'Anular Facturas y Devoluciones', desc: 'Permite anular ventas ya registradas o hacer notas crédito', icon: ShieldAlert },
  { key: 'parametrizacion', label: 'Parametrización y Configuración', desc: 'Modificar datos fiscales, márgenes, reglas y usuarios', icon: Sliders },
]

export default function ParametrosUsuarios() {
  const { usuario: currentUser } = useAuthStore()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState(null)
  const [mostrarPassword, setMostrarPassword] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    username: '',
    email: '',
    codigo: '',
    rol_nombre: 'VENDEDOR',
    permisos: { ...ROLES_PRESET[0].permisosDefault },
    activo: true,
  })

  const cargarUsuarios = async () => {
    setLoading(true)
    try {
      const data = await usuariosApi.listar()
      setUsuarios(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error('Error al cargar la lista de usuarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarUsuarios()
  }, [])

  const abrirCrear = () => {
    setUsuarioEditando(null)
    setForm({
      nombre: '',
      username: '',
      email: '',
      codigo: '',
      rol_nombre: 'VENDEDOR',
      permisos: { ...ROLES_PRESET[0].permisosDefault },
      activo: true,
    })
    setMostrarPassword(false)
    setModalAbierto(true)
  }

  const abrirEditar = (u) => {
    setUsuarioEditando(u)
    const rolActual = u.rol_nombre || 'VENDEDOR'
    const preset = ROLES_PRESET.find(r => r.id === rolActual) || ROLES_PRESET[0]
    
    setForm({
      nombre: u.nombre || '',
      username: u.username || '',
      email: u.email || '',
      codigo: '', // Dejar en blanco si no se desea cambiar
      rol_nombre: rolActual,
      permisos: u.permisos && Object.keys(u.permisos).length > 0 ? { ...u.permisos } : { ...preset.permisosDefault },
      activo: u.activo,
    })
    setMostrarPassword(false)
    setModalAbierto(true)
  }

  const handleCambiarRol = (rolId) => {
    const preset = ROLES_PRESET.find(r => r.id === rolId) || ROLES_PRESET[0]
    setForm(prev => ({
      ...prev,
      rol_nombre: rolId,
      permisos: { ...preset.permisosDefault }
    }))
  }

  const handleTogglePermiso = (permisoKey) => {
    setForm(prev => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [permisoKey]: !prev.permisos?.[permisoKey]
      }
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      toast.error('El nombre del usuario es obligatorio')
      return
    }
    if (!form.username.trim()) {
      toast.error('El usuario o correo de acceso es obligatorio')
      return
    }

    if (!usuarioEditando && (!form.codigo || form.codigo.length < 4)) {
      toast.error('La contraseña o PIN debe tener mínimo 4 caracteres')
      return
    }

    setGuardando(true)
    try {
      if (usuarioEditando) {
        const payload = {
          nombre: form.nombre.trim(),
          username: form.username.trim().toLowerCase(),
          email: form.email ? form.email.trim().toLowerCase() : (form.username.includes('@') ? form.username.trim().toLowerCase() : null),
          rol_nombre: form.rol_nombre,
          permisos: form.permisos,
          activo: form.activo,
        }
        if (form.codigo && form.codigo.trim().length >= 4) {
          payload.codigo = form.codigo.trim()
        }
        await usuariosApi.actualizar(usuarioEditando.id, payload)
        toast.success(`Usuario "${form.nombre}" actualizado correctamente`)
      } else {
        const payload = {
          nombre: form.nombre.trim(),
          username: form.username.trim().toLowerCase(),
          email: form.email ? form.email.trim().toLowerCase() : (form.username.includes('@') ? form.username.trim().toLowerCase() : null),
          codigo: form.codigo.trim(),
          rol_nombre: form.rol_nombre,
          permisos: form.permisos,
          activo: form.activo,
        }
        await usuariosApi.crear(payload)
        toast.success(`¡Usuario "${form.nombre}" creado exitosamente!`)
      }
      setModalAbierto(false)
      cargarUsuarios()
    } catch (err) {
      toast.error(err.message || 'Error al guardar el usuario')
    } finally {
      setGuardando(false)
    }
  }

  const handleToggleActivo = async (u) => {
    if (u.id === currentUser?.id) {
      toast.error('No puedes desactivar tu propia cuenta administradora')
      return
    }
    try {
      await usuariosApi.actualizar(u.id, { activo: !u.activo })
      toast.success(`Usuario ${!u.activo ? 'activado' : 'desactivado'}`)
      cargarUsuarios()
    } catch (err) {
      toast.error(err.message || 'Error actualizando estado')
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header de la Sección ─────────────────────────────────── */}
      <div className="bg-dark-800 border border-dark-700/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-primary-400" />
            <span>Equipo y Usuarios de Caja</span>
          </h2>
          <p className="text-dark-400 text-xs mt-0.5">
            Crea cuentas para tus vendedoras y cajeros con permisos específicos para proteger tus reportes y precios
          </p>
        </div>

        <button
          onClick={abrirCrear}
          className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-primary-900/30 whitespace-nowrap cursor-pointer"
        >
          <UserPlus size={16} />
          <span>+ Nuevo Usuario / Vendedora</span>
        </button>
      </div>

      {/* ── Lista de Usuarios ────────────────────────────────────── */}
      {loading ? (
        <div className="p-8 text-center text-dark-400 text-xs flex items-center justify-center gap-2">
          <RefreshCw size={16} className="animate-spin text-primary-400" />
          <span>Cargando usuarios del negocio...</span>
        </div>
      ) : usuarios.length === 0 ? (
        <div className="bg-dark-800/60 border border-dark-700 rounded-2xl p-8 text-center space-y-2">
          <Users size={32} className="mx-auto text-dark-500" />
          <h3 className="text-sm font-bold text-white">No tienes usuarios adicionales registrados</h3>
          <p className="text-xs text-dark-400 max-w-md mx-auto">
            Crea cuentas de acceso para tu personal para que atiendan el mostrador sin ver tus márgenes de ganancia.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {usuarios.map(u => {
            const esAdmin = u.rol_nombre === 'ADMINISTRADOR' || u.permisos?.administrador_total
            const esYo = u.id === currentUser?.id
            const rolInfo = ROLES_PRESET.find(r => r.id === u.rol_nombre) || ROLES_PRESET[0]

            return (
              <div
                key={u.id}
                className={`bg-dark-800 border rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md transition-all ${
                  u.activo ? 'border-dark-700/80 hover:border-dark-600' : 'border-dark-800 opacity-60 bg-dark-900/40'
                }`}
              >
                <div>
                  {/* Fila Superior: Nombre, Badge y Estado */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        esAdmin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {(u.nombre || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5">
                          <span>{u.nombre}</span>
                          {esYo && (
                            <span className="text-[10px] bg-dark-700 text-dark-300 px-1.5 py-0.2 rounded font-normal">
                              Tú
                            </span>
                          )}
                        </h3>
                        <p className="text-[11px] text-dark-400 font-mono truncate">
                          @{u.username}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${
                      u.activo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {/* Rol Badge */}
                  <div className="mt-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border ${rolInfo.badgeClass}`}>
                      <ShieldCheck size={13} />
                      <span>{rolInfo.label}</span>
                    </span>
                  </div>

                  {/* Píldoras de Permisos */}
                  <div className="mt-3 pt-2.5 border-t border-dark-700/60 space-y-1.5">
                    <span className="text-[10px] text-dark-500 font-bold uppercase tracking-wider block">
                      Permisos Habilitados:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {esAdmin ? (
                        <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-medium">
                          ⭐ Acceso Total Administrador
                        </span>
                      ) : (
                        LISTA_PERMISOS.map(p => {
                          const tiene = u.permisos?.[p.key]
                          if (!tiene) return null
                          const Icon = p.icon
                          return (
                            <span
                              key={p.key}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-dark-900 border border-dark-700 text-dark-300"
                            >
                              <Icon size={11} className="text-primary-400" />
                              <span>{p.label.split(' ')[0]}</span>
                            </span>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones Inferiores */}
                <div className="pt-2 border-t border-dark-700/60 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => abrirEditar(u)}
                    className="btn-secondary py-1.5 px-2.5 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={12} />
                    <span>Editar / PIN</span>
                  </button>

                  {!esYo && (
                    <button
                      type="button"
                      onClick={() => handleToggleActivo(u)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        u.activo
                          ? 'border-dark-700 text-dark-400 hover:text-red-400 hover:border-red-800/60'
                          : 'border-emerald-800/60 text-emerald-400 hover:bg-emerald-950/40'
                      }`}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Crear / Editar Usuario ─────────────────────────── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Cabecera Modal */}
            <div className="px-5 py-4 border-b border-dark-700 flex items-center justify-between bg-dark-850">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-primary-400" />
                <span>{usuarioEditando ? `Editar Usuario: ${usuarioEditando.nombre}` : 'Nuevo Usuario / Vendedora'}</span>
              </h3>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-dark-400 hover:text-white p-1 rounded-lg hover:bg-dark-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-dark-300 font-semibold mb-1">
                  Nombre Completo <span className="text-primary-400">*</span>
                </label>
                <input
                  type="text"
                  className="input-field py-2 text-xs"
                  placeholder="Ej: María Gómez"
                  value={form.nombre}
                  onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-dark-300 font-semibold mb-1">
                    Usuario / Login <span className="text-primary-400">*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field py-2 text-xs font-mono"
                    placeholder="Ej: maria"
                    value={form.username}
                    onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-dark-300 font-semibold mb-1">
                    Correo Electrónico (Opcional)
                  </label>
                  <input
                    type="email"
                    className="input-field py-2 text-xs"
                    placeholder="maria@drogueria.com"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-dark-300 font-semibold mb-1 flex items-center justify-between">
                  <span>
                    {usuarioEditando ? 'Cambiar Contraseña / PIN (Dejar en blanco para mantener actual)' : 'Contraseña / PIN de Acceso'}
                    {!usuarioEditando && <span className="text-primary-400"> *</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    className="text-[11px] text-dark-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {mostrarPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{mostrarPassword ? 'Ocultar' : 'Ver'}</span>
                  </button>
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    className="input-field pl-9 py-2 text-xs"
                    placeholder={usuarioEditando ? '•••••••• (Solo si deseas cambiarlo)' : 'Mínimo 4 caracteres o PIN (ej: 1234)'}
                    value={form.codigo}
                    onChange={e => setForm(prev => ({ ...prev, codigo: e.target.value }))}
                  />
                </div>
              </div>

              {/* Selector de Rol Principal */}
              <div>
                <label className="block text-dark-300 font-semibold mb-1.5">
                  Rol Principal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ROLES_PRESET.map(r => {
                    const sel = form.rol_nombre === r.id
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleCambiarRol(r.id)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                          sel
                            ? 'bg-primary-600/20 border-primary-500 text-white shadow-sm'
                            : 'bg-dark-900/60 border-dark-700 text-dark-400 hover:border-dark-600'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>{r.label}</span>
                          {sel && <Check size={14} className="text-primary-400" />}
                        </div>
                        <p className="text-[10px] text-dark-400 leading-tight">
                          {r.desc}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Interruptores de Permisos Granulares */}
              {form.rol_nombre !== 'ADMINISTRADOR' && (
                <div className="pt-2 border-t border-dark-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">
                      Permisos Específicos para este Usuario
                    </span>
                    <span className="text-[10px] text-dark-500">
                      Personaliza lo que puede o no ver
                    </span>
                  </div>

                  <div className="space-y-1.5 bg-dark-900/70 p-3 rounded-xl border border-dark-700/80">
                    {LISTA_PERMISOS.map(p => {
                      const activo = !!form.permisos?.[p.key]
                      const Icon = p.icon

                      return (
                        <div
                          key={p.key}
                          onClick={() => handleTogglePermiso(p.key)}
                          className={`flex items-center justify-between p-2 rounded-lg border transition-colors cursor-pointer ${
                            activo
                              ? 'bg-dark-800 border-primary-500/40 text-white'
                              : 'bg-dark-900 border-transparent text-dark-400 hover:bg-dark-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <Icon size={14} className={activo ? 'text-primary-400' : 'text-dark-500'} />
                            <div>
                              <div className={`font-semibold text-xs ${activo ? 'text-white' : 'text-dark-300'}`}>
                                {p.label}
                              </div>
                              <div className="text-[10px] text-dark-500 leading-tight">
                                {p.desc}
                              </div>
                            </div>
                          </div>

                          <div className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 ${
                            activo ? 'bg-primary-600' : 'bg-dark-700'
                          }`}>
                            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                              activo ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-dark-700 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="btn-secondary py-2 px-3.5 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary-900/30"
                >
                  {guardando ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>{usuarioEditando ? 'Guardar Cambios' : 'Crear Usuario'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

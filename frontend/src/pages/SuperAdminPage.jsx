import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Crown, Users, Building2, DollarSign, Activity, AlertTriangle,
  CheckCircle, RefreshCw, Search, Phone, Mail, Clock, Plus,
  Sparkles, Zap, Shield, ArrowUpRight, MessageSquare, Lock, Unlock,
  Sliders, FileText, ChevronRight, X, ExternalLink, ShoppingCart, LogOut
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import { superadminApi } from '../api/services'
import { formatCOP } from '../utils/pricing'
import { formatearFechaHora } from '../utils/fechas'

export default function SuperAdminPage() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [tabActiva, setTabActiva] = useState('metricas') // metricas | empresas | logs
  const [metricas, setMetricas] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [logs, setLogs] = useState([])
  
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  
  // Modales
  const [modalExtender, setModalExtender] = useState(null)
  const [diasExtender, setDiasExtender] = useState(15)
  const [guardandoExtender, setGuardandoExtender] = useState(false)
  
  const [modalPlan, setModalPlan] = useState(null)
  const [nuevoPlanCodigo, setNuevoPlanCodigo] = useState('PRO')
  const [nuevoEstadoSusc, setNuevoEstadoSusc] = useState('ACTIVA')
  const [guardandoPlan, setGuardandoPlan] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    try {
      const [m, e, l] = await Promise.all([
        superadminApi.metricas().catch(() => null),
        superadminApi.empresas().catch(() => []),
        superadminApi.logsFallos().catch(() => []),
      ])
      setMetricas(m)
      setEmpresas(e || [])
      setLogs(l || [])
    } catch {
      toast.error('Error al cargar datos del panel Super Admin')
    } finally {
      setCargando(false)
    }
  }

  const handleExtenderPrueba = async (e) => {
    e?.preventDefault()
    if (!modalExtender) return
    setGuardandoExtender(true)
    try {
      const res = await superadminApi.extenderPrueba(modalExtender.id, diasExtender)
      toast.success(res.mensaje || `Se extendieron ${diasExtender} días de prueba`)
      setModalExtender(null)
      await cargarDatos()
    } catch {
      toast.error('Error al extender prueba')
    } finally {
      setGuardandoExtender(false)
    }
  }

  const handleCambiarPlan = async (e) => {
    e?.preventDefault()
    if (!modalPlan) return
    setGuardandoPlan(true)
    try {
      const res = await superadminApi.cambiarPlan(modalPlan.id, {
        plan_codigo: nuevoPlanCodigo,
        estado: nuevoEstadoSusc,
        meses: 1,
      })
      toast.success(res.mensaje || '✓ Plan actualizado exitosamente')
      setModalPlan(null)
      await cargarDatos()
    } catch {
      toast.error('Error al cambiar plan')
    } finally {
      setGuardandoPlan(false)
    }
  }

  const handleToggleActivo = async (empresa) => {
    const accion = empresa.activo ? 'suspender' : 'activar'
    if (!window.confirm(`¿Estás seguro de ${accion} a la empresa "${empresa.nombre}"?`)) return
    try {
      const res = await superadminApi.toggleActivo(empresa.id)
      toast.success(res.mensaje || `Empresa ${empresa.nombre} actualizada`)
      await cargarDatos()
    } catch {
      toast.error('Error al modificar estado de la empresa')
    }
  }

  const empresasFiltradas = empresas.filter(e => {
    const coincideBusqueda = !busqueda || 
      e.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.nit?.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.ciudad?.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.admin_nombre?.toLowerCase().includes(busqueda.toLowerCase())
      
    const coincideEstado = !filtroEstado || e.estado_suscripcion === filtroEstado
    return coincideBusqueda && coincideEstado
  })

  return (
    <div className="p-2.5 sm:p-5 w-full max-w-7xl mx-auto space-y-4 min-w-0 overflow-x-hidden">
      {/* ── Encabezado Principal Super Admin ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-950/70 via-dark-800 to-dark-800 p-4 sm:p-5 rounded-2xl border border-amber-500/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-400 flex items-center justify-center shadow-lg flex-shrink-0">
            <Crown size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Torre de Control SaaS — Super Administrador
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600">
                PROPIETARIO
              </span>
            </div>
            <p className="text-dark-400 text-xs mt-0.5">
              Gestión central de clientes suscritos, ingresos recurrentes (MRR), CRM y monitoreo de fallos en vivo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full max-w-full touch-pan-x flex-nowrap sm:flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={() => navigate('/ventas')}
            className="btn-secondary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 hover:border-emerald-500 hover:text-emerald-300 flex-shrink-0 whitespace-nowrap"
            title="Ir al Punto de Venta"
          >
            <ShoppingCart size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">Punto de Venta (POS)</span>
            <span className="sm:hidden">POS</span>
          </button>

          <button
            type="button"
            onClick={cargarDatos}
            disabled={cargando}
            className="btn-secondary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 hover:border-amber-500 hover:text-amber-300 flex-shrink-0 whitespace-nowrap"
          >
            <RefreshCw size={14} className={cargando ? 'animate-spin text-amber-400' : ''} />
            <span className="hidden sm:inline">{cargando ? 'Actualizando...' : 'Actualizar'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="btn-secondary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 text-dark-400 hover:text-red-400 hover:border-red-600"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* ── Selector de Pestañas ───────────────────────────────── */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-dark-700 pb-1.5 overflow-x-auto no-scrollbar w-full">
        {[
          { id: 'metricas', label: '📊 Dashboard & Métricas SaaS', count: null },
          { id: 'empresas', label: '🏢 Directorio de Empresas & CRM', count: empresas.length },
          { id: 'logs',     label: '🛠️ Centro de Diagnóstico & Fallos', count: logs.length },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTabActiva(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap flex-shrink-0 ${
              tabActiva === tab.id
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40'
                : 'text-dark-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-dark-900 font-mono">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── PESTAÑA 1: DASHBOARD & MÉTRICAS GLOBALES ────────────── */}
      {tabActiva === 'metricas' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Tarjetas KPIs Super Admin */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="card p-3.5 space-y-1 border-primary-500/30 bg-dark-800/90">
              <span className="text-[11px] text-dark-400 font-semibold block">🏢 Empresas Totales</span>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {metricas?.total_empresas ?? 0}
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold block">
                +{metricas?.nuevos_registros_mes ?? 0} este mes
              </span>
            </div>

            <div className="card p-3.5 space-y-1 border-amber-500/40 bg-dark-800/90">
              <span className="text-[11px] text-amber-300 font-semibold block">🧪 En Prueba (Trial)</span>
              <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                {metricas?.suscripciones_prueba ?? 0}
              </div>
              <span className="text-[10px] text-dark-400 block">Potenciales clientes</span>
            </div>

            <div className="card p-3.5 space-y-1 border-emerald-500/40 bg-dark-800/90">
              <span className="text-[11px] text-emerald-300 font-semibold block">🟢 Suscripciones Activas</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                {metricas?.suscripciones_activas ?? 0}
              </div>
              <span className="text-[10px] text-emerald-300 font-semibold block">Clientes pagos</span>
            </div>

            <div className="card p-3.5 space-y-1 border-purple-500/40 bg-dark-800/90">
              <span className="text-[11px] text-purple-300 font-semibold block">💰 MRR Estimado (Mes)</span>
              <div className="text-lg sm:text-xl font-black text-purple-400 font-mono truncate">
                {formatCOP(metricas?.mrr_estimado ?? 0)}
              </div>
              <span className="text-[10px] text-dark-400 block">Ingreso recurrente</span>
            </div>

            <div className="card p-3.5 space-y-1 border-blue-500/40 bg-dark-800/90">
              <span className="text-[11px] text-blue-300 font-semibold block">📈 Ventas Globales</span>
              <div className="text-lg sm:text-xl font-black text-blue-400 font-mono truncate">
                {formatCOP(metricas?.total_ventas_dinero ?? 0)}
              </div>
              <span className="text-[10px] text-dark-400 block">{metricas?.total_facturas ?? 0} facturas</span>
            </div>

            <div className="card p-3.5 space-y-1 border-cyan-500/40 bg-dark-800/90">
              <span className="text-[11px] text-cyan-300 font-semibold block">⚡ Facturas DIAN</span>
              <div className="text-xl sm:text-2xl font-black text-cyan-400 font-mono">
                {metricas?.total_facturas_dian ?? 0}
              </div>
              <span className="text-[10px] text-cyan-300 block">Timbradas con éxito</span>
            </div>
          </div>

          {/* Desglose por Rubros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card space-y-3">
              <h3 className="text-white font-bold text-xs sm:text-sm flex items-center gap-2">
                <span>🏬</span> Distribución de Empresas por Rubro
              </h3>
              <div className="space-y-2 text-xs">
                {metricas?.distribucion_rubros && Object.entries(metricas.distribucion_rubros).map(([rubro, cant]) => {
                  const iconos = { FARMACIA: '💊 Droguerías', FERRETERIA: '🔨 Ferreterías', SUPERMERCADO: '🛒 Supermercados', GENERAL: '🏬 Comercio General' }
                  const total = metricas.total_empresas || 1
                  const pct = ((cant / total) * 100).toFixed(1)
                  return (
                    <div key={rubro} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-dark-300">{iconos[rubro] || rubro}</span>
                        <span className="text-white font-mono">{cant} empresas ({pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-dark-900 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card space-y-3">
              <h3 className="text-white font-bold text-xs sm:text-sm flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                Consejos de Crecimiento & Monetización SaaS
              </h3>
              <div className="space-y-2 text-xs text-dark-300 leading-relaxed">
                <div className="p-2.5 rounded-xl bg-dark-900/60 border border-dark-700 space-y-1">
                  <strong className="text-white font-semibold block">📞 Contacta a los clientes en prueba:</strong>
                  <p className="text-[11px] text-dark-400">
                    Tienes {metricas?.suscripciones_prueba ?? 0} empresas probando el sistema. Escríbeles por WhatsApp antes de que venzan sus 15 días para ofrecerles tu plan anual o soporte personalizado.
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-dark-900/60 border border-dark-700 space-y-1">
                  <strong className="text-white font-semibold block">⚡ Facturación Electrónica como Gancho:</strong>
                  <p className="text-[11px] text-dark-400">
                    Muchos comercios necesitan cumplir con la DIAN de inmediato. El conector Factus integrado en tu sistema es tu mayor ventaja competitiva.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PESTAÑA 2: DIRECTORIO DE EMPRESAS & CRM ─────────────── */}
      {tabActiva === 'empresas' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Barra de Filtros y Búsqueda */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-dark-800 p-3 rounded-xl border border-dark-700">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, NIT, email, ciudad o dueño..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="input-field pl-9 py-1.5 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}
                className="input-field py-1.5 text-xs bg-dark-900"
              >
                <option value="">Todos los Estados</option>
                <option value="PRUEBA_GRATIS">🧪 En Prueba Gratis</option>
                <option value="ACTIVA">🟢 Suscripción Activa</option>
                <option value="PRUEBA_VENCIDA">⚠️ Prueba Vencida</option>
                <option value="VENCIDA">❌ Vencida</option>
              </select>
            </div>
          </div>

          {/* Tabla de Empresas */}
          <div className="overflow-x-auto border border-dark-700 rounded-2xl bg-dark-800 w-full max-w-full touch-scroll-x table-responsive-container">
            <table className="w-full text-left text-xs min-w-[780px]">
              <thead className="bg-dark-900/90 text-dark-400 text-[10px] uppercase font-bold border-b border-dark-700">
                <tr>
                  <th className="px-4 py-3">Empresa / Negocio</th>
                  <th className="px-4 py-3">Contacto / Dueño</th>
                  <th className="px-4 py-3">Plan / Suscripción</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones de Super Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/60">
                {empresasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-dark-500">
                      No se encontraron empresas con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  empresasFiltradas.map(emp => {
                    const esPrueba = emp.estado_suscripcion === 'PRUEBA_GRATIS'
                    const esActiva = emp.estado_suscripcion === 'ACTIVA'
                    const telLimpio = emp.telefono ? emp.telefono.replace(/\D/g, '') : ''

                    return (
                      <tr key={emp.id} className="hover:bg-dark-700/40 transition-colors">
                        {/* Nombre & NIT */}
                        <td className="px-4 py-3">
                          <div>
                            <strong className="text-white font-bold block text-xs">
                              {emp.nombre}
                            </strong>
                            <div className="flex items-center gap-2 text-[11px] text-dark-400 mt-0.5">
                              <span className="font-mono">{emp.nit}</span>
                              {emp.ciudad && <span>• {emp.ciudad}</span>}
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-dark-900 border border-dark-700">
                                {emp.rubro}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Contacto & WhatsApp */}
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <span className="text-dark-200 font-semibold block">{emp.admin_nombre}</span>
                            <div className="flex items-center gap-2 text-[11px] text-dark-400">
                              {emp.telefono ? (
                                <a
                                  href={`https://wa.me/57${telLimpio}?text=${encodeURIComponent(`Hola ${emp.admin_nombre}, te saludo de FACTUR-AAP. ¿Cómo ha sido tu experiencia con el sistema?`)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-400 hover:text-emerald-300 font-mono font-bold flex items-center gap-1"
                                  title="Enviar WhatsApp directo"
                                >
                                  <MessageSquare size={12} />
                                  <span>{emp.telefono}</span>
                                </a>
                              ) : (
                                <span>Sin teléfono</span>
                              )}
                            </div>
                            {emp.email && <span className="text-[10px] text-dark-500 block truncate max-w-[160px]">{emp.email}</span>}
                          </div>
                        </td>

                        {/* Plan & Vigencia */}
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-primary-300 font-bold block">{emp.plan_nombre}</span>
                            <span className="text-[11px] text-dark-400 block font-mono">
                              {emp.dias_restantes > 0 ? `Quedan ${emp.dias_restantes} días` : 'Vencido'}
                            </span>
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            esActiva
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : esPrueba
                              ? 'bg-amber-950 text-amber-300 border-amber-700'
                              : 'bg-red-950 text-red-300 border-red-700'
                          }`}>
                            {emp.estado_suscripcion}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setModalExtender(emp)
                                setDiasExtender(15)
                              }}
                              className="btn-secondary py-1 px-2.5 text-[11px] font-bold text-amber-300 hover:border-amber-500"
                              title="Extender días de prueba gratis"
                            >
                              🎁 +Días
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setModalPlan(emp)
                                setNuevoPlanCodigo(emp.plan_codigo || 'PRO')
                                setNuevoEstadoSusc('ACTIVA')
                              }}
                              className="btn-secondary py-1 px-2.5 text-[11px] font-bold text-primary-300 hover:border-primary-500"
                              title="Cambiar plan o activar suscripción"
                            >
                              ⚡ Plan
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleActivo(emp)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                emp.activo
                                  ? 'text-dark-400 hover:text-red-400 border-dark-700 hover:border-red-600'
                                  : 'text-red-400 bg-red-950/40 border-red-700'
                              }`}
                              title={emp.activo ? 'Suspender acceso a la empresa' : 'Reactivar empresa'}
                            >
                              {emp.activo ? <Lock size={13} /> : <Unlock size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PESTAÑA 3: CENTRO DE DIAGNÓSTICO & LOGS DE FALLOS ───── */}
      {tabActiva === 'logs' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-xs sm:text-sm flex items-center gap-2">
                  <Activity size={16} className="text-amber-400" />
                  Monitoreo de Eventos, Fallos DIAN y Anulaciones
                </h3>
                <p className="text-dark-400 text-xs mt-0.5">
                  Si un cliente reporta que no le emite una factura o tiene problemas con la DIAN, aquí verás el detalle técnico exacto.
                </p>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="p-6 text-center text-dark-500 text-xs">
                ✓ No hay errores ni fallos registrados recientemente. El sistema está operando con total normalidad.
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-dark-900/80 border border-dark-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          log.tipo === 'DIAN_RECHAZADA'
                            ? 'bg-red-950 text-red-300 border-red-700'
                            : 'bg-amber-950 text-amber-300 border-amber-700'
                        }`}>
                          {log.tipo}
                        </span>
                        <strong className="text-white font-mono">Factura {log.factura_numero}</strong>
                        <span className="text-dark-400 text-[11px]">
                          {formatearFechaHora(log.fecha)}
                        </span>
                      </div>
                      <p className="text-dark-300 text-[11px] font-mono break-all leading-snug bg-dark-950 p-2 rounded border border-dark-800">
                        {log.detalle_error}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="font-mono text-primary-400 font-bold block">{formatCOP(log.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: EXTENDER DÍAS DE PRUEBA ───────────────────────── */}
      {modalExtender && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md p-5 border border-dark-600 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-700 pb-2.5">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <span>🎁</span> Extender Periodo de Prueba
              </h3>
              <button type="button" onClick={() => setModalExtender(null)} className="text-dark-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-dark-300">
              Vas a regalar días adicionales de prueba a <strong>{modalExtender.nombre}</strong>.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[15, 30, 60].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiasExtender(d)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    diasExtender === d
                      ? 'bg-amber-950 border-amber-500 text-amber-300 shadow'
                      : 'bg-dark-900 border-dark-700 text-dark-400'
                  }`}
                >
                  +{d} Días
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalExtender(null)}
                className="btn-secondary flex-1 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoExtender}
                onClick={handleExtenderPrueba}
                className="btn-primary flex-1 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 border-amber-500 shadow-lg"
              >
                {guardandoExtender ? 'Guardando...' : `Confirmar +${diasExtender} Días`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CAMBIAR PLAN / ACTIVAR SUSCRIPCIÓN ────────────── */}
      {modalPlan && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md p-5 border border-dark-600 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-700 pb-2.5">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <span>⚡</span> Asignar Plan o Activar Cuenta
              </h3>
              <button type="button" onClick={() => setModalPlan(null)} className="text-dark-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-dark-300">
              Modificar suscripción de <strong>{modalPlan.nombre}</strong>.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-dark-400 font-semibold mb-1">Seleccionar Plan:</label>
                <select
                  value={nuevoPlanCodigo}
                  onChange={e => setNuevoPlanCodigo(e.target.value)}
                  className="input-field py-2 text-xs bg-dark-900 font-bold"
                >
                  <option value="BASICO">Plan Básico</option>
                  <option value="PRO">Plan Pro (Recomendado)</option>
                  <option value="ENTERPRISE">Plan Enterprise / Ilimitado</option>
                </select>
              </div>

              <div>
                <label className="block text-dark-400 font-semibold mb-1">Estado de la Suscripción:</label>
                <select
                  value={nuevoEstadoSusc}
                  onChange={e => setNuevoEstadoSusc(e.target.value)}
                  className="input-field py-2 text-xs bg-dark-900 font-bold"
                >
                  <option value="ACTIVA">🟢 ACTIVA (30 Días Pagos)</option>
                  <option value="PRUEBA_GRATIS">🧪 PRUEBA GRATIS</option>
                  <option value="VENCIDA">❌ VENCIDA / SUSPENDIDA</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalPlan(null)}
                className="btn-secondary flex-1 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoPlan}
                onClick={handleCambiarPlan}
                className="btn-primary flex-1 py-2 text-xs font-bold"
              >
                {guardandoPlan ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
import { useState, useEffect } from 'react'
import { configApi, productosApi, resolucionesApi } from '../../api/services'
import {
  Settings, Save, Building2, Percent, DollarSign, FileText, Truck,
  RefreshCw, Sparkles, Globe, Zap, ShieldCheck, QrCode, Key, Server,
  CheckCircle2, Plus, Calendar, Clock, AlertTriangle, Trash2, Edit3, Award, ChevronDown, ChevronUp
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PAISES_ZONAS_HORARIAS, ZONAS_HORARIAS_POPULARES, obtenerZonaPorPais, obtenerHoraActualEnZona, obtenerFechaHoyLocal } from '../../utils/fechas'

const RUBROS = [
  { id: 'FARMACIA',      nombre: 'Droguería / Farmacia',    desc: 'Habilita fraccionamiento (Cajas/Blisters) y búsqueda por principio activo.', icon: '💊' },
  { id: 'FERRETERIA',   nombre: 'Ferretería / Materiales', desc: 'Búsqueda por nombre comercial, referencias, marcas y bodega.', icon: '🔨' },
  { id: 'SUPERMERCADO', nombre: 'Supermercado / Víveres',  desc: 'Optimizado para códigos de barra, pesajes y venta rápida.', icon: '🛒' },
  { id: 'GENERAL',      nombre: 'Comercio General',        desc: 'Para tiendas de ropa, calzado, tecnología y servicios.', icon: '🏬' },
]

export default function ParametrosEmpresa() {
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [aplicandoRedondeo, setAplicandoRedondeo] = useState(false)
  const [probandoFactus, setProbandoFactus] = useState(false)
  const [rangosFactus, setRangosFactus] = useState([])
  const [cargandoRangos, setCargandoRangos] = useState(false)

  // Resoluciones DIAN
  const [resoluciones, setResoluciones] = useState([])
  const [cargandoResoluciones, setCargandoResoluciones] = useState(false)
  const [modalResolucion, setModalResolucion] = useState(null)
  const [guardandoResolucion, setGuardandoResolucion] = useState(false)
  const [mostrarHistorialResoluciones, setMostrarHistorialResoluciones] = useState(false)

  useEffect(() => {
    configApi.get().then(data => {
      setConfig(data)
      setForm(data)
    }).catch(() => {})
    cargarResoluciones()
  }, [])

  const cargarResoluciones = async () => {
    setCargandoResoluciones(true)
    try {
      const data = await resolucionesApi.listar()
      setResoluciones(data || [])
    } catch {
      // Silencioso si falla
    } finally {
      setCargandoResoluciones(false)
    }
  }

  const resolucionActiva = resoluciones.find(r => r.activa)

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  const handleProbarFactus = async () => {
    if (!form.fe_client_id || !form.fe_client_secret) {
      toast.error('Por favor ingresa Client ID y Client Secret de Factus')
      return
    }
    setProbandoFactus(true)
    try {
      const res = await configApi.probarFactus({
        client_id: form.fe_client_id,
        client_secret: form.fe_client_secret,
        ambiente: form.fe_ambiente || 'SANDBOX',
      })
      if (res.exito) {
        toast.success(res.mensaje || '✓ Conexión exitosa con Factus')
        if (res.rangos?.length) {
          setRangosFactus(res.rangos)
        }
      } else {
        toast.error(res.mensaje || 'Error al conectar con Factus')
      }
    } catch (err) {
      toast.error('Error de red al conectar con Factus')
    } finally {
      setProbandoFactus(false)
    }
  }

  const handleCargarRangosFactus = async () => {
    if (!form.fe_client_id || !form.fe_client_secret) {
      toast.error('Ingresa primero tus credenciales de Factus')
      return
    }
    setCargandoRangos(true)
    try {
      const res = await configApi.rangosFactus({
        client_id: form.fe_client_id,
        client_secret: form.fe_client_secret,
        ambiente: form.fe_ambiente || 'SANDBOX',
      })
      if (res.exito && res.rangos?.length) {
        setRangosFactus(res.rangos)
        toast.success(`✓ Se encontraron ${res.rangos.length} rangos de numeración activos en Factus`)
      } else {
        toast.error(res.mensaje || 'No se encontraron rangos de numeración')
      }
    } catch (err) {
      toast.error('Error al cargar rangos de Factus')
    } finally {
      setCargandoRangos(false)
    }
  }

  const handleAbrirModalNuevaResolucion = (resolucionAEditar = null) => {
    if (resolucionAEditar) {
      setModalResolucion({
        id: resolucionAEditar.id,
        tipo_documento: resolucionAEditar.tipo_documento || 'POS',
        numero_resolucion: resolucionAEditar.numero_resolucion || '',
        prefijo: resolucionAEditar.prefijo || 'POS',
        rango_desde: resolucionAEditar.rango_desde || 1,
        rango_hasta: resolucionAEditar.rango_hasta || 10000,
        consecutivo_actual: resolucionAEditar.consecutivo_actual || 0,
        fecha_expedicion: resolucionAEditar.fecha_expedicion || obtenerFechaHoyLocal(form.zona_horaria),
        fecha_vencimiento: resolucionAEditar.fecha_vencimiento || '',
        vigencia_meses: resolucionAEditar.vigencia_meses || 24,
        clave_tecnica: resolucionAEditar.clave_tecnica || '',
        activa: resolucionAEditar.activa ?? true,
      })
    } else {
      const hoy = obtenerFechaHoyLocal(form.zona_horaria)
      const d = new Date()
      d.setFullYear(d.getFullYear() + 2)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const fechaVencAuto = `${y}-${m}-${day}`

      setModalResolucion({
        id: null,
        tipo_documento: 'POS',
        numero_resolucion: '',
        prefijo: 'POS',
        rango_desde: 1,
        rango_hasta: 10000,
        consecutivo_actual: 0,
        fecha_expedicion: hoy,
        fecha_vencimiento: fechaVencAuto,
        vigencia_meses: 24,
        clave_tecnica: '',
        activa: true,
      })
    }
  }

  const handleGuardarResolucionModal = async (e) => {
    e?.preventDefault()
    if (!modalResolucion.numero_resolucion?.trim()) {
      toast.error('El Número de Resolución DIAN es obligatorio')
      return
    }
    if (!modalResolucion.fecha_expedicion || !modalResolucion.fecha_vencimiento) {
      toast.error('Las fechas de expedición y vencimiento son obligatorias')
      return
    }
    if (parseInt(modalResolucion.rango_hasta) <= parseInt(modalResolucion.rango_desde)) {
      toast.error('El rango hasta debe ser mayor al rango desde')
      return
    }

    setGuardandoResolucion(true)
    try {
      if (modalResolucion.id) {
        await resolucionesApi.actualizar(modalResolucion.id, modalResolucion)
        toast.success('✓ Resolución DIAN actualizada exitosamente')
      } else {
        await resolucionesApi.crear(modalResolucion)
        toast.success('✓ Nueva Resolución DIAN registrada y activada')
      }
      setModalResolucion(null)
      await cargarResoluciones()
      const cfgActualizada = await configApi.get()
      if (cfgActualizada) {
        setConfig(cfgActualizada)
        setForm(cfgActualizada)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al guardar resolución DIAN')
    } finally {
      setGuardandoResolucion(false)
    }
  }

  const handleActivarResolucion = async (id) => {
    try {
      await resolucionesApi.activar(id)
      toast.success('✓ Resolución activada como vigente')
      await cargarResoluciones()
      const cfg = await configApi.get()
      if (cfg) { setConfig(cfg); setForm(cfg) }
    } catch {
      toast.error('Error al activar resolución')
    }
  }

  const handleEliminarResolucion = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta resolución?')) return
    try {
      await resolucionesApi.eliminar(id)
      toast.success('Resolución eliminada')
      await cargarResoluciones()
    } catch {
      toast.error('Error al eliminar resolución')
    }
  }

  const guardar = async (e) => {
    e?.preventDefault()
    setGuardando(true)
    try {
      await configApi.update(form)
      // Si cambió el modo de redondeo, aplicarlo globalmente al catálogo
      if (form.modo_redondeo && form.modo_redondeo !== config.modo_redondeo) {
        await productosApi.aplicarRedondeoGlobal()
        toast.success(`Parámetros guardados y regla de redondeo aplicada a todo el catálogo`)
      } else {
        toast.success('Parámetros de empresa guardados exitosamente')
      }
      setConfig({ ...form })
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al guardar parámetros')
    } finally {
      setGuardando(false)
    }
  }

  const handleAplicarRedondeoGlobal = async () => {
    setAplicandoRedondeo(true)
    try {
      await configApi.update(form)
      const res = await productosApi.aplicarRedondeoGlobal()
      setConfig({ ...form })
      toast.success(res.mensaje || 'Redondeo aplicado con éxito a todo el catálogo')
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al aplicar redondeo')
    } finally {
      setAplicandoRedondeo(false)
    }
  }

  if (!config) {
    return (
      <div className="text-center py-12 space-y-2">
        <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-dark-500 text-xs">Cargando parámetros de configuración...</p>
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="space-y-3.5 sm:space-y-5 w-full max-w-full min-w-0">
      {/* ── Encabezado ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-dark-700 w-full min-w-0">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Settings size={18} className="text-primary-500 flex-shrink-0" />
            <span>Parámetros Generales y Empresa</span>
          </h2>
          <p className="text-dark-400 text-[11px] sm:text-xs mt-0.5">
            Configuración fiscal, país, zona horaria, márgenes y reglas
          </p>
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="btn-primary flex items-center justify-center gap-1.5 py-2 px-4 font-bold text-xs shadow-lg w-full sm:w-auto self-start sm:self-auto"
        >
          {guardando ? <RefreshCw size={14} className="animate-spin" /> : <Save size={15} />}
          <span>{guardando ? 'Guardando...' : 'Guardar Cambios'}</span>
        </button>
      </div>

      {/* ── Selector de País de Origen y Zona Horaria ────────────── */}
      <div className="card space-y-3 sm:space-y-4">
        <div>
          <h3 className="text-white font-semibold text-xs sm:text-sm flex items-center gap-2">
            <Globe size={15} className="text-primary-400 flex-shrink-0" />
            <span>🌍 País de Origen y Zona Horaria Oficial</span>
          </h3>
          <p className="text-dark-400 text-[11px] sm:text-xs mt-0.5">
            Ajusta automáticamente la fecha y hora de emisión en facturas, tickets, reportes y ventas según tu país.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="w-full min-w-0">
            <label className="block text-[11px] sm:text-xs text-dark-400 mb-1 font-semibold">
              País del Negocio (Configura automáticamente la hora recomendada)
            </label>
            <select
              className="input-field py-1.5 sm:py-2 text-xs font-semibold bg-dark-800 w-full max-w-full min-w-0 truncate"
              value={form.pais || 'Colombia'}
              onChange={e => {
                const nuevoPais = e.target.value
                const zonaAuto = obtenerZonaPorPais(nuevoPais)
                const paisObj = PAISES_ZONAS_HORARIAS.find(p => p.nombre === nuevoPais)
                setForm(f => ({
                  ...f,
                  pais: nuevoPais,
                  zona_horaria: zonaAuto,
                  moneda_simbolo: paisObj?.simbolo || f.moneda_simbolo || '$',
                }))
              }}
            >
              {PAISES_ZONAS_HORARIAS.map(p => (
                <option key={p.id} value={p.nombre}>
                  {p.flag} {p.nombre} ({p.utc})
                </option>
              ))}
            </select>
          </div>

          <div className="w-full min-w-0">
            <label className="block text-[11px] sm:text-xs text-dark-400 mb-1 font-semibold">
              Zona Horaria IANA (Cálculo de fechas exactas)
            </label>
            <select
              className="input-field py-1.5 sm:py-2 text-xs font-mono bg-dark-800 w-full max-w-full min-w-0 truncate"
              value={form.zona_horaria || 'America/Bogota'}
              onChange={e => set('zona_horaria', e.target.value)}
            >
              {ZONAS_HORARIAS_POPULARES.map(z => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-dark-900/70 p-2.5 sm:p-3 rounded-xl border border-primary-600/30 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs w-full min-w-0">
          <div className="min-w-0">
            <span className="text-white font-semibold flex items-center gap-1 text-[11px] sm:text-xs">
              <span>🕒</span> Vista Previa en Tiempo Real de la Fecha y Hora:
            </span>
            <p className="text-dark-400 text-[10px] sm:text-[11px] mt-0.5 leading-tight">
              Esta es la hora exacta que se imprimirá en facturas, tickets POS y reportes contables.
            </p>
          </div>
          <span className="font-mono text-emerald-400 font-bold bg-dark-950 px-2.5 py-1 rounded-lg border border-emerald-800/40 whitespace-nowrap text-xs self-start sm:self-auto flex-shrink-0">
            {obtenerHoraActualEnZona(form.zona_horaria)}
          </span>
        </div>
      </div>

      {/* ── Facturación Electrónica DIAN & POS Electrónico (Factus API) ─ */}
      <div className={`card space-y-4 border transition-all ${
        form.fe_habilitada ? 'border-primary-500/60 bg-gradient-to-br from-dark-800 via-dark-800 to-primary-950/20' : 'border-dark-700'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-dark-700 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={18} className={form.fe_habilitada ? 'text-primary-400 animate-pulse' : 'text-dark-400'} />
              <h3 className="text-white font-bold text-sm">
                Facturación Electrónica DIAN & POS Electrónico (Factus API)
              </h3>
            </div>
            <p className="text-dark-400 text-xs mt-0.5">
              Conecta FACTUR-AAP con el proveedor tecnológico <strong>Factus</strong> para emitir Facturas y POS Electrónico (Res. 165 DIAN) en tiempo real con CUFE y QR.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={!!form.fe_habilitada}
              onChange={e => set('fe_habilitada', e.target.checked)}
            />
            <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            <span className="ml-2 text-xs font-bold text-white">
              {form.fe_habilitada ? 'HABILITADA' : 'INACTIVA'}
            </span>
          </label>
        </div>

        {form.fe_habilitada && (
          <div className="space-y-4 pt-1 animate-in fade-in duration-200">
            {/* Selector de Entorno: Sandbox vs Producción */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-300 mb-1 font-semibold">
                  🧪 Entorno de Operación Factus / DIAN:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => set('fe_ambiente', 'SANDBOX')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      (form.fe_ambiente || 'SANDBOX') === 'SANDBOX'
                        ? 'bg-amber-950/70 border-amber-500 text-amber-300 shadow-md ring-1 ring-amber-500/50'
                        : 'bg-dark-900 border-dark-700 text-dark-400 hover:text-white'
                    }`}
                  >
                    🧪 Sandbox (Pruebas Gratis)
                  </button>
                  <button
                    type="button"
                    onClick={() => set('fe_ambiente', 'PRODUCCION')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      form.fe_ambiente === 'PRODUCCION'
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500/50'
                        : 'bg-dark-900 border-dark-700 text-dark-400 hover:text-white'
                    }`}
                  >
                    🚀 Producción (DIAN Real)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-dark-300 mb-1 font-semibold">
                  📑 Tipo de Documento Electrónico Predeterminado:
                </label>
                <select
                  className="input-field py-2 text-xs font-semibold bg-dark-800"
                  value={form.fe_tipo_documento || 'POS_ELECTRONICO'}
                  onChange={e => set('fe_tipo_documento', e.target.value)}
                >
                  <option value="POS_ELECTRONICO">🧾 Documento Equivalente Electrónico POS (Res. 165)</option>
                  <option value="FACTURA_ELECTRONICA">📄 Factura Electrónica de Venta Tradicional (UBL 2.1)</option>
                </select>
              </div>
            </div>

            {/* Credenciales Factus API */}
            <div className="bg-dark-900/80 p-4 rounded-xl border border-dark-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Key size={14} /> Credenciales de API Factus
                </span>
                <a
                  href={form.fe_ambiente === 'PRODUCCION' ? 'https://app.factus.com.co' : 'https://app-sandbox.factus.com.co'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-primary-400 hover:text-primary-300 underline flex items-center gap-1"
                >
                  <span>Abrir consola Factus {form.fe_ambiente === 'PRODUCCION' ? 'Producción' : 'Sandbox'} ↗</span>
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-dark-400 mb-1 font-semibold">
                    Client ID (Identificador de Cliente) *
                  </label>
                  <input
                    type="text"
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="Ej: 98a7b6c5-4d3e-2f1a-..."
                    value={form.fe_client_id || ''}
                    onChange={e => set('fe_client_id', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-dark-400 mb-1 font-semibold">
                    Client Secret (Clave Secreta) *
                  </label>
                  <input
                    type="password"
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="••••••••••••••••••••••••"
                    value={form.fe_client_secret || ''}
                    onChange={e => set('fe_client_secret', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] text-dark-400 font-semibold">
                      Rango de Numeración / Resolución ID Factus:
                    </label>
                    <button
                      type="button"
                      onClick={handleCargarRangosFactus}
                      disabled={cargandoRangos}
                      className="text-[10px] text-primary-400 hover:text-primary-300 underline flex items-center gap-1"
                    >
                      {cargandoRangos ? <RefreshCw size={10} className="animate-spin" /> : '🔄 Consultar Rangos'}
                    </button>
                  </div>

                  {rangosFactus.length > 0 ? (
                    <select
                      className="input-field py-1.5 text-xs font-semibold bg-dark-800 font-mono"
                      value={form.fe_rango_id || ''}
                      onChange={e => set('fe_rango_id', e.target.value)}
                    >
                      <option value="">-- Selecciona el Rango de Numeración --</option>
                      {rangosFactus.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.document} - Prefijo: {r.prefix || 'S/P'} ({r.from} al {r.to}) - ID: {r.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="input-field py-1.5 text-xs font-mono"
                      placeholder="Ej: 8 (o pulsa Consultar Rangos)"
                      value={form.fe_rango_id || ''}
                      onChange={e => set('fe_rango_id', e.target.value)}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-dark-400 mb-1 font-semibold">
                    Código DANE Municipio Emisor:
                  </label>
                  <input
                    type="text"
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="980 (Bogotá D.C.) | 1 (Medellín) | 107 (Cali)"
                    value={form.fe_municipio_id || '980'}
                    onChange={e => set('fe_municipio_id', e.target.value)}
                  />
                </div>
              </div>

              {/* Botón Probar Conexión */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-dark-700/80">
                <p className="text-[11px] text-dark-400">
                  Pulsa el botón para validar que tus credenciales de Factus sean correctas antes de guardar.
                </p>

                <button
                  type="button"
                  disabled={probandoFactus}
                  onClick={handleProbarFactus}
                  className="btn-secondary py-2 px-4 text-xs font-bold flex items-center gap-1.5 hover:text-primary-300 hover:border-primary-500 shadow-sm whitespace-nowrap w-full sm:w-auto justify-center"
                >
                  {probandoFactus ? <RefreshCw size={14} className="animate-spin text-primary-400" /> : <Zap size={14} className="text-amber-400" />}
                  <span>{probandoFactus ? 'Verificando con Factus...' : '⚡ Probar Conexión Factus'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Selector de Rubro / Tipo de Negocio ─────────────────── */}
      <div className="card space-y-3">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <span>🏢</span> Rubro o Tipo de Negocio
          </h3>
          <p className="text-dark-400 text-xs">
            Optimiza el comportamiento del punto de venta, inventario y búsqueda
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RUBROS.map(r => {
            const activo = (form.rubro || 'FARMACIA') === r.id
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => set('rubro', r.id)}
                className={`p-3 rounded-xl text-left border transition-all ${
                  activo
                    ? 'bg-primary-950/40 border-primary-500 ring-1 ring-primary-500/30'
                    : 'bg-dark-700/50 border-dark-700 hover:border-dark-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{r.icon}</span>
                  <span className={`text-xs font-bold ${activo ? 'text-primary-400' : 'text-white'}`}>
                    {r.nombre}
                  </span>
                </div>
                <p className="text-dark-400 text-[11px] leading-relaxed">{r.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Datos Fiscales de la Empresa ────────────────────────── */}
      <div className="card space-y-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Building2 size={16} className="text-primary-400" />
          Información Fiscal y de Facturación
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Nombre Comercial de la Empresa</label>
            <input
              className="input-field py-1.5 text-xs font-semibold"
              value={form.nombre || ''}
              onChange={e => set('nombre', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">NIT / Documento Legal</label>
            <input
              className="input-field py-1.5 text-xs font-mono"
              value={form.nit || ''}
              onChange={e => set('nit', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Teléfono / Celular de Contacto</label>
            <input
              className="input-field py-1.5 text-xs font-mono"
              value={form.telefono || ''}
              onChange={e => set('telefono', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Correo Electrónico</label>
            <input
              type="email"
              className="input-field py-1.5 text-xs"
              value={form.email || ''}
              onChange={e => set('email', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Ciudad / Municipio</label>
            <input
              className="input-field py-1.5 text-xs"
              value={form.ciudad || ''}
              onChange={e => set('ciudad', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Dirección del Establecimiento</label>
            <input
              className="input-field py-1.5 text-xs"
              value={form.direccion || ''}
              onChange={e => set('direccion', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Precios y Márgenes de Ganancia ──────────────────────── */}
      <div className="card space-y-4">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Percent size={16} className="text-primary-400" />
          Precios, Márgenes y Reglas de Redondeo
        </h3>

        <div className="bg-dark-900/60 p-3.5 rounded-xl border border-dark-700 space-y-2">
          <label className="block text-xs font-semibold text-dark-300">
            Margen de ganancia sugerido por defecto (%)
          </label>
          <div className="relative max-w-xs">
            <input
              type="number"
              step="any"
              min="0"
              className="input-field py-1.5 pl-3 pr-8 text-xs font-mono font-bold text-primary-300"
              value={form.margen_ganancia_predeterminado ?? 30.0}
              onChange={e => set('margen_ganancia_predeterminado', parseFloat(e.target.value) || 0)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 font-bold text-xs">%</span>
          </div>
          <p className="text-dark-500 text-[11px]">
            Este porcentaje se aplicará automáticamente para proyectar el precio de venta cuando importes facturas de compras o crees nuevos artículos.
          </p>
        </div>

        {/* Selector de Modo de Redondeo */}
        <div className="space-y-2 pt-1">
          <div>
            <label className="block text-xs font-semibold text-dark-300">
              Regla de Redondeo y Aproximación de Precios de Venta
            </label>
            <p className="text-dark-500 text-[11px]">
              Evita precios con decimales o centavos difíciles de cobrar en caja (ej. $24.022,70) redondeando a valores limpios.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                id: 'CENTENA_100',
                nombre: 'Redondeo a la Centena más cercana ($100)',
                desc: 'Si da $24.022 → $24.000 | Si da $24.089 → $24.100 (Recomendado para droguerías)',
                ejemplo: '$24.022 → $24.000',
              },
              {
                id: 'CINCUENTA_50',
                nombre: 'Redondeo a la Decena / Moneda de $50',
                desc: 'Si da $24.022 → $24.000 | Si da $24.035 → $24.050',
                ejemplo: '$24.035 → $24.050',
              },
              {
                id: 'ENTERO',
                nombre: 'Al Peso Entero más cercano (Sin decimales)',
                desc: 'Si da $24.022,70 → $24.023 (Al peso exacto sin centavos)',
                ejemplo: '$24.022,7 → $24.023',
              },
              {
                id: 'MIL_1000',
                nombre: 'Redondeo al Millar más cercano ($1.000)',
                desc: 'Si da $24.400 → $24.000 | Si da $24.600 → $25.000',
                ejemplo: '$24.400 → $24.000',
              },
              {
                id: 'DECIMALES_2',
                nombre: 'Exacto con 2 Decimales',
                desc: 'Mantiene centavos exactos (ej. $24.022,70)',
                ejemplo: '$24.022,70',
              },
            ].map(m => {
              const activo = (form.modo_redondeo || 'CENTENA_100') === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => set('modo_redondeo', m.id)}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    activo
                      ? 'bg-primary-950/40 border-primary-500 ring-1 ring-primary-500/30'
                      : 'bg-dark-700/50 border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-xs font-bold ${activo ? 'text-primary-400' : 'text-white'}`}>
                      {m.nombre}
                    </span>
                    <span className="text-[10px] font-mono bg-dark-800 px-1.5 py-0.5 rounded text-primary-300 font-semibold">
                      {m.ejemplo}
                    </span>
                  </div>
                  <p className="text-dark-400 text-[11px] leading-relaxed">{m.desc}</p>
                </button>
              )
            })}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-dark-900/60 p-3 rounded-xl border border-primary-600/30">
            <div className="text-xs">
              <p className="text-white font-semibold flex items-center gap-1.5">
                <span>⚡</span> Aplicar esta regla a todo el inventario existente
              </p>
              <p className="text-dark-400 text-[11px] mt-0.5">
                Recalcula y aproxima automáticamente los precios de Caja, Blíster y Unidad de todos los productos ya guardados en tu catálogo.
              </p>
            </div>
            <button
              type="button"
              disabled={aplicandoRedondeo}
              onClick={handleAplicarRedondeoGlobal}
              className="btn-primary py-1.5 px-4 text-xs font-bold whitespace-nowrap flex items-center gap-1.5 shadow-md flex-shrink-0"
            >
              {aplicandoRedondeo ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>{aplicandoRedondeo ? 'Procesando...' : 'Aplicar a todo el catálogo'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Configuración de Facturación e Impresión ───────────── */}
      <div className="card space-y-4">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <FileText size={16} className="text-primary-400" />
          Configuración de Facturación e Impresión de Tickets POS
        </h3>

        {/* Selector de Formato de Impresión Predeterminado */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-dark-300">
            Formato de Impresión Predeterminado:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                id: '80MM',
                nombre: '🧾 Tirilla 80mm (Estándar POS)',
                desc: 'Para impresoras térmicas Epson, Bixolon, Xprinter 80mm de mostrador.',
                badge: 'Más común en POS',
              },
              {
                id: '58MM',
                nombre: '🧾 Tirilla 58mm (Compacta / Mini)',
                desc: 'Para impresoras térmicas compactas, mini portátiles o inalámbricas Bluetooth.',
                badge: 'Móvil / Mini',
              },
              {
                id: 'CARTA',
                nombre: '📄 Formato Carta / A4',
                desc: 'Diseño corporativo con tabla detallada para impresoras láser o de inyección.',
                badge: 'Oficina / Carta',
              },
            ].map(f => {
              const activo = (form.formato_impresion || '80MM') === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => set('formato_impresion', f.id)}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    activo
                      ? 'bg-primary-950/50 border-primary-500 ring-1 ring-primary-500/40 text-white'
                      : 'bg-dark-700/40 border-dark-700 text-dark-400 hover:border-dark-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-xs font-bold ${activo ? 'text-primary-300' : 'text-white'}`}>
                      {f.nombre}
                    </span>
                  </div>
                  <p className="text-[11px] text-dark-400 leading-snug">{f.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Prefijo Factura</label>
            <input
              className="input-field py-1.5 text-xs font-mono"
              value={form.factura_prefijo || 'FV'}
              onChange={e => set('factura_prefijo', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Símbolo Moneda</label>
            <input
              className="input-field py-1.5 text-xs font-mono text-center"
              value={form.moneda_simbolo || '$'}
              onChange={e => set('moneda_simbolo', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Mensaje al pie de factura</label>
            <input
              className="input-field py-1.5 text-xs"
              placeholder="Ej: ¡Gracias por su compra!"
              value={form.mensaje_factura || ''}
              onChange={e => set('mensaje_factura', e.target.value)}
            />
          </div>
        </div>

        {/* ── Gestor de Resoluciones de Numeración DIAN ──────────── */}
        <div className="pt-3 border-t border-dark-700 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-white font-bold text-xs flex items-center gap-1.5">
                <Award size={15} className="text-amber-400" />
                <span>Resoluciones de Numeración DIAN (Formulario 1876)</span>
              </h4>
              <p className="text-dark-400 text-[11px] mt-0.5">
                Controla los rangos autorizados (desde/hasta), vigencia en meses, contador de facturas y archivo histórico de renovaciones.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleAbrirModalNuevaResolucion()}
              className="btn-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 border-amber-500 shadow-md whitespace-nowrap self-start sm:self-auto"
            >
              <Plus size={14} />
              <span>➕ Nueva Resolución / Renovar DIAN</span>
            </button>
          </div>

          {/* Tarjeta de Resolución Activa Vigente */}
          {resolucionActiva ? (
            <div className="bg-dark-900/90 border border-emerald-500/50 rounded-xl p-4 space-y-3 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dark-700/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Resolución Activa Vigente ({resolucionActiva.tipo_documento})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAbrirModalNuevaResolucion(resolucionActiva)}
                    className="text-[11px] text-primary-400 hover:text-primary-300 underline flex items-center gap-1"
                  >
                    <Edit3 size={12} />
                    <span>Editar / Ajustar</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-dark-500 text-[10px] block font-medium">N° Formulario DIAN:</span>
                  <strong className="text-white font-mono text-xs">{resolucionActiva.numero_resolucion}</strong>
                </div>

                <div>
                  <span className="text-dark-500 text-[10px] block font-medium">Prefijo Autorizado:</span>
                  <strong className="text-primary-400 font-mono text-xs font-bold">{resolucionActiva.prefijo || 'S/P'}</strong>
                </div>

                <div>
                  <span className="text-dark-500 text-[10px] block font-medium">Rango Autorizado:</span>
                  <strong className="text-white font-mono text-xs">
                    {resolucionActiva.rango_desde.toLocaleString()} al {resolucionActiva.rango_hasta.toLocaleString()}
                  </strong>
                </div>

                <div>
                  <span className="text-dark-500 text-[10px] block font-medium">Vigencia / Vencimiento:</span>
                  <div className="flex items-center gap-1.5">
                    <strong className="text-white font-mono text-xs">{resolucionActiva.fecha_vencimiento}</strong>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {resolucionActiva.vigencia_meses}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Barra de Conteo y Progreso de Facturación */}
              <div className="bg-dark-800 p-3 rounded-lg border border-dark-700 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-dark-300 font-medium">
                    Consecutivo actual emitido: <strong className="text-white font-mono text-sm">#{resolucionActiva.consecutivo_actual.toLocaleString()}</strong> de {resolucionActiva.rango_hasta.toLocaleString()}
                  </span>
                  <span className="font-mono text-primary-300 font-bold text-xs">
                    {Math.min(100, Math.max(0, ((resolucionActiva.consecutivo_actual - resolucionActiva.rango_desde + 1) / Math.max(1, resolucionActiva.rango_hasta - resolucionActiva.rango_desde + 1)) * 100)).toFixed(1)}% utilizado
                  </span>
                </div>

                <div className="w-full h-2 bg-dark-900 rounded-full overflow-hidden border border-dark-700">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-emerald-400 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((resolucionActiva.consecutivo_actual - resolucionActiva.rango_desde + 1) / Math.max(1, resolucionActiva.rango_hasta - resolucionActiva.rango_desde + 1)) * 100))}%`
                    }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-dark-500 pt-0.5">
                  <span>Inicio: #{resolucionActiva.rango_desde.toLocaleString()}</span>
                  <span>Disponibles: <strong className="text-dark-300 font-mono">{(resolucionActiva.rango_hasta - resolucionActiva.consecutivo_actual).toLocaleString()} folios</strong></span>
                  <span>Límite: #{resolucionActiva.rango_hasta.toLocaleString()}</span>
                </div>
              </div>

              {/* Texto Legal Formateado */}
              <div className="bg-dark-950/80 p-2.5 rounded-lg border border-dark-700 text-[11px] text-dark-300 font-mono flex items-start gap-2">
                <FileText size={14} className="text-dark-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[10px] text-dark-500 font-sans block">Texto que se estampa en el pie de tus facturas y tirillas:</span>
                  <p className="text-dark-300 leading-relaxed select-all">{resolucionActiva.texto_resolucion}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-dark-900/60 p-4 rounded-xl border border-dashed border-dark-600 text-center space-y-2">
              <p className="text-xs text-dark-400">
                No tienes ninguna Resolución DIAN configurada. El sistema está operando con numeración interna estándar (<strong>{form.factura_prefijo || 'FV'}</strong>).
              </p>
              <button
                type="button"
                onClick={() => handleAbrirModalNuevaResolucion()}
                className="btn-primary py-1.5 px-4 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Registrar Formulario 1876 de la DIAN</span>
              </button>
            </div>
          )}

          {/* Historial de Resoluciones Pasadas */}
          {resoluciones.length > 1 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setMostrarHistorialResoluciones(!mostrarHistorialResoluciones)}
                className="text-xs text-dark-400 hover:text-white flex items-center gap-1 font-semibold transition-colors"
              >
                {mostrarHistorialResoluciones ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>📜 Historial de Resoluciones Anteriores ({resoluciones.length - 1} archivadas)</span>
              </button>

              {mostrarHistorialResoluciones && (
                <div className="mt-2 overflow-x-auto border border-dark-700 rounded-xl bg-dark-900/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-dark-900 text-dark-400 text-[10px] uppercase font-semibold border-b border-dark-700">
                      <tr>
                        <th className="px-3 py-2">N° Resolución</th>
                        <th className="px-3 py-2">Prefijo</th>
                        <th className="px-3 py-2">Rango</th>
                        <th className="px-3 py-2">Último Emitido</th>
                        <th className="px-3 py-2">Vigencia</th>
                        <th className="px-3 py-2 text-center">Estado</th>
                        <th className="px-3 py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700/60">
                      {resoluciones.map(r => (
                        <tr key={r.id} className={r.activa ? 'bg-emerald-950/20' : 'hover:bg-dark-800/40'}>
                          <td className="px-3 py-2 font-mono font-medium text-white">{r.numero_resolucion}</td>
                          <td className="px-3 py-2 font-mono font-bold text-primary-400">{r.prefijo || 'S/P'}</td>
                          <td className="px-3 py-2 font-mono text-dark-300">{r.rango_desde} al {r.rango_hasta}</td>
                          <td className="px-3 py-2 font-mono text-white font-bold">#{r.consecutivo_actual}</td>
                          <td className="px-3 py-2 text-dark-400 text-[11px]">{r.fecha_expedicion} al {r.fecha_vencimiento}</td>
                          <td className="px-3 py-2 text-center">
                            {r.activa ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                                VIGENTE
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-dark-800 text-dark-500 border border-dark-700">
                                HISTÓRICA
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!r.activa && (
                                <button
                                  type="button"
                                  onClick={() => handleActivarResolucion(r.id)}
                                  className="btn-secondary py-1 px-2 text-[10px] text-emerald-300 hover:border-emerald-500"
                                  title="Establecer como la resolución activa"
                                >
                                  Activar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleEliminarResolucion(r.id)}
                                className="text-dark-500 hover:text-red-400 p-1"
                                title="Eliminar resolución"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tarifas de Domicilios ───────────────────────────────── */}
      <div className="card space-y-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Truck size={16} className="text-primary-400" />
          Tarifas y Parámetros de Domicilio
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Zona Corta (&le;3 km) ($)</label>
            <input
              type="number"
              className="input-field py-1.5 text-xs font-mono"
              value={form.domicilio_corta || 0}
              onChange={e => set('domicilio_corta', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Zona Media (3-6 km) ($)</label>
            <input
              type="number"
              className="input-field py-1.5 text-xs font-mono"
              value={form.domicilio_media || 0}
              onChange={e => set('domicilio_media', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Zona Larga (&gt;6 km) ($)</label>
            <input
              type="number"
              className="input-field py-1.5 text-xs font-mono"
              value={form.domicilio_larga || 0}
              onChange={e => set('domicilio_larga', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Tarifa Base Sugerida ($)</label>
            <input
              type="number"
              className="input-field py-1.5 text-xs font-mono"
              value={form.domicilio_tarifa_base || 0}
              onChange={e => set('domicilio_tarifa_base', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Costo por KM extra ($)</label>
            <input
              type="number"
              className="input-field py-1.5 text-xs font-mono"
              value={form.domicilio_costo_por_km || 0}
              onChange={e => set('domicilio_costo_por_km', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Envío Gratis desde ($) <span className="text-dark-500">(0 = inactivo)</span></label>
            <input
              type="number"
              className="input-field py-1.5 text-xs font-mono"
              value={form.domicilio_gratis_desde || 0}
              onChange={e => set('domicilio_gratis_desde', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* Botón Guardar Inferior */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={guardando}
          className="btn-primary py-2.5 px-8 font-bold text-xs shadow-lg flex items-center gap-2"
        >
          {guardando ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          <span>{guardando ? 'Guardando...' : 'Guardar Todos los Cambios'}</span>
        </button>
      </div>

      {/* ── MODAL: REGISTRAR / RENOVAR RESOLUCIÓN DIAN ───────────── */}
      {modalResolucion && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModalResolucion(null)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-xl p-5 border border-dark-600 shadow-2xl space-y-4 my-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-dark-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-500/60 text-amber-400 flex items-center justify-center shadow-lg">
                  <Award size={22} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">
                    {modalResolucion.id ? 'Editar Resolución DIAN' : 'Registrar / Renovar Resolución DIAN'}
                  </h3>
                  <p className="text-dark-400 text-xs">Formulario 1876 de Autorización de Numeración</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalResolucion(null)}
                className="text-dark-500 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Formulario de la Resolución */}
            <form onSubmit={handleGuardarResolucionModal} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-dark-400 font-semibold mb-1">
                    N° de Resolución / Formulario DIAN 1876 *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field py-2 text-xs font-mono font-bold"
                    placeholder="Ej: 18764000001234"
                    value={modalResolucion.numero_resolucion}
                    onChange={e => setModalResolucion({ ...modalResolucion, numero_resolucion: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-dark-400 font-semibold mb-1">
                    Prefijo Autorizado *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field py-2 text-xs font-mono font-bold text-primary-300 uppercase"
                    placeholder="Ej: POS o FV"
                    value={modalResolucion.prefijo}
                    onChange={e => setModalResolucion({ ...modalResolucion, prefijo: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              {/* Rango Desde / Hasta y Consecutivo Inicial */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-dark-400 font-semibold mb-1">
                    Rango Desde *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="input-field py-2 text-xs font-mono"
                    value={modalResolucion.rango_desde}
                    onChange={e => setModalResolucion({ ...modalResolucion, rango_desde: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div>
                  <label className="block text-dark-400 font-semibold mb-1">
                    Rango Hasta *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="input-field py-2 text-xs font-mono"
                    value={modalResolucion.rango_hasta}
                    onChange={e => setModalResolucion({ ...modalResolucion, rango_hasta: parseInt(e.target.value) || 10000 })}
                  />
                </div>

                <div>
                  <label className="block text-dark-400 font-semibold mb-1">
                    Consecutivo Inicial / Actual:
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-field py-2 text-xs font-mono text-emerald-400 font-bold"
                    placeholder="0 = Iniciar desde rango"
                    value={modalResolucion.consecutivo_actual}
                    onChange={e => setModalResolucion({ ...modalResolucion, consecutivo_actual: parseInt(e.target.value) || 0 })}
                  />
                  <span className="text-[10px] text-dark-500 block mt-0.5">La siguiente venta será #{modalResolucion.consecutivo_actual + 1}</span>
                </div>
              </div>

              {/* Fechas y Vigencia */}
              <div className="bg-dark-900/80 p-3.5 rounded-xl border border-dark-700 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-dark-400 font-semibold mb-1">
                      Fecha de Expedición *
                    </label>
                    <input
                      type="date"
                      required
                      className="input-field py-1.5 text-xs font-mono"
                      value={modalResolucion.fecha_expedicion}
                      onChange={e => {
                        const fExp = e.target.value
                        // Recalcular vencimiento con vigencia_meses
                        try {
                          const d = new Date(fExp)
                          d.setMonth(d.getMonth() + (modalResolucion.vigencia_meses || 24))
                          const y = d.getFullYear()
                          const m = String(d.getMonth() + 1).padStart(2, '0')
                          const day = String(d.getDate()).padStart(2, '0')
                          setModalResolucion({
                            ...modalResolucion,
                            fecha_expedicion: fExp,
                            fecha_vencimiento: `${y}-${m}-${day}`
                          })
                        } catch {
                          setModalResolucion({ ...modalResolucion, fecha_expedicion: fExp })
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-dark-400 font-semibold mb-1">
                      Vigencia en Meses:
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[12, 18, 24].map(meses => (
                        <button
                          key={meses}
                          type="button"
                          onClick={() => {
                            try {
                              const d = new Date(modalResolucion.fecha_expedicion || new Date())
                              d.setMonth(d.getMonth() + meses)
                              const y = d.getFullYear()
                              const m = String(d.getMonth() + 1).padStart(2, '0')
                              const day = String(d.getDate()).padStart(2, '0')
                              setModalResolucion({
                                ...modalResolucion,
                                vigencia_meses: meses,
                                fecha_vencimiento: `${y}-${m}-${day}`
                              })
                            } catch {
                              setModalResolucion({ ...modalResolucion, vigencia_meses: meses })
                            }
                          }}
                          className={`py-1.5 rounded-lg text-xs font-bold border ${
                            modalResolucion.vigencia_meses === meses
                              ? 'bg-amber-950 border-amber-500 text-amber-300'
                              : 'bg-dark-800 border-dark-700 text-dark-400'
                          }`}
                        >
                          {meses}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-dark-400 font-semibold mb-1">
                      Fecha de Vencimiento *
                    </label>
                    <input
                      type="date"
                      required
                      className="input-field py-1.5 text-xs font-mono font-bold text-white"
                      value={modalResolucion.fecha_vencimiento}
                      onChange={e => setModalResolucion({ ...modalResolucion, fecha_vencimiento: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Casilla de Activa */}
              <div className="bg-dark-900/60 p-3 rounded-xl border border-dark-700 flex items-center justify-between">
                <div>
                  <strong className="text-white text-xs block">Establecer como Resolución Activa Vigente</strong>
                  <p className="text-dark-500 text-[11px]">
                    Si marcas esta casilla, la resolución actual anterior pasará automáticamente al archivo histórico y la nueva empezará a regir.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-primary-600 bg-dark-800 border-dark-700 cursor-pointer"
                  checked={!!modalResolucion.activa}
                  onChange={e => setModalResolucion({ ...modalResolucion, activa: e.target.checked })}
                />
              </div>

              {/* Botones del Modal */}
              <div className="flex gap-3 pt-2 border-t border-dark-700">
                <button
                  type="button"
                  onClick={() => setModalResolucion(null)}
                  className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoResolucion}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 border-amber-500 shadow-lg flex items-center justify-center gap-1.5"
                >
                  {guardandoResolucion ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{guardandoResolucion ? 'Guardando...' : 'Guardar Resolución'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </form>
  )
}


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

const DEFAULT_CONFIG = {
  nombre: 'Mi Negocio',
  nit: '',
  direccion: '',
  telefono: '',
  email: '',
  ciudad: '',
  regimen: 'RESPONSABLE_IVA',
  logo_url: '',
  mensaje_factura: '¡Gracias por su compra!',
  moneda_simbolo: '$',
  moneda_decimales: 0,
  factura_prefijo: 'POS',
  iva_porcentaje: 0,
  iva_incluido: false,
  domicilio_corta: 3000,
  domicilio_media: 5000,
  domicilio_larga: 8000,
  domicilio_tarifa_base: 4000,
  domicilio_costo_por_km: 1500,
  domicilio_gratis_desde: 0,
  rubro: 'FARMACIA',
  margen_ganancia_predeterminado: 30,
  modo_redondeo: 'CENTENA_100',
  formato_impresion: '80MM',
  resolucion_dian: '',
  pais: 'Colombia',
  zona_horaria: 'America/Bogota',
  fe_habilitada: false,
  fe_proveedor: 'FACTUS',
  fe_ambiente: 'SANDBOX',
  fe_client_id: '',
  fe_client_secret: '',
  fe_rango_id: '',
  fe_tipo_documento: 'POS_ELECTRONICO',
  fe_municipio_id: '980',
  fe_test_set_id: '',
}

export default function ParametrosEmpresa() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [form, setForm] = useState(DEFAULT_CONFIG)
  const [cargandoConfig, setCargandoConfig] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aplicandoRedondeo, setAplicandoRedondeo] = useState(false)
  const [probandoFactus, setProbandoFactus] = useState(false)
  const [rangosFactus, setRangosFactus] = useState([])
  const [cargandoRangos, setCargandoRangos] = useState(false)
  const [ejecutandoPruebas, setEjecutandoPruebas] = useState(false)
  const [resultadoPruebas, setResultadoPruebas] = useState(null)

  // Resoluciones DIAN
  const [resoluciones, setResoluciones] = useState([])
  const [cargandoResoluciones, setCargandoResoluciones] = useState(false)
  const [modalResolucion, setModalResolucion] = useState(null)
  const [guardandoResolucion, setGuardandoResolucion] = useState(false)
  const [mostrarHistorialResoluciones, setMostrarHistorialResoluciones] = useState(false)

  useEffect(() => {
    configApi.get().then(data => {
      if (data) {
        setConfig(data)
        setForm(data)
      }
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

  // Estado para acordeón de cajones desplegables
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({
    pais_zona: false,
    facturacion_electronica: false,
    rubro: false,
    datos_fiscales: true,
    precios_margenes: false,
    facturacion_impresion: false,
    domicilios: false,
  })

  const toggleSeccion = (id) => {
    setSeccionesAbiertas(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const toggleTodas = (abrir) => {
    setSeccionesAbiertas({
      pais_zona: abrir,
      facturacion_electronica: abrir,
      rubro: abrir,
      datos_fiscales: abrir,
      precios_margenes: abrir,
      facturacion_impresion: abrir,
      domicilios: abrir,
    })
  }

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

  const handleEjecutarSetPruebas = async () => {
    if (!form.fe_test_set_id?.trim()) {
      toast.error('Por favor ingresa primero el código TestSetID que te dio la DIAN')
      return
    }
    setEjecutandoPruebas(true)
    setResultadoPruebas(null)
    try {
      const res = await configApi.ejecutarSetPruebas({
        test_set_id: form.fe_test_set_id.trim(),
        client_id: form.fe_client_id,
        client_secret: form.fe_client_secret,
        ambiente: form.fe_ambiente || 'SANDBOX'
      })
      if (res.exito) {
        setResultadoPruebas(res)
        toast.success('¡Set de Pruebas DIAN ejecutado con éxito total!', { duration: 5000, icon: '🎉' })
      } else {
        toast.error(res.mensaje || 'Error al ejecutar set de pruebas')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al conectar con la DIAN')
    } finally {
      setEjecutandoPruebas(false)
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

  const prepararPayload = (datos) => ({
    ...datos,
    nombre: (datos.nombre || '').trim(),
    nit: (datos.nit || '').trim(),
    telefono: (datos.telefono || '').trim(),
    email: (datos.email || '').trim(),
    ciudad: (datos.ciudad || '').trim(),
    direccion: (datos.direccion || '').trim(),
    rubro: datos.rubro || 'FARMACIA',
    margen_ganancia_predeterminado: parseFloat(datos.margen_ganancia_predeterminado) || 30.0,
    modo_redondeo: datos.modo_redondeo || 'CENTENA_100',
    formato_impresion: datos.formato_impresion || '80MM',
    pais: datos.pais || 'Colombia',
    zona_horaria: datos.zona_horaria || 'America/Bogota',
    domicilio_corta: parseFloat(datos.domicilio_corta) || 0,
    domicilio_media: parseFloat(datos.domicilio_media) || 0,
    domicilio_larga: parseFloat(datos.domicilio_larga) || 0,
    domicilio_tarifa_base: parseFloat(datos.domicilio_tarifa_base) || 0,
    domicilio_costo_por_km: parseFloat(datos.domicilio_costo_por_km) || 0,
    domicilio_gratis_desde: parseFloat(datos.domicilio_gratis_desde) || 0,
    iva_porcentaje: parseFloat(datos.iva_porcentaje) || 0,
    iva_incluido: Boolean(datos.iva_incluido),
    moneda_decimales: parseInt(datos.moneda_decimales) || 0,
    fe_habilitada: Boolean(datos.fe_habilitada),
    fe_ambiente: datos.fe_ambiente || 'SANDBOX',
    fe_client_id: (datos.fe_client_id || '').trim(),
    fe_client_secret: (datos.fe_client_secret || '').trim(),
    fe_rango_id: (datos.fe_rango_id || datos.fe_numbering_range_id || '').trim(),
    fe_tipo_documento: datos.fe_tipo_documento || datos.fe_tipo_documento_defecto || 'POS_ELECTRONICO',
    fe_municipio_id: (datos.fe_municipio_id || '980').trim(),
  })

  const guardar = async (e) => {
    e?.preventDefault()
    setGuardando(true)
    try {
      const payload = prepararPayload(form)
      await configApi.update(payload)
      // Si cambió el modo de redondeo, aplicarlo globalmente al catálogo
      if (payload.modo_redondeo && payload.modo_redondeo !== config.modo_redondeo) {
        await productosApi.aplicarRedondeoGlobal()
        toast.success('✓ Parámetros guardados y regla de redondeo aplicada al catálogo')
      } else {
        toast.success('✓ Parámetros de empresa guardados exitosamente')
      }
      setConfig({ ...payload })
      setForm({ ...payload })
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al guardar parámetros')
    } finally {
      setGuardando(false)
    }
  }

  const handleAplicarRedondeoGlobal = async () => {
    setAplicandoRedondeo(true)
    try {
      const payload = prepararPayload(form)
      await configApi.update(payload)
      const res = await productosApi.aplicarRedondeoGlobal()
      setConfig({ ...payload })
      setForm({ ...payload })
      toast.success(res.mensaje || '✓ Redondeo aplicado con éxito a todo el catálogo')
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al aplicar redondeo')
    } finally {
      setAplicandoRedondeo(false)
    }
  }

  return (
    <>
      <form onSubmit={guardar} className="space-y-3.5 sm:space-y-5 w-full max-w-full min-w-0">
      {/* ── Encabezado ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-dark-700 w-full min-w-0">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Settings size={18} className="text-primary-500 flex-shrink-0" />
            <span>Parámetros Generales y Empresa</span>
          </h2>
          <p className="text-dark-400 text-[11px] sm:text-xs mt-0.5">
            Configuración fiscal, país, zona horaria, márgenes y reglas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <div className="flex items-center gap-1 bg-dark-800 p-1 rounded-xl border border-dark-700">
            <button
              type="button"
              onClick={() => toggleTodas(true)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-dark-300 hover:text-white hover:bg-dark-700 transition-colors flex items-center gap-1"
              title="Desplegar todas las secciones"
            >
              <ChevronDown size={13} />
              <span>Desplegar Todo</span>
            </button>
            <button
              type="button"
              onClick={() => toggleTodas(false)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-dark-300 hover:text-white hover:bg-dark-700 transition-colors flex items-center gap-1"
              title="Contraer todas las secciones"
            >
              <ChevronUp size={13} />
              <span>Contraer Todo</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="btn-primary flex items-center justify-center gap-1.5 py-2 px-4 font-bold text-xs shadow-lg flex-shrink-0"
          >
            {guardando ? <RefreshCw size={14} className="animate-spin" /> : <Save size={15} />}
            <span>{guardando ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>

      {/* ── 1. Selector de País de Origen y Zona Horaria ────────────── */}
      <div className="card p-0 overflow-hidden shadow-lg border border-dark-700 w-full max-w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSeccion('pais_zona')}
          className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-dark-700/30 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-primary-950/60 border border-primary-800/50 text-primary-400 flex items-center justify-center flex-shrink-0">
              <Globe size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-xs sm:text-sm truncate">
                País de Origen y Zona Horaria Oficial
              </h3>
              <p className="text-dark-400 text-[10px] sm:text-xs truncate">
                {form.pais || 'Colombia'} · {form.zona_horaria || 'America/Bogota'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline text-[11px] font-mono text-dark-400 bg-dark-900 px-2 py-0.5 rounded border border-dark-700">
              {obtenerHoraActualEnZona(form.zona_horaria)}
            </span>
            <div className={`w-7 h-7 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center text-dark-300 transition-transform duration-200 ${seccionesAbiertas.pais_zona ? 'rotate-180 text-primary-400' : ''}`}>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {seccionesAbiertas.pais_zona && (
          <div className="p-3.5 sm:p-4 pt-0 space-y-3 sm:space-y-4 border-t border-dark-700/60 animate-in fade-in duration-150">
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
        )}
      </div>

      {/* ── 2. Facturación Electrónica DIAN & POS Electrónico (Factus API) ─ */}
      <div className={`card p-0 overflow-hidden shadow-lg border transition-all w-full max-w-full ${
        form.fe_habilitada ? 'border-primary-500/60 bg-gradient-to-br from-dark-800 via-dark-800 to-primary-950/20' : 'border-dark-700'
      }`}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSeccion('facturacion_electronica')}
          className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-dark-700/30 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/50 text-amber-400 flex items-center justify-center flex-shrink-0">
              <Zap size={16} className={form.fe_habilitada ? 'animate-pulse text-amber-300' : ''} />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-xs sm:text-sm truncate">
                Facturación Electrónica DIAN & POS Electrónico (Factus API)
              </h3>
              <p className="text-dark-400 text-[10px] sm:text-xs truncate">
                {form.fe_habilitada ? `HABILITADA · Entorno ${form.fe_ambiente || 'SANDBOX'}` : 'INACTIVA'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={!!form.fe_habilitada}
                onChange={e => set('fe_habilitada', e.target.checked)}
              />
              <div className="w-9 sm:w-11 h-5 sm:h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 sm:after:h-5 after:w-4 sm:after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
            <span className="text-[10px] sm:text-xs font-bold text-white hidden sm:inline">
              {form.fe_habilitada ? 'HABILITADA' : 'INACTIVA'}
            </span>
            <div
              onClick={() => toggleSeccion('facturacion_electronica')}
              className={`w-7 h-7 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center text-dark-300 transition-transform duration-200 cursor-pointer ${seccionesAbiertas.facturacion_electronica ? 'rotate-180 text-primary-400' : ''}`}
            >
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {seccionesAbiertas.facturacion_electronica && (
          <div className="p-3.5 sm:p-4 pt-0 space-y-4 border-t border-dark-700/60 animate-in fade-in duration-150">
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
                  📄 Tipo de Documento DIAN por Defecto:
                </label>
                <select
                  className="input-field py-2 text-xs font-semibold bg-dark-800"
                  value={form.fe_tipo_documento_defecto || 'FACTURA_ELECTRONICA'}
                  onChange={e => set('fe_tipo_documento_defecto', e.target.value)}
                >
                  <option value="FACTURA_ELECTRONICA">📄 Factura Electrónica de Venta (FEV)</option>
                  <option value="DOCUMENTO_EQUIVALENTE_POS">🧾 Documento Equivalente POS Electrónico</option>
                </select>
              </div>
            </div>

            {/* Credenciales de Factus API */}
            <div className="bg-dark-900/60 p-4 rounded-xl border border-dark-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Key size={14} className="text-primary-400" />
                  Credenciales de Autenticación Factus
                </span>
                <span className="text-[11px] text-dark-400">
                  Obtén tus llaves en <a href="https://factus.com.co" target="_blank" rel="noreferrer" className="text-primary-400 hover:underline">factus.com.co</a>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-dark-400 mb-1 font-semibold">
                    Client ID (Identificador de Cliente):
                  </label>
                  <input
                    type="text"
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="Ej: a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                    value={form.fe_client_id || ''}
                    onChange={e => set('fe_client_id', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-dark-400 mb-1 font-semibold">
                    Client Secret (Clave Secreta):
                  </label>
                  <input
                    type="password"
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="••••••••••••••••••••••••••••••••"
                    value={form.fe_client_secret || ''}
                    onChange={e => set('fe_client_secret', e.target.value)}
                  />
                </div>
              </div>

              {/* Rango de Numeración Factus */}
              <div className="pt-2 border-t border-dark-700/60 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-[11px] text-dark-400 font-semibold">
                    Rango de Numeración DIAN en Factus (ID del Rango):
                  </label>
                  <button
                    type="button"
                    disabled={cargandoRangos}
                    onClick={handleCargarRangosFactus}
                    className="text-[11px] text-primary-400 hover:text-primary-300 font-semibold underline flex items-center gap-1 self-start sm:self-auto"
                  >
                    <RefreshCw size={11} className={cargandoRangos ? 'animate-spin' : ''} />
                    <span>{cargandoRangos ? 'Consultando rangos...' : 'Consultar mis rangos en Factus'}</span>
                  </button>
                </div>

                {rangosFactus.length > 0 ? (
                  <select
                    className="input-field py-1.5 text-xs font-mono bg-dark-800"
                    value={form.fe_numbering_range_id || ''}
                    onChange={e => set('fe_numbering_range_id', e.target.value)}
                  >
                    <option value="">-- Selecciona el rango autorizado --</option>
                    {rangosFactus.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.prefix || 'S/P'} (#{r.from} a #{r.to}) - Res. {r.resolution_number} {r.document_type ? `[${r.document_type}]` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="Ej: 1 (ID numérico asignado por Factus para tu resolución)"
                    value={form.fe_numbering_range_id || ''}
                    onChange={e => set('fe_numbering_range_id', e.target.value)}
                  />
                )}
              </div>

              {/* Municipio DANE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-dark-700/60">
                <div>
                  <label className="block text-[11px] text-dark-400 mb-1 font-semibold">
                    Régimen Fiscal del Emisor:
                  </label>
                  <select
                    className="input-field py-1.5 text-xs bg-dark-800"
                    value={form.regimen || 'RESPONSABLE_IVA'}
                    onChange={e => set('regimen', e.target.value)}
                  >
                    <option value="RESPONSABLE_IVA">Responsable de IVA (Común)</option>
                    <option value="NO_RESPONSABLE_IVA">No Responsable de IVA (Simplificado)</option>
                    <option value="REGIMEN_SIMPLE">Régimen Simple de Tributación (SIMPLE)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-dark-400 mb-1 font-semibold">
                    Código DANE Municipio Emisor:
                  </label>
                  <input
                    type="text"
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="980 (Bogotá D.C.) | 1 (Medellín)"
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

              {/* ── EJECUTOR AUTOMÁTICO DE SET DE PRUEBAS DIAN ────────── */}
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-dark-900 to-dark-900 border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 font-bold">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                        <span>Habilitación DIAN Automática (Set de Pruebas)</span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-semibold border border-amber-500/30">
                          10 Facturas + 2 NC + 2 ND
                        </span>
                      </h4>
                      <p className="text-[11px] text-dark-400">
                        Supera las pruebas obligatorias de la DIAN sin digitar formularios manuales.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="block text-[11px] font-semibold text-dark-300">
                    Código del Set de Pruebas DIAN (TestSetID):
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      className="input-field py-2 text-xs font-mono font-bold flex-1 tracking-wider text-amber-300 placeholder:text-dark-600 placeholder:font-normal"
                      placeholder="Pega aquí tu TestSetID (ej: fa326ca7-c1f8-40d3-a6fc-24d7c1040607)"
                      value={form.fe_test_set_id || ''}
                      onChange={e => set('fe_test_set_id', e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={ejecutandoPruebas || !form.fe_test_set_id?.trim()}
                      onClick={handleEjecutarSetPruebas}
                      className="btn-primary py-2 px-5 text-xs font-bold bg-amber-600 hover:bg-amber-500 border-amber-500 shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
                    >
                      {ejecutandoPruebas ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Transmitiendo a la DIAN...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={14} className="text-white fill-white" />
                          <span>⚡ Ejecutar Set de Pruebas</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-dark-500">
                    💡 Entra a <b>catalogo-vpfe-hab.dian.gov.co ➡️ Registro y Habilitación ➡️ Factura Electrónica</b> para copiar tu TestSetID.
                  </p>
                </div>

                {/* Reporte de Resultados del Set de Pruebas */}
                {resultadoPruebas && (
                  <div className="mt-3 p-3.5 bg-dark-950/80 rounded-xl border border-emerald-500/50 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-dark-800 pb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <span className="text-xs font-bold text-white">
                          {resultadoPruebas.mensaje}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300">
                        {resultadoPruebas.resumen?.estado_dian || 'HABILITADO'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-dark-900 p-2 rounded-lg border border-dark-800">
                        <span className="text-[10px] text-dark-400 block">Facturas Aceptadas</span>
                        <span className="font-bold text-emerald-400 font-mono text-sm">
                          {resultadoPruebas.resumen?.facturas_aceptadas} / 10
                        </span>
                      </div>
                      <div className="bg-dark-900 p-2 rounded-lg border border-dark-800">
                        <span className="text-[10px] text-dark-400 block">Notas Crédito</span>
                        <span className="font-bold text-emerald-400 font-mono text-sm">
                          {resultadoPruebas.resumen?.notas_credito_aceptadas} / 2
                        </span>
                      </div>
                      <div className="bg-dark-900 p-2 rounded-lg border border-dark-800">
                        <span className="text-[10px] text-dark-400 block">Notas Débito</span>
                        <span className="font-bold text-emerald-400 font-mono text-sm">
                          {resultadoPruebas.resumen?.notas_debito_aceptadas} / 2
                        </span>
                      </div>
                      <div className="bg-dark-900 p-2 rounded-lg border border-dark-800">
                        <span className="text-[10px] text-dark-400 block">Total Documentos</span>
                        <span className="font-bold text-primary-400 font-mono text-sm">
                          {resultadoPruebas.resumen?.total_documentos} / 14
                        </span>
                      </div>
                    </div>

                    <div className="p-2 bg-emerald-950/30 rounded-lg border border-emerald-800/30 text-[11px] text-emerald-300 flex items-center gap-1.5">
                      <span>✓</span>
                      <span>
                        ¡Todo listo! Actualiza la página del portal DIAN para comprobar que tu estado cambió a <b>"Habilitado"</b> y solicitar tu resolución de producción en el MUISCA.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. Selector de Rubro / Tipo de Negocio ─────────────────── */}
      <div className="card p-0 overflow-hidden shadow-lg border border-dark-700 w-full max-w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSeccion('rubro')}
          className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-dark-700/30 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-indigo-400 flex items-center justify-center flex-shrink-0 text-base">
              {RUBROS.find(r => r.id === (form.rubro || 'FARMACIA'))?.icon || '🏢'}
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-xs sm:text-sm truncate">
                Rubro o Tipo de Negocio
              </h3>
              <p className="text-dark-400 text-[10px] sm:text-xs truncate">
                {RUBROS.find(r => r.id === (form.rubro || 'FARMACIA'))?.nombre || 'Droguería / Farmacia'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline text-[11px] font-semibold text-primary-300 bg-primary-950 px-2 py-0.5 rounded border border-primary-800">
              {RUBROS.find(r => r.id === (form.rubro || 'FARMACIA'))?.nombre}
            </span>
            <div className={`w-7 h-7 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center text-dark-300 transition-transform duration-200 ${seccionesAbiertas.rubro ? 'rotate-180 text-primary-400' : ''}`}>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {seccionesAbiertas.rubro && (
          <div className="p-3.5 sm:p-4 pt-0 space-y-3 border-t border-dark-700/60 animate-in fade-in duration-150">
            <p className="text-dark-400 text-xs">
              Optimiza el comportamiento del punto de venta, inventario y búsqueda según la naturaleza de tu comercio:
            </p>
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
        )}
      </div>

      {/* ── 4. Datos Fiscales de la Empresa ────────────────────────── */}
      <div className="card p-0 overflow-hidden shadow-lg border border-dark-700 w-full max-w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSeccion('datos_fiscales')}
          className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-dark-700/30 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/50 text-blue-400 flex items-center justify-center flex-shrink-0">
              <Building2 size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-xs sm:text-sm truncate">
                Información Fiscal y de Facturación
              </h3>
              <p className="text-dark-400 text-[10px] sm:text-xs truncate">
                {form.nombre || 'Mi Negocio'} · NIT: {form.nit || 'Sin NIT'} {form.ciudad ? `· ${form.ciudad}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`w-7 h-7 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center text-dark-300 transition-transform duration-200 ${seccionesAbiertas.datos_fiscales ? 'rotate-180 text-primary-400' : ''}`}>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {seccionesAbiertas.datos_fiscales && (
          <div className="p-3.5 sm:p-4 pt-0 space-y-3 border-t border-dark-700/60 animate-in fade-in duration-150">
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
        )}
      </div>

      {/* ── 5. Precios y Márgenes de Ganancia ──────────────────────── */}
      <div className="card p-0 overflow-hidden shadow-lg border border-dark-700 w-full max-w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSeccion('precios_margenes')}
          className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-dark-700/30 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Percent size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-xs sm:text-sm truncate">
                Precios, Márgenes y Reglas de Redondeo
              </h3>
              <p className="text-dark-400 text-[10px] sm:text-xs truncate">
                Margen base {form.margen_ganancia_predeterminado ?? 30}% · Redondeo: {form.modo_redondeo || 'CENTENA_100'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline text-[11px] font-mono text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              +{form.margen_ganancia_predeterminado ?? 30}% Margen
            </span>
            <div className={`w-7 h-7 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center text-dark-300 transition-transform duration-200 ${seccionesAbiertas.precios_margenes ? 'rotate-180 text-primary-400' : ''}`}>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {seccionesAbiertas.precios_margenes && (
          <div className="p-3.5 sm:p-4 pt-0 space-y-4 border-t border-dark-700/60 animate-in fade-in duration-150">
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
        )}
      </div>

      {/* ── 6. Configuración de Facturación e Impresión ───────────── */}
      <div className="card p-0 overflow-hidden shadow-lg border border-dark-700 w-full max-w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSeccion('facturacion_impresion')}
          className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-dark-700/30 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 flex items-center justify-center flex-shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-xs sm:text-sm truncate">
                Facturación, Impresión de Tickets y DIAN (1876)
              </h3>
              <p className="text-dark-400 text-[10px] sm:text-xs truncate">
                Formato {form.formato_impresion || '80MM'} · Prefijo {form.factura_prefijo || 'POS'} {resolucionActiva ? `· Res. DIAN #${resolucionActiva.numero_resolucion}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline text-[11px] font-mono text-dark-300 bg-dark-900 px-2 py-0.5 rounded border border-dark-700">
              {form.formato_impresion || '80MM'}
            </span>
            <div className={`w-7 h-7 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center text-dark-300 transition-transform duration-200 ${seccionesAbiertas.facturacion_impresion ? 'rotate-180 text-primary-400' : ''}`}>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {seccionesAbiertas.facturacion_impresion && (
          <div className="p-3.5 sm:p-4 pt-0 space-y-4 border-t border-dark-700/60 animate-in fade-in duration-150">
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
                    <div className="mt-2 overflow-x-auto border border-dark-700 rounded-xl bg-dark-900/60 w-full max-w-full touch-scroll-x table-responsive-container">
                      <table className="w-full text-left text-xs min-w-[650px]">
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
        )}
      </div>

      {/* ── 7. Tarifas de Domicilios ───────────────────────────────── */}
      <div className="card p-0 overflow-hidden shadow-lg border border-dark-700 w-full max-w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSeccion('domicilios')}
          className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-dark-700/30 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/50 text-amber-400 flex items-center justify-center flex-shrink-0">
              <Truck size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-xs sm:text-sm truncate">
                Tarifas y Parámetros de Domicilio
              </h3>
              <p className="text-dark-400 text-[10px] sm:text-xs truncate">
                Corta ${(form.domicilio_corta || 0).toLocaleString()} · Media ${(form.domicilio_media || 0).toLocaleString()} · Larga ${(form.domicilio_larga || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`w-7 h-7 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center text-dark-300 transition-transform duration-200 ${seccionesAbiertas.domicilios ? 'rotate-180 text-primary-400' : ''}`}>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {seccionesAbiertas.domicilios && (
          <div className="p-3.5 sm:p-4 pt-0 space-y-3 border-t border-dark-700/60 animate-in fade-in duration-150">
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
        )}
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
    </form>

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
                  Prefijo Autorizado
                </label>
                <input
                  type="text"
                  className="input-field py-2 text-xs font-mono font-bold uppercase"
                  placeholder="Ej: POS"
                  maxLength={10}
                  value={modalResolucion.prefijo}
                  onChange={e => setModalResolucion({ ...modalResolucion, prefijo: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-dark-400 font-semibold mb-1">
                  Rango Desde *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  className="input-field py-2 text-xs font-mono font-bold"
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
                  required
                  min={1}
                  className="input-field py-2 text-xs font-mono font-bold"
                  value={modalResolucion.rango_hasta}
                  onChange={e => setModalResolucion({ ...modalResolucion, rango_hasta: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div>
                <label className="block text-dark-400 font-semibold mb-1">
                  Consecutivo Actual
                </label>
                <input
                  type="number"
                  min={0}
                  className="input-field py-2 text-xs font-mono font-bold text-amber-400"
                  placeholder="Último emitido"
                  value={modalResolucion.consecutivo_actual || ''}
                  onChange={e => setModalResolucion({ ...modalResolucion, consecutivo_actual: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Fechas de Vigencia */}
            <div className="p-3 bg-dark-900/60 rounded-xl border border-dark-700 space-y-3">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                Periodo de Vigencia de la Resolución
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-dark-400 font-semibold mb-1">
                    Fecha de Expedición *
                  </label>
                  <input
                    type="date"
                    required
                    className="input-field py-1.5 text-xs font-mono font-bold text-white"
                    value={modalResolucion.fecha_expedicion}
                    onChange={e => setModalResolucion({ ...modalResolucion, fecha_expedicion: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-dark-400 font-semibold mb-1">
                    Vigencia (Meses)
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[6, 12, 18, 24].map(meses => (
                      <button
                        key={meses}
                        type="button"
                        onClick={() => {
                          try {
                            const exp = new Date(modalResolucion.fecha_expedicion || new Date())
                            exp.setMonth(exp.getMonth() + meses)
                            const y = exp.getFullYear()
                            const m = String(exp.getMonth() + 1).padStart(2, '0')
                            const day = String(exp.getDate()).padStart(2, '0')
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
    </>
  )
}


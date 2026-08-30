import { useState, useCallback, useEffect, useRef } from 'react'
import { useVentaStore } from '../stores/ventaStore'
import { productosApi, clientesApi, facturasApi, bonosApi, configApi } from '../api/services'
import ModalTicketFactura from '../components/ticket/ModalTicketFactura'
import {
  Search, X, Plus, Minus, Trash2, ShoppingCart,
  User, CreditCard, Truck, Banknote, DollarSign, Package, Layers, Pill, FlaskConical, Tag,
  ChevronLeft, ChevronRight, AlertTriangle, Ticket, Printer, ArrowRight, Check
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCOP, redondearPrecio } from '../utils/pricing'

const FORMAS_PAGO = [
  { id: 'EFECTIVO',      label: 'Efectivo',      icon: Banknote },
  { id: 'TARJETA',       label: 'Tarjeta',        icon: CreditCard },
  { id: 'CREDITO',       label: 'Crédito',        icon: DollarSign },
  { id: 'CONTRAENTREGA', label: 'Contra entrega', icon: Truck },
]

export default function VentasPage() {
  const store = useVentaStore()
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [rubro, setRubro] = useState('FARMACIA')
  const [modoBusqueda, setModoBusqueda] = useState('NOMBRE')
  const [modoRedondeo, setModoRedondeo] = useState('CENTENA_100')
  const [empresaConfig, setEmpresaConfig] = useState(null)
  const inputBusquedaRef = useRef(null)

  // Modales
  const [modalFraccion, setModalFraccion] = useState(false)
  const [productoFraccion, setProductoFraccion] = useState(null)
  const [modalStock, setModalStock] = useState(null) // { producto, presentacion, stockInfo }
  const [facturaGenerada, setFacturaGenerada] = useState(null) // Comprobante emitido para previsualización e impresión
  const [modalCobroMovil, setModalCobroMovil] = useState(false) // Panel de cobro optimizado para móviles/tablets
  
  // Cliente y Bonos
  const [modalCliente, setModalCliente] = useState(false)
  const [busqCliente, setBusqCliente] = useState('')
  const [clientes, setClientes] = useState([])
  const [bonosCliente, setBonosCliente] = useState([])

  // Domicilios
  const [calculandoTarifa, setCalculandoTarifa] = useState(false)
  const [infoCalculoDomicilio, setInfoCalculoDomicilio] = useState(null)

  const handleCalcularTarifaDomicilio = async () => {
    const dir = store.domicilioDireccion?.trim()
    if (!dir) {
      toast.error('Ingresa la dirección de entrega del cliente para calcular la tarifa')
      return
    }
    setCalculandoTarifa(true)
    setInfoCalculoDomicilio(null)
    try {
      const res = await facturasApi.calcularDomicilio({
        direccion_destino: dir,
        ciudad_destino: empresaConfig?.ciudad || 'Colombia',
        subtotal_venta: store.getSubtotal()
      })
      if (res && res.tarifa_sugerida !== undefined) {
        store.setDomicilio(res.tarifa_sugerida)
        if (res.distancia_km !== undefined && res.distancia_km !== null) {
          store.setDomicilioDatos({ domicilioDistanciaKm: res.distancia_km })
        }
        setInfoCalculoDomicilio(res)
        toast.success(`🛵 ${res.mensaje}`)
      }
    } catch {
      toast.error('No se pudo calcular la ruta exacta. Puedes fijar la tarifa manualmente o elegir una zona.')
    } finally {
      setCalculandoTarifa(false)
    }
  }

  // Atajos de Teclado Globales (F2: Buscar, F4: Cobrar, Esc: Limpiar)
  useEffect(() => {
    const handleKeyDownGlobal = (e) => {
      if (e.key === 'F2') {
        e.preventDefault()
        inputBusquedaRef.current?.focus()
      } else if (e.key === 'F4' || e.key === 'F10') {
        e.preventDefault()
        if (store.lineas.length > 0) {
          if (window.innerWidth < 768) {
            setModalCobroMovil(true)
          } else {
            handleCobrar()
          }
        }
      } else if (e.key === 'Escape') {
        setResultados([])
      }
    }
    window.addEventListener('keydown', handleKeyDownGlobal)
    return () => window.removeEventListener('keydown', handleKeyDownGlobal)
  }, [store.lineas])

  // Cargar configuración de rubro y modo de redondeo
  useEffect(() => {
    configApi.get().then(cfg => {
      if (cfg) {
        setEmpresaConfig(cfg)
        if (cfg.rubro) setRubro(cfg.rubro)
        if (cfg.modo_redondeo) setModoRedondeo(cfg.modo_redondeo)
      }
    }).catch(() => {})
  }, [])

  // Cargar bonos cuando cambia el cliente seleccionado
  useEffect(() => {
    if (store.clienteId && store.clienteId !== 1) {
      bonosApi.porCliente(store.clienteId)
        .then(setBonosCliente)
        .catch(() => setBonosCliente([]))
    } else {
      setBonosCliente([])
    }
  }, [store.clienteId])

  const tienePresentacionHabilitada = (p, pres) => {
    if (!p) return false
    const uCaja = parseInt(p.contenido_caja) || 1
    const uBlister = parseInt(p.contenido_blister) || 0
    const pCaja = parseFloat(p.precio_caja || p.precio_venta || 0)
    const pBlister = p.precio_blister !== null && p.precio_blister !== undefined ? parseFloat(p.precio_blister) : null
    const pUnidad = p.precio_unidad !== null && p.precio_unidad !== undefined ? parseFloat(p.precio_unidad) : 0

    if (pres === 'CAJA' || pres === 'DIRECTO') {
      return pCaja > 0 || (pBlister === 0 && pUnidad <= 0)
    }

    if (pres === 'BLISTER') {
      if (uBlister <= 1 || uCaja <= uBlister) return false
      if (pBlister !== null && pBlister === 0) return false
      return true
    }

    if (pres === 'UNIDAD') {
      if (uCaja <= 1) return false
      // Si la droguería deja precio_unidad en 0 o vacío, NO se vende pastilla suelta
      if (pUnidad <= 0) return false
      return true
    }

    return true
  }

  const obtenerPrecioPresentacion = (p, pres) => {
    if (!p) return 0
    const modo = modoRedondeo || 'CENTENA_100'
    const pCaja = redondearPrecio(p.precio_caja || p.precio_venta || 0, modo)
    const uCaja = parseInt(p.contenido_caja) || 1
    const uBlister = parseInt(p.contenido_blister) || 0

    if (pres === 'CAJA' || pres === 'DIRECTO') {
      return pCaja
    } else if (pres === 'BLISTER') {
      const rawBlister = parseFloat(p.precio_blister || 0)
      if (rawBlister > 0) return redondearPrecio(rawBlister, modo)
      if (uCaja > uBlister && uBlister > 1) {
        return redondearPrecio((pCaja / (uCaja / uBlister)) * 1.12, modo)
      }
      return pCaja
    } else if (pres === 'UNIDAD') {
      const rawUnidad = parseFloat(p.precio_unidad || 0)
      if (rawUnidad > 0) return redondearPrecio(rawUnidad, modo)
      if (uCaja > 1) {
        return redondearPrecio((pCaja / uCaja) * 1.25, modo)
      }
      return pCaja
    }
    return pCaja
  }

  const procesarSeleccionProducto = (p, presentacionDirecta = null) => {
    if (p.maneja_fracciones && !presentacionDirecta) {
      const activas = []
      if (tienePresentacionHabilitada(p, 'CAJA')) activas.push('CAJA')
      if (tienePresentacionHabilitada(p, 'BLISTER')) activas.push('BLISTER')
      if (tienePresentacionHabilitada(p, 'UNIDAD')) activas.push('UNIDAD')

      if (activas.length === 1) {
        // Solo 1 presentación habilitada: seleccionar directamente
        procesarSeleccionProducto(p, activas[0])
        return
      }

      if (activas.length > 1) {
        setProductoFraccion(p)
        setModalFraccion(true)
        setResultados([])
        return
      }
    }

    const pres = presentacionDirecta || 'DIRECTO'
    const checkStock = store.validarStockDisponible(p, pres, 1)

    if (!checkStock.puedeVender) {
      setModalStock({
        producto: p,
        presentacion: pres,
        stockInfo: checkStock,
      })
      setResultados([])
    } else {
      const precioFinal = obtenerPrecioPresentacion(p, pres)
      store.agregarProducto(p, pres, precioFinal, 1, false)
      toast.success(`+1 ${pres !== 'DIRECTO' ? pres : ''} ${p.nombre}`, { duration: 1500 })
      setBusqueda('')
      setResultados([])
      setIndiceSeleccionado(0)
    }
  }

  const elegirPresentacion = (presentacion, forzarEncargo = false) => {
    if (!productoFraccion) return
    const p = productoFraccion
    const checkStock = store.validarStockDisponible(p, presentacion, 1)

    if (!checkStock.puedeVender && !forzarEncargo) {
      setModalStock({
        producto: p,
        presentacion: presentacion,
        stockInfo: checkStock,
      })
      setModalFraccion(false)
      return
    }

    const precioFinal = obtenerPrecioPresentacion(p, presentacion)
    store.agregarProducto(p, presentacion, precioFinal, 1, forzarEncargo)
    toast.success(`+1 ${presentacion} ${p.nombre}${forzarEncargo ? ' (Por Encargo)' : ''}`, { duration: 2000 })
    setModalFraccion(false)
    setProductoFraccion(null)
    setBusqueda('')
    setResultados([])
    setIndiceSeleccionado(0)
  }

  const handleIncrementarCantidad = (linea) => {
    if (linea.es_encargo) {
      store.actualizarCantidad(linea.key, linea.cantidad + 1)
      return
    }

    const pRef = linea.producto_ref || {
      id: linea.producto_id,
      nombre: linea.nombre_base,
      stock_actual: 9999,
      afecta_inventario: true,
      maneja_fracciones: linea.presentacion !== 'DIRECTO'
    }
    const checkStock = store.validarStockDisponible(pRef, linea.presentacion, 1)

    if (!checkStock.puedeVender) {
      toast.error(
        `Stock agotado en tienda (solo hay ${checkStock.stockRestante} unid). Cambia la línea a 'Pedido por Encargo' para vender más.`,
        { duration: 4000 }
      )
    } else {
      store.actualizarCantidad(linea.key, linea.cantidad + 1)
    }
  }

  // Búsqueda de productos con debounce y prioridad configurada
  const buscarProducto = useCallback(async (q, modo = modoBusqueda) => {
    const qClean = (q || '').trim()
    if (!qClean || qClean.length < 2) { setResultados([]); setIndiceSeleccionado(0); return }
    setBuscando(true)
    try {
      const res = await productosApi.buscar(qClean, { modo })
      if (res.length === 1 && modo !== 'SUSTANCIA') {
        const prod = res[0]
        let presDirecta = null
        if (prod.maneja_fracciones) {
          if (prod.codigo_barras_blister && prod.codigo_barras_blister === qClean) presDirecta = 'BLISTER'
          else if (prod.codigo_barras_unidad && prod.codigo_barras_unidad === qClean) presDirecta = 'UNIDAD'
          else if (prod.codigo_barras && prod.codigo_barras === qClean) presDirecta = 'CAJA'
        }
        procesarSeleccionProducto(prod, presDirecta)
      } else {
        setResultados(res || [])
        setIndiceSeleccionado(0)
      }
    } catch {
      toast.error('Error buscando productos')
    } finally {
      setBuscando(false)
    }
  }, [store, modoBusqueda])

  const handleKeyDownBusqueda = async (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (resultados.length > 0) {
        setIndiceSeleccionado(idx => Math.min(resultados.length - 1, idx + 1))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (resultados.length > 0) {
        setIndiceSeleccionado(idx => Math.max(0, idx - 1))
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setResultados([])
    } else if (e.key === 'Enter' && busqueda.trim()) {
      e.preventDefault()
      const cod = busqueda.trim()
      try {
        const res = await productosApi.porCodigo(cod)
        if (res && res.producto) {
          procesarSeleccionProducto(res.producto, res.presentacion_detectada)
          setBusqueda('')
          setResultados([])
          return
        }
      } catch {}
      if (resultados.length > 0 && resultados[indiceSeleccionado]) {
        procesarSeleccionProducto(resultados[indiceSeleccionado])
      }
    }
  }

  const handleBusquedaChange = (val) => {
    setBusqueda(val)
    clearTimeout(window._busqTimer)
    window._busqTimer = setTimeout(() => buscarProducto(val, modoBusqueda), 200)
  }

  const [vistaModalCliente, setVistaModalCliente] = useState('BUSCAR') // 'BUSCAR' | 'CREAR'
  const [formNuevoCliente, setFormNuevoCliente] = useState({
    tipo_doc: 'CC',
    nit: '',
    nombre: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    email: '',
  })
  const [guardandoCliente, setGuardandoCliente] = useState(false)

  const buscarClientes = async (q) => {
    setBusqCliente(q)
    try {
      const res = await clientesApi.listar(q)
      setClientes(res)
    } catch {}
  }

  const handleCrearClienteRapido = async (e) => {
    e.preventDefault()
    if (!formNuevoCliente.nombre.trim()) { toast.error('El nombre del cliente es obligatorio'); return }
    if (!formNuevoCliente.nit.trim()) { toast.error('El número de documento (Cédula/NIT) es obligatorio'); return }

    setGuardandoCliente(true)
    try {
      const nuevo = await clientesApi.crear(formNuevoCliente)
      toast.success(`Cliente "${nuevo.nombre}" creado y asignado`)
      store.setCliente(nuevo.id, nuevo.nombre, nuevo.direccion || '', nuevo.telefono || '')
      setModalCliente(false)
      setVistaModalCliente('BUSCAR')
      setFormNuevoCliente({ tipo_doc: 'CC', nit: '', nombre: '', telefono: '', direccion: '', ciudad: '', email: '' })
      buscarClientes('')
    } catch (err) {
      toast.error(err.message || 'Error creando cliente')
    } finally {
      setGuardandoCliente(false)
    }
  }

  const handleCobrar = async () => {
    if (store.lineas.length === 0) { toast.error('Agrega productos al carrito primero'); return }
    
    // Si no hay cliente seleccionado, asignar automáticamente Cliente Mostrador
    if (!store.clienteId) {
      store.setCliente(1, 'CLIENTE MOSTRADOR (CONSUMIDOR FINAL)')
    }

    if (store.formaPago === 'CREDITO' && (!store.clienteId || store.clienteId === 1)) {
      toast.error('Para ventas a crédito se requiere registrar o seleccionar un cliente con documento');
      setModalCliente(true);
      return
    }

    setCobrando(true)
    try {
      const res = await facturasApi.crear(store.buildPayload())
      toast.success(`✅ Factura ${res.numero} — Total: ${formatCOP(res.total)}`)
      if (res.cambio > 0) toast.success(`Cambio: ${formatCOP(res.cambio)}`, { duration: 6000 })
      setFacturaGenerada(res)
      store.limpiar()
    } catch (err) {
      toast.error(err.message || 'Error al procesar la venta')
    } finally {
      setCobrando(false)
    }
  }

  const subtotal = store.getSubtotal()
  const iva = store.getIvaTotal()
  const total = store.getTotal()
  const cambio = store.getCambio()

  const renderBloqueDomicilio = () => (
    <div className="bg-dark-900/70 rounded-xl border border-dark-700 p-3 space-y-2.5 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${store.esDomicilio ? 'bg-primary-600 text-white shadow-sm' : 'bg-dark-800 text-dark-400'}`}>
            <Truck size={15} />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">¿Lleva Domicilio?</span>
            <span className="text-[10px] text-dark-400">Recargo de transporte</span>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={store.esDomicilio}
            onChange={e => {
              const val = e.target.checked
              store.setEsDomicilio(val)
              if (val && store.clienteDireccion && !store.domicilioDireccion) {
                store.setDomicilioDatos({
                  domicilioDireccion: store.clienteDireccion,
                  domicilioTelefono: store.clienteTelefono
                })
              }
            }}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-dark-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
        </label>
      </div>

      {store.esDomicilio && (
        <div className="space-y-2.5 pt-2 border-t border-dark-700/60 animate-in fade-in slide-in-from-top-1 text-xs">
          {/* Dirección de entrega */}
          <div>
            <label className="block text-[11px] text-dark-400 font-semibold mb-1">
              Dirección de Entrega <span className="text-primary-400">*</span>
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                className="input-field py-1.5 px-2.5 text-xs flex-1"
                placeholder="Ej: Calle 45 # 12-34 (Apto 302)"
                value={store.domicilioDireccion || ''}
                onChange={e => store.setDomicilioDatos({ domicilioDireccion: e.target.value })}
              />
              <button
                type="button"
                onClick={handleCalcularTarifaDomicilio}
                disabled={calculandoTarifa || !store.domicilioDireccion?.trim()}
                className="btn-secondary py-1.5 px-2.5 text-[11px] flex items-center gap-1 font-bold whitespace-nowrap"
                title="Calcular distancia y costo automáticamente"
              >
                {calculandoTarifa ? '...' : '📍 Tarifa'}
              </button>
            </div>
          </div>

          {/* Teléfono & Valor */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-[10px] text-dark-400 font-semibold mb-0.5">Teléfono Reparto</label>
              <input
                type="text"
                className="input-field py-1 px-2 text-xs"
                placeholder="3101234567"
                value={store.domicilioTelefono || ''}
                onChange={e => store.setDomicilioDatos({ domicilioTelefono: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] text-dark-400 font-semibold mb-0.5">Tarifa Domicilio ($)</label>
              <input
                type="number"
                className="input-field py-1 px-2 text-xs font-mono font-bold text-white text-right"
                value={store.domicilioValor || ''}
                onChange={e => store.setDomicilio(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Indicaciones / Notas */}
          <div>
            <input
              type="text"
              className="input-field py-1 px-2 text-[11px]"
              placeholder="Indicaciones (ej: Timbre blanco, torre 2)"
              value={store.domicilioNotas || ''}
              onChange={e => store.setDomicilioDatos({ domicilioNotas: e.target.value })}
            />
          </div>

          {/* Presets de Zona */}
          <div className="flex items-center justify-between gap-1 pt-0.5">
            <span className="text-[10px] text-dark-500 font-semibold">Zonas:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => store.setDomicilio(empresaConfig?.domicilio_corta || 3000)}
                className="text-[10px] bg-dark-800 hover:bg-dark-700 text-dark-300 px-2 py-0.5 rounded border border-dark-700 font-mono"
              >
                Corta ${empresaConfig?.domicilio_corta || 3000}
              </button>
              <button
                type="button"
                onClick={() => store.setDomicilio(empresaConfig?.domicilio_media || 5000)}
                className="text-[10px] bg-dark-800 hover:bg-dark-700 text-dark-300 px-2 py-0.5 rounded border border-dark-700 font-mono"
              >
                Media ${empresaConfig?.domicilio_media || 5000}
              </button>
              <button
                type="button"
                onClick={() => store.setDomicilio(empresaConfig?.domicilio_larga || 8000)}
                className="text-[10px] bg-dark-800 hover:bg-dark-700 text-dark-300 px-2 py-0.5 rounded border border-dark-700 font-mono"
              >
                Larga ${empresaConfig?.domicilio_larga || 8000}
              </button>
            </div>
          </div>

          {/* Mensaje de cálculo */}
          {infoCalculoDomicilio && (
            <div className="bg-primary-950/40 border border-primary-800/50 p-1.5 rounded-lg text-[10px] text-primary-300 flex items-center gap-1.5">
              <span>🛵</span>
              <span className="leading-tight">{infoCalculoDomicilio.mensaje}</span>
            </div>
          )}

          {/* Guardar en cliente */}
          {store.clienteId && store.clienteId !== 1 && (
            <label className="flex items-center gap-1.5 text-[11px] text-dark-400 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={store.guardarDireccionCliente}
                onChange={e => store.setDomicilioDatos({ guardarDireccionCliente: e.target.checked })}
                className="rounded bg-dark-800 border-dark-700 text-primary-500 focus:ring-0"
              />
              <span>Guardar esta dirección en ficha del cliente</span>
            </label>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="h-full flex flex-col md:flex-row gap-0 overflow-hidden relative">

      {/* ── Panel izquierdo: búsqueda + carrito ───────────── */}
      <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-4 gap-2.5 overflow-hidden">

        {/* Selector de modo de búsqueda (solo en Farmacia) */}
        {rubro === 'FARMACIA' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-dark-500 font-bold uppercase tracking-wider">
              Búsqueda:
            </span>
            <button
              type="button"
              onClick={() => {
                setModoBusqueda('NOMBRE')
                if (busqueda) buscarProducto(busqueda, 'NOMBRE')
              }}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                modoBusqueda === 'NOMBRE'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-dark-700/60 text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <Tag size={12} />
              <span>Nombre Comercial</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModoBusqueda('SUSTANCIA')
                if (busqueda) buscarProducto(busqueda, 'SUSTANCIA')
              }}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                modoBusqueda === 'SUSTANCIA'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-dark-700/60 text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <FlaskConical size={12} />
              <span>Sustancia / Principio Activo</span>
            </button>
          </div>
        )}

        {/* Barra de búsqueda con Dropdown Flotante (No desplaza el carrito) */}
        <div className="relative z-30">
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400" />
            <input
              ref={inputBusquedaRef}
              className="input-field pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-dark-800 border-dark-600 focus:border-primary-500 rounded-xl shadow-inner font-medium w-full"
              value={busqueda}
              onChange={e => handleBusquedaChange(e.target.value)}
              onKeyDown={handleKeyDownBusqueda}
              placeholder={
                modoBusqueda === 'SUSTANCIA'
                  ? 'Buscar por sustancia (ej: Acetaminofen, Omeprazol)...'
                  : 'Escanear código de barras o escribir producto (F2)...'
              }
              autoFocus
            />
            {busqueda && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white p-1"
                onClick={() => { setBusqueda(''); setResultados([]); setIndiceSeleccionado(0) }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Backdrop invisible para cerrar al hacer clic afuera */}
          {resultados.length > 0 && (
            <div
              className="fixed inset-0 z-20"
              onClick={() => setResultados([])}
            />
          )}

          {/* Resultados de búsqueda Flotantes Elegantes */}
          {resultados.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-40 mt-1 bg-dark-900/98 backdrop-blur-xl border border-primary-500/40 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Cabecera minimalista */}
              <div className="bg-dark-950 px-3.5 py-1.5 border-b border-dark-700/80 flex justify-between items-center text-[11px]">
                <span className="text-dark-300 font-semibold flex items-center gap-1.5">
                  <span className="text-primary-400 font-bold">🎯 {resultados.length}</span>
                  <span>artículo(s) encontrado(s)</span>
                </span>
                <span className="text-dark-500 text-[10px] hidden sm:inline">Usa ↑ ↓ y Enter para agregar</span>
              </div>

              {/* Lista compacta de resultados */}
              <div className="divide-y divide-dark-800 max-h-60 sm:max-h-72 overflow-y-auto">
                {resultados.slice(0, 15).map((p, idx) => {
                  const seleccionado = idx === indiceSeleccionado
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => procesarSeleccionProducto(p)}
                      onMouseEnter={() => setIndiceSeleccionado(idx)}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-left transition-colors ${
                        seleccionado ? 'bg-primary-950/70 border-l-4 border-primary-500 text-white' : 'hover:bg-dark-800/80 text-dark-200'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <p className={`text-xs font-bold truncate ${seleccionado ? 'text-primary-300' : 'text-white'}`}>
                          {p.nombre}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-dark-400 truncate">
                          <span className="font-mono">{p.codigo}</span>
                          {p.principio_activo && (
                            <span className="text-blue-300 bg-blue-950/60 px-1 rounded truncate max-w-[140px]">
                              🧪 {p.principio_activo}
                            </span>
                          )}
                          {p.laboratorio && <span className="truncate">· {p.laboratorio}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-primary-400 font-black text-xs font-mono">
                          {formatCOP(redondearPrecio(p.precio_venta, modoRedondeo))}
                        </p>
                        <span className="text-[10px] text-dark-400 block">
                          {p.maneja_fracciones ? (
                            <span className="text-emerald-400 font-semibold">📦 Fraccionable</span>
                          ) : (
                            <span>Stock: <strong className="text-white font-mono">{p.stock_actual}</strong></span>
                          )}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Tabla de líneas en carrito (Diseño fluido y minimalista) */}
        <div className="flex-1 overflow-y-auto pb-24 md:pb-2">
          {store.lineas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-dark-500">
              <div className="w-14 h-14 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center mb-3">
                <ShoppingCart size={24} className="text-dark-500" />
              </div>
              <p className="text-sm font-bold text-white">Carrito de venta listo</p>
              <p className="text-xs text-dark-400 mt-1 max-w-xs text-center">
                Escribe en la barra superior o pasa el lector de código de barras para añadir productos.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {store.lineas.map(linea => (
                <div
                  key={linea.key}
                  className={`bg-dark-800/90 border rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 transition-all ${
                    linea.es_encargo ? 'border-amber-600/60 bg-amber-950/15' : 'border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-white font-bold text-xs sm:text-sm truncate max-w-md">{linea.nombre}</p>
                      {linea.presentacion && linea.presentacion !== 'DIRECTO' && (
                        <span className="bg-primary-950 text-primary-300 border border-primary-700/50 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">
                          {linea.presentacion}
                        </span>
                      )}
                      {linea.es_encargo && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-1">
                          <Package size={10} /> Encargo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-dark-400 text-[11px] mt-0.5">
                      <span className="font-mono">{formatCOP(linea.precio_unitario)} c/u</span>
                      <button
                        type="button"
                        onClick={() => store.marcarComoEncargo(linea.key, !linea.es_encargo)}
                        className="text-[10px] text-dark-400 hover:text-amber-300 underline"
                      >
                        {linea.es_encargo ? 'Normal' : 'Encargo'}
                      </button>
                    </div>
                  </div>

                  {/* Stepper de Cantidad */}
                  <div className="flex items-center gap-1.5 bg-dark-900/80 p-1 rounded-xl border border-dark-700 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => store.actualizarCantidad(linea.key, linea.cantidad - 1)}
                      className="w-7 h-7 bg-dark-800 hover:bg-dark-700 text-white rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="text-white font-bold text-xs w-6 text-center font-mono">{linea.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => handleIncrementarCantidad(linea)}
                      className="w-7 h-7 bg-dark-800 hover:bg-dark-700 text-white rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {/* Total de Línea */}
                  <div className="text-right flex-shrink-0 w-20 sm:w-24">
                    <p className="text-primary-400 font-bold text-xs sm:text-sm font-mono">
                      {formatCOP(linea.precio_unitario * linea.cantidad)}
                    </p>
                  </div>

                  {/* Botón Borrar */}
                  <button
                    type="button"
                    onClick={() => store.quitarLinea(linea.key)}
                    className="text-dark-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-dark-700/60 transition-colors flex-shrink-0"
                    title="Quitar producto"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Barra Flotante Móvil para Cobrar Rápido */}
        {store.lineas.length > 0 && (
          <div className="md:hidden fixed bottom-14 left-2 right-2 z-30 bg-dark-900/95 backdrop-blur-xl border border-primary-500/50 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2 animate-in slide-in-from-bottom-2">
            <div>
              <span className="text-[10px] text-dark-400 uppercase font-bold block">
                {store.lineas.length} producto(s)
              </span>
              <span className="text-base font-black text-white font-mono">
                {formatCOP(total)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setModalCobroMovil(true)}
              className="btn-primary py-2 px-4 text-xs font-bold shadow-lg flex items-center gap-1.5"
            >
              <span>Cobrar ⚡</span>
            </button>
          </div>
        )}

      </div>

      {/* ── Panel derecho Desktop: totales + cobro ────────── */}
      <div className="hidden md:flex md:w-80 lg:w-88 bg-dark-800/95 border-l border-dark-700 flex-col p-4 gap-3 flex-shrink-0 overflow-y-auto">

        {/* Cliente */}
        <div>
          <label className="block text-dark-400 text-xs font-semibold mb-1 uppercase tracking-wide">
            Cliente
          </label>
          <button
            type="button"
            onClick={() => setModalCliente(true)}
            className="flex items-center justify-between w-full px-3.5 py-2.5 bg-dark-700/70 border border-dark-600 rounded-xl hover:bg-dark-600 transition-colors text-left"
          >
            <div className="flex items-center gap-2 truncate min-w-0 pr-1">
              <User size={16} className="text-primary-400 flex-shrink-0" />
              <span className={`text-xs truncate ${store.clienteId ? 'text-white font-semibold' : 'text-dark-400'}`}>
                {store.clienteNombre || 'Cliente Mostrador'}
              </span>
            </div>
            <span className="text-[11px] text-primary-400 font-bold flex-shrink-0">Cambiar</span>
          </button>
        </div>

        {/* Alerta de Bonos Activos del Cliente */}
        {bonosCliente.length > 0 && !store.bonoCodigo && (
          <div className="bg-blue-950/60 border border-blue-700/60 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-blue-300 text-xs font-bold">
              <Ticket size={14} />
              <span>¡Cliente tiene {bonosCliente.length} Bono(s) activo(s)!</span>
            </div>
            {bonosCliente.map(b => (
              <div key={b.id} className="flex justify-between items-center bg-dark-900/80 p-1.5 rounded-lg text-xs">
                <div>
                  <span className="font-mono text-white font-bold text-xs">{b.codigo}</span>
                  <span className="text-green-400 font-bold block font-mono text-[11px]">{formatCOP(b.saldo_disponible)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => store.aplicarBono(b)}
                  className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                >
                  Aplicar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Módulo de Domicilio */}
        {renderBloqueDomicilio()}

        {/* Forma de pago */}
        <div>
          <p className="text-dark-400 text-xs font-semibold mb-1.5 uppercase tracking-wide">Forma de pago</p>
          <div className="grid grid-cols-2 gap-1.5">
            {FORMAS_PAGO.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => store.setFormaPago(id)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all
                  ${store.formaPago === id
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-dark-700/60 text-dark-400 hover:text-white hover:bg-dark-700'
                  }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Valor recibido (solo efectivo con Presets Rápidos) */}
        {store.formaPago === 'EFECTIVO' && (
          <div className="space-y-1.5 bg-dark-900/60 p-2.5 rounded-xl border border-dark-700/80">
            <label className="block text-dark-400 text-xs font-semibold uppercase tracking-wide">
              Efectivo Recibido ($)
            </label>
            <input
              type="number"
              className="input-field text-base font-bold text-white font-mono py-1 px-2.5 w-full"
              value={store.valorRecibido || ''}
              onChange={e => store.setValorRecibido(e.target.value)}
              placeholder="0"
              inputMode="numeric"
            />
            {/* Presets Rápidos de Billetes */}
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              <button
                type="button"
                onClick={() => store.setValorRecibido(total)}
                className="text-[10px] bg-dark-800 hover:bg-dark-700 text-primary-300 font-bold px-2 py-1 rounded-lg border border-dark-600 font-mono transition-colors"
              >
                Exacto
              </button>
              {[10000, 20000, 50000, 100000].filter(m => m >= total || total > 50000).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => store.setValorRecibido(m)}
                  className="text-[10px] bg-dark-800 hover:bg-dark-700 text-white font-bold px-2 py-1 rounded-lg border border-dark-600 font-mono transition-colors"
                >
                  +{formatCOP(m)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Totales */}
        <div className="space-y-1.5 py-2 border-t border-dark-700 text-xs">
          <div className="flex justify-between text-dark-400">
            <span>Subtotal:</span>
            <span className="font-mono font-medium text-dark-200">{formatCOP(subtotal)}</span>
          </div>
          {iva > 0 && (
            <div className="flex justify-between text-dark-400">
              <span>IVA:</span>
              <span className="font-mono font-medium text-dark-200">{formatCOP(iva)}</span>
            </div>
          )}
          {store.domicilioValor > 0 && (
            <div className="flex justify-between text-dark-400">
              <span>Domicilio:</span>
              <span className="font-mono font-medium text-dark-200">{formatCOP(store.domicilioValor)}</span>
            </div>
          )}

          {/* Bono aplicado */}
          {store.bonoCodigo && (
            <div className="flex justify-between items-center bg-blue-950/40 p-1.5 rounded-lg border border-blue-800/60 text-blue-300 text-xs">
              <div>
                <span className="font-bold flex items-center gap-1">🎟️ Bono {store.bonoCodigo}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold font-mono text-green-400">-{formatCOP(store.bonoMontoAplicado)}</span>
                <button
                  type="button"
                  onClick={() => store.quitarBono()}
                  className="text-red-400 hover:text-red-300 p-0.5"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between text-lg font-black text-white pt-2 border-t border-dark-700">
            <span>TOTAL:</span>
            <span className="text-primary-400 font-mono">{formatCOP(total)}</span>
          </div>

          {store.formaPago === 'EFECTIVO' && cambio > 0 && (
            <div className="flex justify-between text-sm text-green-400 bg-green-950/40 p-2 rounded-xl border border-green-800 font-mono font-bold">
              <span>Cambio:</span>
              <span>{formatCOP(cambio)}</span>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2 mt-auto pt-2">
          <button
            type="button"
            onClick={() => store.limpiar()}
            className="btn-secondary flex-1 py-2.5 text-xs font-bold"
            disabled={cobrando}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCobrar}
            className="btn-primary flex-1 py-2.5 font-bold text-sm shadow-lg hover:scale-102 transition-transform"
            disabled={cobrando || store.lineas.length === 0}
          >
            {cobrando ? 'Cobrando...' : '✓ Cobrar (F4)'}
          </button>
        </div>
      </div>

      {/* ── MODAL: STOCK INSUFICIENTE / DECISIÓN ENCARGO ─────────── */}
      {modalStock && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          onClick={() => setModalStock(null)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-md p-6 border border-amber-600/70 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={26} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Stock Insuficiente en Tienda</h3>
                <p className="text-xs text-amber-300/80">No hay existencias suficientes para entrega inmediata</p>
              </div>
            </div>

            <div className="bg-dark-900/80 rounded-xl p-3.5 border border-dark-700 text-xs space-y-1.5">
              <p className="text-white font-bold text-sm">{modalStock.producto.nombre}</p>
              <div className="flex justify-between text-dark-400">
                <span>Presentación solicitada:</span>
                <strong className="text-white">{modalStock.presentacion}</strong>
              </div>
              <div className="flex justify-between text-dark-400">
                <span>Stock físico disponible:</span>
                <strong className="text-amber-400 font-mono">{modalStock.stockInfo.stockRestante} unidades base</strong>
              </div>
              {modalStock.stockInfo.maxPresentacion > 0 && (
                <div className="flex justify-between text-dark-400">
                  <span>Equivalente en esta presentación:</span>
                  <strong className="text-green-400 font-mono">{modalStock.stockInfo.maxPresentacion} {modalStock.presentacion}(s)</strong>
                </div>
              )}
            </div>

            <p className="text-xs text-dark-400">
              ¿Deseas vender solo lo que hay disponible o facturarlo como <b>Pedido por Encargo</b> para que el cliente lo recoja/reciba después?
            </p>

            <div className="space-y-2 pt-2">
              {modalStock.stockInfo.maxPresentacion > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const precioFinal = obtenerPrecioPresentacion(modalStock.producto, modalStock.presentacion)
                    store.agregarProducto(modalStock.producto, modalStock.presentacion, precioFinal, 1, false)
                    setModalStock(null)
                    setBusqueda('')
                    setResultados([])
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-dark-700 hover:bg-dark-600 text-white font-semibold text-xs flex justify-between items-center transition-colors"
                >
                  <span>⚡ Vender disponibles en tienda</span>
                  <span className="font-mono text-green-400">({modalStock.stockInfo.maxPresentacion} {modalStock.presentacion})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const precioFinal = obtenerPrecioPresentacion(modalStock.producto, modalStock.presentacion)
                  store.agregarProducto(modalStock.producto, modalStock.presentacion, precioFinal, 1, true)
                  toast.success(`📦 Facturado como Pedido por Encargo: ${modalStock.producto.nombre}`, { duration: 2500 })
                  setModalStock(null)
                  setBusqueda('')
                  setResultados([])
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex justify-between items-center shadow-lg shadow-amber-900/30 transition-all"
              >
                <span>📦 Facturar como Pedido por Encargo</span>
                <span>Continuar ›</span>
              </button>

              <button
                type="button"
                onClick={() => setModalStock(null)}
                className="w-full py-2 text-dark-400 hover:text-white text-xs font-semibold text-center mt-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SELECCIONAR PRESENTACIÓN / FRACCIÓN ────────────── */}
      {modalFraccion && productoFraccion && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          onClick={() => setModalFraccion(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-md p-6 border border-dark-700 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-dark-700 pb-3">
              <div>
                <span className="text-xs font-semibold text-primary-400 uppercase tracking-wide">
                  Seleccionar Presentación
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {productoFraccion.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalFraccion(false)}
                className="text-dark-500 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-dark-400 text-xs">
              ¿Cómo desea despachar este producto al cliente?
            </p>

            <div className="space-y-2">
              {/* Opción Caja Completa */}
              {tienePresentacionHabilitada(productoFraccion, 'CAJA') && (
                <button
                  type="button"
                  onClick={() => elegirPresentacion('CAJA')}
                  className="w-full flex items-center justify-between p-3.5 bg-dark-700/80 hover:bg-primary-900/30 hover:border-primary-500 border border-dark-600 rounded-xl text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-600/20 text-primary-400 rounded-xl flex items-center justify-center">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Caja Completa</p>
                      <p className="text-dark-400 text-xs">
                        Contiene {productoFraccion.contenido_caja} unidades
                      </p>
                    </div>
                  </div>
                  <span className="text-primary-400 font-bold text-base font-mono">
                    {formatCOP(obtenerPrecioPresentacion(productoFraccion, 'CAJA'))}
                  </span>
                </button>
              )}

              {/* Opción Blister */}
              {tienePresentacionHabilitada(productoFraccion, 'BLISTER') && (
                <button
                  type="button"
                  onClick={() => elegirPresentacion('BLISTER')}
                  className="w-full flex items-center justify-between p-3.5 bg-dark-700/80 hover:bg-blue-900/30 hover:border-blue-500 border border-dark-600 rounded-xl text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center">
                      <Layers size={20} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Blister / Paquete</p>
                      <p className="text-dark-400 text-xs">
                        Contiene {productoFraccion.contenido_blister} unidades por blíster
                      </p>
                    </div>
                  </div>
                  <span className="text-blue-400 font-bold text-base font-mono">
                    {formatCOP(obtenerPrecioPresentacion(productoFraccion, 'BLISTER'))}
                  </span>
                </button>
              )}

              {/* Opción Unidad / Pastilla Suelta (Solo si tiene precio_unidad > 0) */}
              {tienePresentacionHabilitada(productoFraccion, 'UNIDAD') && (
                <button
                  type="button"
                  onClick={() => elegirPresentacion('UNIDAD')}
                  className="w-full flex items-center justify-between p-3.5 bg-dark-700/80 hover:bg-green-900/30 hover:border-green-500 border border-dark-600 rounded-xl text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600/20 text-green-400 rounded-xl flex items-center justify-center">
                      <Pill size={20} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Unidad Suelta</p>
                      <p className="text-dark-400 text-xs">1 unidad / pastilla individual</p>
                    </div>
                  </div>
                  <span className="text-green-400 font-bold text-base font-mono">
                    {formatCOP(obtenerPrecioPresentacion(productoFraccion, 'UNIDAD'))}
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setModalFraccion(false)}
              className="btn-secondary w-full py-2.5 text-xs mt-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: SELECTOR Y CREADOR DE CLIENTE ─────────────────── */}
      {modalCliente && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setModalCliente(false)}
        >
          <div
            className="bg-dark-800 rounded-3xl md:rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-dark-700 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-4 border-b border-dark-700 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <User size={18} className="text-primary-400" />
                  Cliente de la Venta
                </h3>
                <p className="text-dark-500 text-xs mt-0.5">
                  Selecciona cliente mostrador o ingresa datos para factura legal y domicilio
                </p>
              </div>
              <button
                onClick={() => setModalCliente(false)}
                className="text-dark-500 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Acceso Rápido: CLIENTE MOSTRADOR */}
            <div className="p-4 bg-dark-900/60 border-b border-dark-700">
              <button
                onClick={() => {
                  store.setCliente(1, 'CLIENTE MOSTRADOR (CONSUMIDOR FINAL)', '', '')
                  setModalCliente(false)
                }}
                className="w-full flex items-center justify-between p-3 bg-primary-950/40 hover:bg-primary-900/50 border border-primary-600/50 hover:border-primary-500 rounded-xl transition-all"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <span className="text-xl">⚡</span>
                  <div>
                    <p className="text-white font-bold text-sm">CLIENTE MOSTRADOR</p>
                    <p className="text-primary-300 text-xs">Consumidor Final (Sin datos personales)</p>
                  </div>
                </div>
                <span className="text-xs bg-primary-600 text-white font-bold px-2.5 py-1 rounded-lg">
                  Seleccionar
                </span>
              </button>
            </div>

            {/* Pestañas de Buscar / Crear */}
            <div className="flex border-b border-dark-700 bg-dark-900/30">
              <button
                type="button"
                onClick={() => setVistaModalCliente('BUSCAR')}
                className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${
                  vistaModalCliente === 'BUSCAR'
                    ? 'border-primary-500 text-primary-400 bg-dark-700/50'
                    : 'border-transparent text-dark-400 hover:text-white'
                }`}
              >
                🔍 Buscar Registrado
              </button>
              <button
                type="button"
                onClick={() => setVistaModalCliente('CREAR')}
                className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${
                  vistaModalCliente === 'CREAR'
                    ? 'border-primary-500 text-primary-400 bg-dark-700/50'
                    : 'border-transparent text-dark-400 hover:text-white'
                }`}
              >
                ➕ Crear Nuevo Cliente
              </button>
            </div>

            {/* Contenido de la pestaña */}
            <div className="overflow-y-auto flex-1 p-4">
              {vistaModalCliente === 'BUSCAR' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                    <input
                      className="input-field pl-9"
                      placeholder="Buscar por Nombre, Cédula / NIT o Teléfono..."
                      value={busqCliente}
                      onChange={e => buscarClientes(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="divide-y divide-dark-700 max-h-60 overflow-y-auto">
                    {clientes.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          store.setCliente(c.id, c.nombre, c.direccion || '', c.telefono || '')
                          setModalCliente(false)
                        }}
                        className="w-full flex items-center justify-between p-3 hover:bg-dark-700 text-left transition-colors rounded-lg"
                      >
                        <div>
                          <p className="text-white text-sm font-semibold">{c.nombre}</p>
                          <p className="text-dark-500 text-xs">
                            {c.tipo_doc || 'CC'}: <span className="font-mono text-dark-400">{c.nit || '—'}</span>
                            {c.telefono && ` · 📞 ${c.telefono}`}
                          </p>
                          {c.direccion && (
                            <p className="text-dark-500 text-[11px] truncate max-w-xs">
                              📍 {c.direccion}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-primary-400 font-bold ml-2">Elegir</span>
                      </button>
                    ))}
                    {busqCliente && clientes.length === 0 && (
                      <div className="text-center py-6 space-y-2">
                        <p className="text-dark-500 text-xs">No se encontró ningún cliente con ese dato.</p>
                        <button
                          onClick={() => {
                            setFormNuevoCliente(f => ({ ...f, nombre: busqCliente }))
                            setVistaModalCliente('CREAR')
                          }}
                          className="btn-secondary text-xs py-1.5 px-3"
                        >
                          + Registrar como nuevo cliente
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* FORMULARIO: CREAR NUEVO CLIENTE LEGAL + DOMICILIO */
                <form onSubmit={handleCrearClienteRapido} className="space-y-4">
                  {/* 1. Datos Legales Obligatorios */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-bold text-primary-400 uppercase tracking-wider block">
                      1. Datos Legales de Facturación
                    </span>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] text-dark-500 mb-1">Tipo Doc *</label>
                        <select
                          className="input-field py-1.5 text-xs font-medium"
                          value={formNuevoCliente.tipo_doc}
                          onChange={e => setFormNuevoCliente({ ...formNuevoCliente, tipo_doc: e.target.value })}
                        >
                          <option value="CC">Cédula (CC)</option>
                          <option value="NIT">NIT (Empresa)</option>
                          <option value="CE">Cédula Extranjería (CE)</option>
                          <option value="TI">Tarjeta Identidad (TI)</option>
                          <option value="PAS">Pasaporte</option>
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[11px] text-dark-500 mb-1">Número de Documento / NIT *</label>
                        <input
                          className="input-field py-1.5 text-xs font-mono"
                          placeholder="Ej: 1020304050"
                          value={formNuevoCliente.nit}
                          onChange={e => setFormNuevoCliente({ ...formNuevoCliente, nit: e.target.value })}
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-dark-500 mb-1">Nombre Completo o Razón Social *</label>
                      <input
                        className="input-field py-1.5 text-xs font-medium"
                        placeholder="Ej: Carlos Mario Restrepo o Distribuidora El Sol SAS"
                        value={formNuevoCliente.nombre}
                        onChange={e => setFormNuevoCliente({ ...formNuevoCliente, nombre: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* 2. Datos de Contacto y Despacho */}
                  <div className="space-y-2.5 pt-2 border-t border-dark-700">
                    <span className="text-xs font-bold text-primary-400 uppercase tracking-wider block">
                      2. Datos de Contacto y Domicilio (Opcionales)
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-dark-500 mb-1">Celular / WhatsApp</label>
                        <input
                          type="tel"
                          className="input-field py-1.5 text-xs"
                          placeholder="3101234567"
                          value={formNuevoCliente.telefono}
                          onChange={e => setFormNuevoCliente({ ...formNuevoCliente, telefono: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-dark-500 mb-1">Ciudad / Municipio</label>
                        <input
                          className="input-field py-1.5 text-xs"
                          placeholder="Ej: Medellín"
                          value={formNuevoCliente.ciudad}
                          onChange={e => setFormNuevoCliente({ ...formNuevoCliente, ciudad: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-dark-500 mb-1">Dirección de Entrega / Domicilio</label>
                      <input
                        className="input-field py-1.5 text-xs"
                        placeholder="Cra 45 # 23-10 Apto 302, Barrio El Poblado"
                        value={formNuevoCliente.direccion}
                        onChange={e => setFormNuevoCliente({ ...formNuevoCliente, direccion: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-dark-500 mb-1">Correo Electrónico (Factura Digital)</label>
                      <input
                        type="email"
                        className="input-field py-1.5 text-xs"
                        placeholder="cliente@ejemplo.com"
                        value={formNuevoCliente.email}
                        onChange={e => setFormNuevoCliente({ ...formNuevoCliente, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setVistaModalCliente('BUSCAR')}
                      className="btn-secondary flex-1 py-2 text-xs"
                    >
                      Volver
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoCliente}
                      className="btn-primary flex-1 py-2 text-xs font-bold"
                    >
                      {guardandoCliente ? 'Guardando...' : '✓ Guardar y Asignar'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Panel / Modal de Cobro Móvil Slide-Up (Z-Index alto para sobreponer bottom nav) ── */}
      {modalCobroMovil && (
        <div
          className="md:hidden fixed inset-0 bg-black/85 backdrop-blur-md z-[70] flex items-end justify-center animate-in fade-in"
          onClick={() => setModalCobroMovil(false)}
        >
          <div
            className="bg-dark-900 border-t border-dark-600 rounded-t-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header móvil fijo */}
            <div className="p-3.5 border-b border-dark-700/80 flex items-center justify-between bg-dark-950/90 flex-shrink-0">
              <div>
                <span className="text-[10px] text-dark-400 font-bold uppercase tracking-wider block">Resumen de Venta</span>
                <span className="text-xl font-black text-white font-mono">{formatCOP(total)}</span>
              </div>
              <button
                type="button"
                onClick={() => setModalCobroMovil(false)}
                className="w-8 h-8 rounded-full bg-dark-800 text-dark-300 hover:text-white flex items-center justify-center border border-dark-700 active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido desplazable */}
            <div className="p-3.5 space-y-3 overflow-y-auto flex-1 overscroll-contain">
              {/* Cliente */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-dark-400 font-bold uppercase">Cliente</span>
                  <button
                    type="button"
                    onClick={() => { setModalCobroMovil(false); setModalCliente(true) }}
                    className="text-xs text-primary-400 font-bold hover:underline"
                  >
                    Cambiar
                  </button>
                </div>
                <div className="bg-dark-800/80 p-2.5 rounded-xl border border-dark-700 flex items-center gap-2">
                  <User size={16} className="text-primary-400 flex-shrink-0" />
                  <span className="text-xs text-white font-semibold truncate">{store.clienteNombre || 'CLIENTE MOSTRADOR'}</span>
                </div>
              </div>

              {/* Domicilio Móvil */}
              {renderBloqueDomicilio()}

              {/* Forma de Pago */}
              <div>
                <span className="text-xs text-dark-400 font-bold uppercase block mb-1">Forma de pago</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {FORMAS_PAGO.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => store.setFormaPago(id)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        store.formaPago === id
                          ? 'bg-primary-600 text-white shadow-md'
                          : 'bg-dark-800/80 text-dark-400 border border-dark-700'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Efectivo Recibido y Cambio */}
              {store.formaPago === 'EFECTIVO' && (
                <div className="space-y-2 bg-dark-950/80 p-3 rounded-2xl border border-dark-700">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-dark-300 font-bold">Efectivo Recibido ($):</label>
                    {cambio > 0 && (
                      <span className="text-xs font-black text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-800/60">
                        Cambio: {formatCOP(cambio)}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    className="input-field text-xl font-black font-mono py-2 text-white text-center bg-dark-900 border-dark-600 rounded-xl w-full"
                    value={store.valorRecibido || ''}
                    onChange={e => store.setValorRecibido(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                  {/* Presets de billetes rápidos */}
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => store.setValorRecibido(total)}
                      className="text-xs bg-dark-800 hover:bg-dark-700 text-primary-300 font-bold py-2 rounded-xl border border-dark-600 font-mono"
                    >
                      Exacto
                    </button>
                    {[10000, 20000, 50000, 100000].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => store.setValorRecibido(m)}
                        className="text-xs bg-dark-800 hover:bg-dark-700 text-white font-bold py-2 rounded-xl border border-dark-600 font-mono"
                      >
                        +{formatCOP(m)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer FIJO con botón Registrar Venta (Nunca queda oculto) */}
            <div className="p-3.5 bg-dark-950 border-t border-dark-700/80 flex-shrink-0 pb-7">
              <button
                type="button"
                onClick={async () => {
                  setModalCobroMovil(false)
                  await handleCobrar()
                }}
                disabled={cobrando}
                className="btn-primary w-full py-3.5 text-sm font-black shadow-2xl flex items-center justify-center gap-2 rounded-2xl active:scale-98 transition-transform"
              >
                <span>{cobrando ? 'Procesando Venta...' : `✓ Registrar y Cobrar (${formatCOP(total)})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Previsualización, Impresión y Envío de Factura / Ticket POS ── */}
      {facturaGenerada && (
        <ModalTicketFactura
          factura={facturaGenerada}
          onCerrar={() => setFacturaGenerada(null)}
        />
      )}

    </div>
  )
}

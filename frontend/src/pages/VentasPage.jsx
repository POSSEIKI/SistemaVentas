import { useState, useCallback, useEffect } from 'react'
import { useVentaStore } from '../stores/ventaStore'
import { productosApi, clientesApi, facturasApi, configApi } from '../api/services'
import {
  Search, X, Plus, Minus, Trash2, ShoppingCart,
  User, CreditCard, Truck, Banknote, DollarSign, Package, Layers, Pill, FlaskConical, Tag,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'

const FORMAS_PAGO = [
  { id: 'EFECTIVO',      label: 'Efectivo',      icon: Banknote },
  { id: 'TARJETA',       label: 'Tarjeta',        icon: CreditCard },
  { id: 'CREDITO',       label: 'Crédito',        icon: DollarSign },
  { id: 'CONTRAENTREGA', label: 'Contra entrega', icon: Truck },
]

function formatCOP(num) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(num || 0)
}

const LIMITE_BUSQUEDA = 6

export default function VentasPage() {
  const store = useVentaStore()
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [pagBusqueda, setPagBusqueda] = useState(1)
  const [buscando, setBuscando] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [rubro, setRubro] = useState('FARMACIA')
  const [modoBusqueda, setModoBusqueda] = useState('NOMBRE')

  // Cargar configuración de rubro
  useEffect(() => {
    configApi.get().then(cfg => {
      if (cfg && cfg.rubro) setRubro(cfg.rubro)
    }).catch(() => {})
  }, [])

  // Selector de fracción / presentación
  const [modalFraccion, setModalFraccion] = useState(false)
  const [productoFraccion, setProductoFraccion] = useState(null)

  // Cliente modal
  const [modalCliente, setModalCliente] = useState(false)
  const [busqCliente, setBusqCliente] = useState('')
  const [clientes, setClientes] = useState([])

  const procesarSeleccionProducto = (p) => {
    if (p.maneja_fracciones) {
      setProductoFraccion(p)
      setModalFraccion(true)
    } else {
      store.agregarProducto(p)
      setBusqueda('')
      setResultados([])
      setPagBusqueda(1)
    }
  }

  const elegirPresentacion = (presentacion) => {
    if (!productoFraccion) return
    store.agregarProducto(productoFraccion, presentacion)
    setModalFraccion(false)
    setProductoFraccion(null)
    setBusqueda('')
    setResultados([])
    setPagBusqueda(1)
  }

  // Búsqueda de productos con debounce y prioridad configurada
  const buscarProducto = useCallback(async (q, modo = modoBusqueda) => {
    if (!q.trim() || q.length < 2) { setResultados([]); setPagBusqueda(1); return }
    setBuscando(true)
    try {
      const res = await productosApi.buscar(q, { modo })
      if (res.length === 1 && modo !== 'SUSTANCIA') {
        procesarSeleccionProducto(res[0])
      } else {
        setResultados(res)
        setPagBusqueda(1)
      }
    } catch {
      toast.error('Error buscando productos')
    } finally {
      setBuscando(false)
    }
  }, [store, modoBusqueda])

  const handleBusquedaChange = (val) => {
    setBusqueda(val)
    clearTimeout(window._busqTimer)
    window._busqTimer = setTimeout(() => buscarProducto(val, modoBusqueda), 250)
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
      store.setCliente(nuevo.id, nuevo.nombre)
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

  return (
    <div className="h-full flex flex-col md:flex-row gap-0">

      {/* ── Panel izquierdo: búsqueda + carrito ───────────── */}
      <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">

        {/* Selector de modo de búsqueda (solo en Farmacia) */}
        {rubro === 'FARMACIA' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-dark-500 font-semibold uppercase tracking-wider">
              Búsqueda:
            </span>
            <button
              type="button"
              onClick={() => {
                setModoBusqueda('NOMBRE')
                if (busqueda) buscarProducto(busqueda, 'NOMBRE')
              }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-medium transition-all ${
                modoBusqueda === 'NOMBRE'
                  ? 'bg-primary-600 text-white font-bold shadow-md'
                  : 'bg-dark-700 text-dark-400 hover:text-white hover:bg-dark-600'
              }`}
            >
              <Tag size={13} />
              <span>Nombre Comercial</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModoBusqueda('SUSTANCIA')
                if (busqueda) buscarProducto(busqueda, 'SUSTANCIA')
              }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-medium transition-all ${
                modoBusqueda === 'SUSTANCIA'
                  ? 'bg-blue-600 text-white font-bold shadow-md'
                  : 'bg-dark-700 text-dark-400 hover:text-white hover:bg-dark-600'
              }`}
            >
              <FlaskConical size={13} />
              <span>Sustancia / Principio Activo</span>
            </button>
          </div>
        )}

        {/* Barra de búsqueda */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            className="input-field pl-10 pr-10"
            value={busqueda}
            onChange={e => handleBusquedaChange(e.target.value)}
            placeholder={
              modoBusqueda === 'SUSTANCIA'
                ? 'Escribe la sustancia o genérico (ej: Acetaminofen, Amoxicilina, Omeprazol)...'
                : 'Escanear código de barras o escribir nombre comercial...'
            }
            autoFocus
          />
          {busqueda && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white"
              onClick={() => { setBusqueda(''); setResultados([]) }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Resultados de búsqueda con paginación */}
        {resultados.length > 0 && (
          <div className="card p-0 overflow-hidden shadow-2xl border border-dark-600 bg-dark-800 animate-in fade-in duration-150">
            {/* Cabecera del desplegable */}
            <div className="bg-dark-900/90 px-3.5 py-2 border-b border-dark-700 flex justify-between items-center text-xs">
              <span className="text-dark-300 font-medium flex items-center gap-1.5">
                <span>🎯 Encontrados:</span>
                <strong className="text-primary-400 font-bold font-mono">{resultados.length}</strong>
                <span>artículos</span>
              </span>
              {resultados.length > LIMITE_BUSQUEDA && (
                <span className="text-dark-400 font-mono text-[11px] bg-dark-800 px-2 py-0.5 rounded border border-dark-700">
                  Página <strong className="text-white">{pagBusqueda}</strong> de <strong className="text-white">{Math.ceil(resultados.length / LIMITE_BUSQUEDA)}</strong>
                </span>
              )}
            </div>

            {/* Lista paginada */}
            <div className="divide-y divide-dark-700/60 max-h-72 overflow-y-auto">
              {resultados
                .slice((pagBusqueda - 1) * LIMITE_BUSQUEDA, pagBusqueda * LIMITE_BUSQUEDA)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => procesarSeleccionProducto(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5
                               hover:bg-dark-700/80 text-left transition-colors group"
                  >
                    <div className="space-y-0.5 min-w-0 pr-3">
                      <p className="text-white font-semibold text-sm group-hover:text-primary-300 transition-colors truncate">
                        {p.nombre}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-dark-400 font-mono text-[11px] bg-dark-900/60 px-1.5 py-0.5 rounded border border-dark-700">
                          {p.codigo}
                        </span>
                        {p.principio_activo && (
                          <span className="bg-blue-950/70 text-blue-300 border border-blue-800/60 px-1.5 py-0.2 rounded text-[10px] truncate max-w-xs">
                            🧪 {p.principio_activo}
                          </span>
                        )}
                        {p.laboratorio && (
                          <span className="text-dark-400 text-[11px] truncate">· {p.laboratorio}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-primary-400 font-bold text-sm font-mono">{formatCOP(p.precio_venta)}</p>
                      <p className="text-dark-400 text-xs">
                        {p.maneja_fracciones ? (
                          <span className="text-primary-300 font-medium">📦 Fraccionable</span>
                        ) : (
                          <span>Stock: <strong className="text-white font-mono">{p.stock_actual}</strong></span>
                        )}
                      </p>
                    </div>
                  </button>
                ))}
            </div>

            {/* Paginador mini para el dropdown de ventas */}
            {resultados.length > LIMITE_BUSQUEDA && (
              <div className="bg-dark-900/90 px-3 py-2 border-t border-dark-700 flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPagBusqueda(p => Math.max(1, p - 1)) }}
                  disabled={pagBusqueda === 1}
                  className="px-2.5 py-1 rounded bg-dark-800 border border-dark-700 text-dark-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs flex items-center gap-1 font-medium hover:border-dark-600 transition-colors"
                >
                  <ChevronLeft size={13} /> Anterior
                </button>

                <span className="text-dark-400 text-[11px]">
                  Mostrando <strong className="text-white font-mono">{((pagBusqueda - 1) * LIMITE_BUSQUEDA) + 1} - {Math.min(pagBusqueda * LIMITE_BUSQUEDA, resultados.length)}</strong> de <strong className="text-white font-mono">{resultados.length}</strong>
                </span>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPagBusqueda(p => Math.min(Math.ceil(resultados.length / LIMITE_BUSQUEDA), p + 1)) }}
                  disabled={pagBusqueda >= Math.ceil(resultados.length / LIMITE_BUSQUEDA)}
                  className="px-2.5 py-1 rounded bg-dark-800 border border-dark-700 text-dark-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs flex items-center gap-1 font-medium hover:border-dark-600 transition-colors"
                >
                  Siguiente <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tabla de líneas en carrito */}
        <div className="flex-1 overflow-auto">
          {store.lineas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-dark-600">
              <ShoppingCart size={48} className="mb-2 opacity-50" />
              <p className="text-sm font-medium">El carrito de venta está vacío</p>
              <p className="text-xs text-dark-500 mt-1">Busca productos arriba o escanea código de barras</p>
            </div>
          ) : (
            <div className="space-y-2">
              {store.lineas.map(linea => (
                <div
                  key={linea.key}
                  className="card flex items-center gap-3 hover:border-dark-600 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{linea.nombre}</p>
                    <p className="text-dark-500 text-xs">
                      {formatCOP(linea.precio_unitario)} c/u
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => store.actualizarCantidad(linea.key, linea.cantidad - 1)}
                      className="w-8 h-8 bg-dark-700 rounded-lg flex items-center justify-center text-white hover:bg-dark-600 active:scale-95"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-white font-bold w-8 text-center">{linea.cantidad}</span>
                    <button
                      onClick={() => store.actualizarCantidad(linea.key, linea.cantidad + 1)}
                      className="w-8 h-8 bg-dark-700 rounded-lg flex items-center justify-center text-white hover:bg-dark-600 active:scale-95"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <p className="text-primary-400 font-bold w-24 text-right text-sm">
                    {formatCOP(linea.precio_unitario * linea.cantidad)}
                  </p>

                  <button
                    onClick={() => store.quitarLinea(linea.key)}
                    className="text-dark-600 hover:text-red-400 p-1.5 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel derecho: totales + cobro ─────────────────── */}
      <div className="md:w-84 bg-dark-800 border-t md:border-t-0 md:border-l border-dark-700
                      flex flex-col p-4 gap-4 flex-shrink-0">

        {/* Cliente */}
        <div>
          <label className="block text-dark-500 text-xs font-medium mb-1 uppercase tracking-wide">
            Cliente
          </label>
          <button
            onClick={() => setModalCliente(true)}
            className="flex items-center justify-between w-full px-4 py-3 bg-dark-700 rounded-xl
                       hover:bg-dark-600 transition-colors text-left"
          >
            <div className="flex items-center gap-2 truncate">
              <User size={18} className="text-dark-500 flex-shrink-0" />
              <span className={`text-sm ${store.clienteId ? 'text-white font-medium' : 'text-dark-500'}`}>
                {store.clienteNombre || 'Seleccionar cliente...'}
              </span>
            </div>
            <span className="text-xs text-primary-400 font-medium">Cambiar</span>
          </button>
        </div>

        {/* Forma de pago */}
        <div>
          <p className="text-dark-500 text-xs font-medium mb-2 uppercase tracking-wide">Forma de pago</p>
          <div className="grid grid-cols-2 gap-2">
            {FORMAS_PAGO.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => store.setFormaPago(id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${store.formaPago === id
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-dark-700 text-dark-500 hover:text-white hover:bg-dark-600'
                  }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Valor recibido (solo efectivo) */}
        {store.formaPago === 'EFECTIVO' && (
          <div>
            <label className="block text-dark-500 text-xs font-medium mb-1 uppercase tracking-wide">
              Efectivo Recibido ($)
            </label>
            <input
              type="number"
              className="input-field text-lg font-bold text-white"
              value={store.valorRecibido || ''}
              onChange={e => store.setValorRecibido(e.target.value)}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
        )}

        {/* Totales */}
        <div className="space-y-2 py-3 border-t border-dark-700">
          <div className="flex justify-between text-sm text-dark-500">
            <span>Subtotal</span>
            <span>{formatCOP(subtotal)}</span>
          </div>
          {iva > 0 && (
            <div className="flex justify-between text-sm text-dark-500">
              <span>IVA</span>
              <span>{formatCOP(iva)}</span>
            </div>
          )}
          {store.domicilioValor > 0 && (
            <div className="flex justify-between text-sm text-dark-500">
              <span>Domicilio</span>
              <span>{formatCOP(store.domicilioValor)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-dark-700">
            <span>TOTAL</span>
            <span className="text-primary-400">{formatCOP(total)}</span>
          </div>
          {store.formaPago === 'EFECTIVO' && cambio > 0 && (
            <div className="flex justify-between text-base text-green-400 bg-green-950/40 p-2.5 rounded-xl border border-green-800">
              <span>Cambio a devolver:</span>
              <span className="font-bold">{formatCOP(cambio)}</span>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-3 mt-auto">
          <button
            onClick={() => store.limpiar()}
            className="btn-secondary flex-1 py-3"
            disabled={cobrando}
          >
            Cancelar
          </button>
          <button
            onClick={handleCobrar}
            className="btn-primary flex-1 py-3 font-bold text-base"
            disabled={cobrando || store.lineas.length === 0}
          >
            {cobrando ? 'Procesando...' : '✓ Cobrar (F10)'}
          </button>
        </div>
      </div>

      {/* ── MODAL: SELECCIONAR PRESENTACIÓN / FRACCIÓN ────────────── */}
      {modalFraccion && productoFraccion && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
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
              <button
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
                <span className="text-primary-400 font-bold text-base">
                  {formatCOP(productoFraccion.precio_caja || productoFraccion.precio_venta)}
                </span>
              </button>

              {/* Opción Blister (si existe) */}
              {productoFraccion.contenido_blister > 0 && (
                <button
                  onClick={() => elegirPresentacion('BLISTER')}
                  className="w-full flex items-center justify-between p-3.5 bg-dark-700/80 hover:bg-primary-900/30 hover:border-primary-500 border border-dark-600 rounded-xl text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center">
                      <Layers size={20} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Blister / Paquete</p>
                      <p className="text-dark-400 text-xs">
                        Contiene {Math.floor(productoFraccion.contenido_caja / productoFraccion.contenido_blister)} unidades
                      </p>
                    </div>
                  </div>
                  <span className="text-primary-400 font-bold text-base">
                    {formatCOP(productoFraccion.precio_blister)}
                  </span>
                </button>
              )}

              {/* Opción Unidad / Pastilla Suelta */}
              {(productoFraccion.precio_unidad > 0 || productoFraccion.contenido_caja > 1) && (
                <button
                  onClick={() => elegirPresentacion('UNIDAD')}
                  className="w-full flex items-center justify-between p-3.5 bg-dark-700/80 hover:bg-primary-900/30 hover:border-primary-500 border border-dark-600 rounded-xl text-left transition-all"
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
                  <span className="text-primary-400 font-bold text-base">
                    {formatCOP(productoFraccion.precio_unidad || (productoFraccion.precio_venta / productoFraccion.contenido_caja))}
                  </span>
                </button>
              )}
            </div>

            <button
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
          className="fixed inset-0 bg-black/75 z-50 flex items-end md:items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModalCliente(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-dark-700 shadow-2xl"
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
                  store.setCliente(1, 'CLIENTE MOSTRADOR (CONSUMIDOR FINAL)')
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
                          store.setCliente(c.id, c.nombre)
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

    </div>
  )
}

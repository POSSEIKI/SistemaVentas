import { useState, useCallback, useEffect } from 'react'
import { useVentaStore } from '../stores/ventaStore'
import { productosApi, clientesApi, facturasApi, configApi } from '../api/services'
import {
  Search, X, Plus, Minus, Trash2, ShoppingCart,
  User, CreditCard, Truck, Banknote, DollarSign, Package, Layers, Pill, FlaskConical, Tag
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

export default function VentasPage() {
  const store = useVentaStore()
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
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
    }
  }

  const elegirPresentacion = (presentacion) => {
    if (!productoFraccion) return
    store.agregarProducto(productoFraccion, presentacion)
    setModalFraccion(false)
    setProductoFraccion(null)
    setBusqueda('')
    setResultados([])
  }

  // Búsqueda de productos con debounce y prioridad configurada
  const buscarProducto = useCallback(async (q, modo = modoBusqueda) => {
    if (!q.trim() || q.length < 2) { setResultados([]); return }
    setBuscando(true)
    try {
      const res = await productosApi.buscar(q, { modo })
      if (res.length === 1 && modo !== 'SUSTANCIA') {
        procesarSeleccionProducto(res[0])
      } else {
        setResultados(res)
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

  const buscarClientes = async (q) => {
    setBusqCliente(q)
    if (!q.trim()) { setClientes([]); return }
    try {
      const res = await clientesApi.listar(q)
      setClientes(res)
    } catch {}
  }

  const handleCobrar = async () => {
    if (store.lineas.length === 0) { toast.error('Agrega productos primero'); return }
    if (!store.clienteId) { toast.error('Selecciona un cliente'); return }
    if (['CREDITO', 'CONTRAENTREGA'].includes(store.formaPago) && !store.clienteId) {
      toast.error('Se requiere cliente para esta forma de pago'); return
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

        {/* Resultados de búsqueda */}
        {resultados.length > 0 && (
          <div className="card p-0 overflow-hidden max-h-64 overflow-y-auto shadow-2xl border border-dark-600">
            {resultados.map(p => (
              <button
                key={p.id}
                onClick={() => procesarSeleccionProducto(p)}
                className="w-full flex items-center justify-between px-4 py-3
                           hover:bg-dark-700 border-b border-dark-700 last:border-0 text-left transition-colors"
              >
                <div className="space-y-0.5">
                  <p className="text-white font-semibold text-sm">{p.nombre}</p>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-dark-500 font-mono text-[11px]">{p.codigo}</span>
                    {p.principio_activo && (
                      <span className="bg-blue-950/60 text-blue-300 border border-blue-800/60 px-1.5 py-0.2 rounded text-[10px]">
                        🧪 {p.principio_activo}
                      </span>
                    )}
                    {p.laboratorio && (
                      <span className="text-dark-400 text-[11px]">· {p.laboratorio}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-primary-400 font-bold text-sm">{formatCOP(p.precio_venta)}</p>
                  <p className="text-dark-500 text-xs">
                    {p.maneja_fracciones ? `📦 Fraccionable (Stock: ${p.stock_actual})` : `Stock: ${p.stock_actual}`}
                  </p>
                </div>
              </button>
            ))}
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

      {/* ── MODAL: SELECTOR DE CLIENTE ────────────────────────────── */}
      {modalCliente && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setModalCliente(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col border border-dark-700 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-dark-700">
              <h3 className="text-white font-semibold mb-3">Seleccionar cliente</h3>
              <input
                className="input-field"
                placeholder="Buscar por nombre o documento..."
                value={busqCliente}
                onChange={e => buscarClientes(e.target.value)}
                autoFocus
              />
            </div>
            <div className="overflow-auto flex-1 divide-y divide-dark-700">
              {clientes.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    store.setCliente(c.id, c.nombre)
                    setModalCliente(false)
                    setBusqCliente('')
                    setClientes([])
                  }}
                  className="w-full flex items-center justify-between px-4 py-3
                             hover:bg-dark-700 text-left transition-colors"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{c.nombre}</p>
                    <p className="text-dark-500 text-xs">{c.nit || c.telefono || '—'}</p>
                  </div>
                  <span className="text-xs text-primary-400 font-semibold">Seleccionar</span>
                </button>
              ))}
              {busqCliente && clientes.length === 0 && (
                <p className="text-dark-500 text-sm text-center py-6">No se encontraron clientes</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

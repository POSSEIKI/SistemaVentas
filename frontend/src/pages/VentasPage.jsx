import { useState, useCallback } from 'react'
import { useVentaStore } from '../stores/ventaStore'
import { productosApi, clientesApi, facturasApi } from '../api/services'
import {
  Search, X, Plus, Minus, Trash2, ShoppingCart,
  User, CreditCard, Truck, Banknote, DollarSign, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const FORMAS_PAGO = [
  { id: 'EFECTIVO',      label: 'Efectivo',      icon: Banknote },
  { id: 'TARJETA',       label: 'Tarjeta',        icon: CreditCard },
  { id: 'CREDITO',       label: 'Crédito',        icon: DollarSign },
  { id: 'CONTRAENTREGA', label: 'Contra entrega', icon: Truck },
]

function formatCOP(num) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(num)
}

export default function VentasPage() {
  const store = useVentaStore()
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [modalCliente, setModalCliente] = useState(false)
  const [busqCliente, setBusqCliente] = useState('')
  const [clientes, setClientes] = useState([])

  // Búsqueda de productos con debounce simple
  const buscarProducto = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) { setResultados([]); return }
    setBuscando(true)
    try {
      const res = await productosApi.buscar(q)
      if (res.length === 1) {
        store.agregarProducto(res[0])
        setBusqueda('')
        setResultados([])
      } else {
        setResultados(res)
      }
    } catch { toast.error('Error buscando productos') }
    finally { setBuscando(false) }
  }, [store])

  const handleBusquedaChange = (val) => {
    setBusqueda(val)
    clearTimeout(window._busqTimer)
    window._busqTimer = setTimeout(() => buscarProducto(val), 300)
  }

  const seleccionarProducto = (p) => {
    store.agregarProducto(p)
    setBusqueda('')
    setResultados([])
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
      if (res.cambio > 0) toast.success(`Cambio: ${formatCOP(res.cambio)}`, { duration: 5000 })
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

      {/* ── Panel izquierdo: búsqueda + tabla ──────────────── */}
      <div className="flex-1 flex flex-col min-h-0 p-4 gap-4">

        {/* Barra de búsqueda */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            className="input-field pl-10 pr-10"
            value={busqueda}
            onChange={e => handleBusquedaChange(e.target.value)}
            placeholder="Buscar producto por nombre o código..."
            autoFocus
          />
          {busqueda && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500"
              onClick={() => { setBusqueda(''); setResultados([]) }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Resultados de búsqueda */}
        {resultados.length > 1 && (
          <div className="card p-0 overflow-hidden">
            {resultados.map(p => (
              <button
                key={p.id}
                onClick={() => seleccionarProducto(p)}
                className="w-full flex items-center justify-between px-4 py-3
                           hover:bg-dark-700 border-b border-dark-700 last:border-0 text-left"
              >
                <div>
                  <p className="text-white font-medium text-sm">{p.nombre}</p>
                  <p className="text-dark-500 text-xs">{p.codigo}</p>
                </div>
                <div className="text-right">
                  <p className="text-primary-400 font-semibold">{formatCOP(p.precio_venta)}</p>
                  <p className="text-dark-500 text-xs">Stock: {p.stock_actual}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Tabla de lineas */}
        <div className="flex-1 overflow-auto">
          {store.lineas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-dark-600">
              <ShoppingCart size={40} className="mb-2" />
              <p className="text-sm">Busca productos para agregar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {store.lineas.map(linea => (
                <div key={linea.producto_id} className="card flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{linea.nombre}</p>
                    <p className="text-dark-500 text-xs">{formatCOP(linea.precio_unitario)} c/u</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => store.actualizarCantidad(linea.producto_id, linea.cantidad - 1)}
                      className="w-8 h-8 bg-dark-700 rounded-lg flex items-center justify-center text-white hover:bg-dark-600"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-white font-bold w-8 text-center">{linea.cantidad}</span>
                    <button
                      onClick={() => store.actualizarCantidad(linea.producto_id, linea.cantidad + 1)}
                      className="w-8 h-8 bg-dark-700 rounded-lg flex items-center justify-center text-white hover:bg-dark-600"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="text-primary-400 font-semibold w-24 text-right text-sm">
                    {formatCOP(linea.precio_unitario * linea.cantidad)}
                  </p>
                  <button
                    onClick={() => store.quitarLinea(linea.producto_id)}
                    className="text-dark-600 hover:text-red-400 ml-1"
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
      <div className="md:w-80 bg-dark-800 border-t md:border-t-0 md:border-l border-dark-700
                      flex flex-col p-4 gap-4 flex-shrink-0">

        {/* Cliente */}
        <button
          onClick={() => setModalCliente(true)}
          className="flex items-center gap-2 w-full px-4 py-3 bg-dark-700 rounded-xl
                     hover:bg-dark-600 transition-colors text-left"
        >
          <User size={18} className="text-dark-500 flex-shrink-0" />
          <span className={`text-sm ${store.clienteId ? 'text-white' : 'text-dark-500'}`}>
            {store.clienteNombre || 'Seleccionar cliente...'}
          </span>
        </button>

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
                    ? 'bg-primary-600 text-white'
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
              Valor recibido
            </label>
            <input
              type="number"
              className="input-field"
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
          <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-dark-700">
            <span>TOTAL</span>
            <span className="text-primary-400">{formatCOP(total)}</span>
          </div>
          {store.formaPago === 'EFECTIVO' && cambio > 0 && (
            <div className="flex justify-between text-sm text-green-400">
              <span>Cambio</span>
              <span className="font-semibold">{formatCOP(cambio)}</span>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-3 mt-auto">
          <button
            onClick={() => store.limpiar()}
            className="btn-secondary flex-1"
            disabled={cobrando}
          >
            Cancelar
          </button>
          <button
            onClick={handleCobrar}
            className="btn-primary flex-1"
            disabled={cobrando || store.lineas.length === 0}
          >
            {cobrando ? 'Procesando...' : '✓ Cobrar'}
          </button>
        </div>
      </div>

      {/* ── Modal selector de cliente ──────────────────────── */}
      {modalCliente && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setModalCliente(false)}>
          <div className="bg-dark-800 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
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
            <div className="overflow-auto flex-1">
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
                             hover:bg-dark-700 border-b border-dark-700 last:border-0 text-left"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{c.nombre}</p>
                    <p className="text-dark-500 text-xs">{c.nit || c.telefono || '—'}</p>
                  </div>
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

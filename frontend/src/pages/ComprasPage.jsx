import { useState, useEffect } from 'react'
import { inventarioApi, productosApi } from '../api/services'
import { Search, Plus, Trash2, Package, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}

const LIMITE_BUSQUEDA = 6

export default function ComprasPage() {
  const [proveedores, setProveedores] = useState([])
  const [proveedorId, setProveedorId] = useState('')
  const [numFactura, setNumFactura] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [pagBusqueda, setPagBusqueda] = useState(1)
  const [lineas, setLineas] = useState([])
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    inventarioApi.proveedores().then(setProveedores).catch(() => {})
  }, [])

  const buscarProducto = async (q) => {
    if (!q.trim() || q.length < 2) { setResultados([]); setPagBusqueda(1); return }
    try {
      const res = await productosApi.buscar(q)
      setResultados(res)
      setPagBusqueda(1)
    } catch {}
  }

  const agregarLinea = (p) => {
    setBusqueda('')
    setResultados([])
    if (lineas.find(l => l.producto_id === p.id)) return
    setLineas(prev => [...prev, {
      producto_id: p.id,
      nombre: p.nombre,
      cantidad: 1,
      costo_unitario: parseFloat(p.precio_costo) || 0,
      iva_porcentaje: 0,
      precio_sugerido: parseFloat(p.precio_venta) || 0,
    }])
  }

  const setLinea = (id, campo, valor) => {
    setLineas(prev => prev.map(l => l.producto_id === id ? { ...l, [campo]: parseFloat(valor) || 0 } : l))
  }

  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.costo_unitario * (1 + l.iva_porcentaje / 100), 0)

  const guardar = async () => {
    if (lineas.length === 0) { toast.error('Agrega productos'); return }
    setGuardando(true)
    try {
      const res = await inventarioApi.registrarCompra({
        proveedor_id: proveedorId ? parseInt(proveedorId) : null,
        numero_factura_proveedor: numFactura || null,
        lineas: lineas.map(l => ({
          producto_id: l.producto_id,
          cantidad: l.cantidad,
          costo_unitario: l.costo_unitario,
          iva_porcentaje: l.iva_porcentaje,
          precio_sugerido: l.precio_sugerido || null,
        })),
      })
      toast.success(`✅ Compra ${res.numero} registrada — Total: ${formatCOP(res.total)}`)
      setLineas([])
      setNumFactura('')
      setProveedorId('')
    } catch (err) {
      toast.error(err.message || 'Error al registrar compra')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-white flex items-center gap-2">
        <Package size={22} className="text-primary-500" />
        Registrar Compra
      </h1>

      {/* Proveedor + # factura */}
      <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-dark-500 mb-1">Proveedor</label>
          <select className="input-field" value={proveedorId} onChange={e => setProveedorId(e.target.value)}>
            <option value="">Sin proveedor</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-dark-500 mb-1">N° factura proveedor</label>
          <input className="input-field" value={numFactura} onChange={e => setNumFactura(e.target.value)} placeholder="FAC-001" />
        </div>
      </div>

      {/* Buscar producto */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
        <input
          className="input-field pl-10"
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); clearTimeout(window._bt); window._bt = setTimeout(() => buscarProducto(e.target.value), 300) }}
          placeholder="Buscar producto para agregar..."
        />
        {resultados.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-10 bg-dark-800 border border-dark-700 rounded-xl mt-1 overflow-hidden shadow-2xl">
            <div className="bg-dark-900/80 px-3 py-1.5 border-b border-dark-700 flex justify-between items-center text-xs">
              <span className="text-dark-400 font-medium">🎯 {resultados.length} productos encontrados</span>
              {resultados.length > LIMITE_BUSQUEDA && (
                <span className="text-dark-500 font-mono text-[11px]">
                  Pág. {pagBusqueda} de {Math.ceil(resultados.length / LIMITE_BUSQUEDA)}
                </span>
              )}
            </div>

            <div className="divide-y divide-dark-700/60 max-h-60 overflow-y-auto">
              {resultados
                .slice((pagBusqueda - 1) * LIMITE_BUSQUEDA, pagBusqueda * LIMITE_BUSQUEDA)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => agregarLinea(p)}
                    className="w-full flex justify-between items-center px-4 py-2.5 hover:bg-dark-700 text-left transition-colors"
                  >
                    <div>
                      <span className="text-white text-sm font-semibold block">{p.nombre}</span>
                      <span className="text-dark-400 font-mono text-[11px]">{p.codigo}</span>
                    </div>
                    <span className="text-primary-400 font-bold font-mono text-xs">
                      Costo: {formatCOP(p.precio_costo)}
                    </span>
                  </button>
                ))}
            </div>

            {resultados.length > LIMITE_BUSQUEDA && (
              <div className="bg-dark-900/90 px-3 py-1.5 border-t border-dark-700 flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={() => setPagBusqueda(p => Math.max(1, p - 1))}
                  disabled={pagBusqueda === 1}
                  className="px-2 py-0.5 rounded bg-dark-800 border border-dark-700 text-dark-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs flex items-center gap-1"
                >
                  <ChevronLeft size={13} /> Anterior
                </button>
                <span className="text-dark-400 text-[11px]">
                  {((pagBusqueda - 1) * LIMITE_BUSQUEDA) + 1} - {Math.min(pagBusqueda * LIMITE_BUSQUEDA, resultados.length)} de {resultados.length}
                </span>
                <button
                  type="button"
                  onClick={() => setPagBusqueda(p => Math.min(Math.ceil(resultados.length / LIMITE_BUSQUEDA), p + 1))}
                  disabled={pagBusqueda >= Math.ceil(resultados.length / LIMITE_BUSQUEDA)}
                  className="px-2 py-0.5 rounded bg-dark-800 border border-dark-700 text-dark-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs flex items-center gap-1"
                >
                  Siguiente <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla de lineas */}
      {lineas.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-dark-700">
              <tr className="text-dark-500 text-left">
                <th className="px-4 py-3">Producto</th>
                <th className="px-3 py-3">Cantidad</th>
                <th className="px-3 py-3">Costo unit.</th>
                <th className="px-3 py-3">IVA %</th>
                <th className="px-3 py-3">P. Venta sug.</th>
                <th className="px-3 py-3">Subtotal</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map(l => (
                <tr key={l.producto_id} className="border-b border-dark-700 last:border-0">
                  <td className="px-4 py-3 text-white">{l.nombre}</td>
                  <td className="px-3 py-2">
                    <input type="number" className="input-field w-20 py-1.5 text-center" min="1" value={l.cantidad}
                      onChange={e => setLinea(l.producto_id, 'cantidad', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" className="input-field w-28 py-1.5" min="0" value={l.costo_unitario}
                      onChange={e => setLinea(l.producto_id, 'costo_unitario', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" className="input-field w-16 py-1.5 text-center" min="0" value={l.iva_porcentaje}
                      onChange={e => setLinea(l.producto_id, 'iva_porcentaje', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" className="input-field w-28 py-1.5" min="0" value={l.precio_sugerido}
                      onChange={e => setLinea(l.producto_id, 'precio_sugerido', e.target.value)} />
                  </td>
                  <td className="px-3 py-3 text-primary-400 font-medium">
                    {formatCOP(l.cantidad * l.costo_unitario)}
                  </td>
                  <td className="px-3 py-3">
                    <button onClick={() => setLineas(prev => prev.filter(x => x.producto_id !== l.producto_id))}
                      className="text-dark-600 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Total y guardar */}
      <div className="flex items-center justify-between">
        <p className="text-white text-lg font-bold">Total: <span className="text-primary-400">{formatCOP(total)}</span></p>
        <button className="btn-primary px-8" onClick={guardar} disabled={guardando || lineas.length === 0}>
          {guardando ? 'Guardando...' : '✓ Registrar compra'}
        </button>
      </div>
    </div>
  )
}

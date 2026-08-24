import { useState, useEffect } from 'react'
import { productosApi, inventarioApi } from '../api/services'
import { Search, AlertTriangle, Package } from 'lucide-react'

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}

export default function InventarioPage() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [cargando, setCargando] = useState(true)
  const [stockBajo, setStockBajo] = useState([])

  useEffect(() => {
    Promise.all([
      productosApi.listar({ activo: true }),
      productosApi.categorias(),
      inventarioApi.stockBajo(),
    ]).then(([prods, cats, bajo]) => {
      setProductos(prods)
      setCategorias(cats)
      setStockBajo(bajo.map(p => p.id))
    }).finally(() => setCargando(false))
  }, [])

  const filtrados = productos.filter(p => {
    const matchBusq = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.codigo.toLowerCase().includes(busqueda.toLowerCase())
    const matchCat = !catFiltro || p.categoria_id === parseInt(catFiltro)
    return matchBusq && matchCat
  })

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Package size={22} className="text-primary-500" />
          Inventario
        </h1>
        {stockBajo.length > 0 && (
          <div className="flex items-center gap-2 text-yellow-400 bg-yellow-900/30 border border-yellow-800 rounded-xl px-3 py-2 text-sm">
            <AlertTriangle size={16} />
            {stockBajo.length} producto(s) con stock bajo
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input className="input-field pl-9 py-2" value={busqueda}
            onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto..." />
        </div>
        <select className="input-field w-auto py-2" value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-dark-700">
            <tr className="text-dark-500 text-left">
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Mín.</th>
              <th className="px-4 py-3 text-right">Precio venta</th>
              <th className="px-4 py-3 text-right">Precio costo</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={7} className="text-center py-8 text-dark-500">Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-dark-500">No hay productos</td></tr>
            ) : filtrados.map(p => {
              const bajo = stockBajo.includes(p.id)
              return (
                <tr key={p.id} className="border-b border-dark-700 last:border-0 hover:bg-dark-700/50">
                  <td className="px-4 py-3 text-dark-500 font-mono text-xs">{p.codigo}</td>
                  <td className="px-4 py-3 text-white font-medium">
                    {p.nombre}
                    {bajo && <span className="ml-2 badge-warning">Stock bajo</span>}
                  </td>
                  <td className="px-4 py-3 text-dark-500">{p.categoria_nombre || '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${bajo ? 'text-yellow-400' : 'text-white'}`}>
                    {p.stock_actual}
                  </td>
                  <td className="px-4 py-3 text-right text-dark-500">{p.stock_minimo}</td>
                  <td className="px-4 py-3 text-right text-primary-400">{formatCOP(p.precio_venta)}</td>
                  <td className="px-4 py-3 text-right text-dark-500">{formatCOP(p.precio_costo)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

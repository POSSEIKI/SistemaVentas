import { useState, useEffect } from 'react'
import { productosApi, configApi } from '../../api/services'
import {
  Package, Search, Plus, Edit, Trash2, X,
  Layers, Pill, Settings, ChevronLeft, ChevronRight,
  DollarSign, Percent, Barcode, CheckCircle, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  redondearPrecio,
  calcularPrecioDesdeCosto,
  calcularMargenDesdePrecio,
  formatCOP,
} from '../../utils/pricing'

const FORM_VACIO = {
  id: null,
  nombre: '',
  codigo: '',
  codigo_barras: '',
  codigo_barras_blister: '',
  codigo_barras_unidad: '',
  principio_activo: '',
  laboratorio: '',
  categoria_id: '',
  unidad_medida_id: '',
  ubicacion: '',
  precio_costo: 0,
  precio_venta: 0,
  porcentaje_ganancia: 30,
  iva_porcentaje: 0,
  stock_minimo: 5,
  stock_actual: 0,
  maneja_fracciones: false,
  contenido_caja: 1,
  contenido_blister: 0,
  precio_caja: 0,
  precio_blister: 0,
  precio_unidad: 0,
  afecta_inventario: true,
}

export default function ParametrosProductos() {
  const [productos, setProductos] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [limite] = useState(30)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [categorias, setCategorias] = useState([])
  const [unidades, setUnidades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [rubro, setRubro] = useState('FARMACIA')
  const [margenDefecto, setMargenDefecto] = useState(30.0)
  const [modoRedondeo, setModoRedondeo] = useState('CENTENA_100')

  const cargarCategoriasYConfig = async () => {
    try {
      const [cats, unids, cfg] = await Promise.all([
        productosApi.categorias().catch(() => []),
        productosApi.unidades().catch(() => []),
        configApi.get().catch(() => null),
      ])
      setCategorias(cats)
      setUnidades(unids)
      if (cfg) {
        if (cfg.rubro) setRubro(cfg.rubro)
        if (cfg.margen_ganancia_predeterminado) {
          setMargenDefecto(parseFloat(cfg.margen_ganancia_predeterminado) || 30.0)
        }
        if (cfg.modo_redondeo) {
          setModoRedondeo(cfg.modo_redondeo)
        }
      }
    } catch {}
  }

  const cargarProductos = async (pag = 1, q = busqueda, cat = categoriaId) => {
    setCargando(true)
    try {
      const res = await productosApi.listar({
        pagina: pag,
        limite,
        q: q || undefined,
        categoria_id: cat ? parseInt(cat) : undefined,
      })
      setProductos(res.items || [])
      setTotal(res.total || 0)
      setPagina(res.pagina || 1)
      setTotalPaginas(res.total_paginas || 1)
    } catch {
      toast.error('Error al cargar la lista de productos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarCategoriasYConfig()
    cargarProductos(1)
  }, [])

  const buscar = (q) => {
    setBusqueda(q)
    setPagina(1)
    clearTimeout(window._prt)
    window._prt = setTimeout(() => cargarProductos(1, q, categoriaId), 250)
  }

  const filtrarCategoria = (cat) => {
    setCategoriaId(cat)
    setPagina(1)
    cargarProductos(1, busqueda, cat)
  }

  const abrirCrear = () => {
    setForm({
      ...FORM_VACIO,
      porcentaje_ganancia: margenDefecto,
      categoria_id: categorias[0]?.id || '',
      unidad_medida_id: unidades[0]?.id || '',
      codigo: `PROD-${Date.now().toString().slice(-5)}`,
    })
    setModal(true)
  }

  const abrirEditar = (p) => {
    const costo = parseFloat(p.precio_costo) || 0
    const venta = parseFloat(p.precio_venta) || 0
    const ganancia = venta - costo
    const margen = costo > 0 ? (ganancia / costo) * 100 : margenDefecto

    setForm({
      id: p.id,
      nombre: p.nombre || '',
      codigo: p.codigo || '',
      codigo_barras: p.codigo_barras || '',
      codigo_barras_blister: p.codigo_barras_blister || '',
      codigo_barras_unidad: p.codigo_barras_unidad || '',
      principio_activo: p.principio_activo || '',
      laboratorio: p.laboratorio || '',
      categoria_id: p.categoria_id || '',
      unidad_medida_id: p.unidad_medida_id || '',
      ubicacion: p.ubicacion || '',
      precio_costo: costo,
      precio_venta: venta,
      porcentaje_ganancia: parseFloat(margen.toFixed(2)),
      iva_porcentaje: parseFloat(p.iva_porcentaje) || 0,
      stock_minimo: parseFloat(p.stock_minimo) || 5,
      stock_actual: parseFloat(p.stock_actual) || 0,
      maneja_fracciones: p.maneja_fracciones || false,
      contenido_caja: p.contenido_caja || 1,
      contenido_blister: p.contenido_blister || 0,
      precio_caja: parseFloat(p.precio_caja || venta),
      precio_blister: parseFloat(p.precio_blister || 0),
      precio_unidad: parseFloat(p.precio_unidad || 0),
      afecta_inventario: p.afecta_inventario ?? true,
    })
    setModal(true)
  }

  const guardar = async (e) => {
    e?.preventDefault()
    if (!form.nombre.trim()) { toast.error('El nombre del producto es obligatorio'); return }
    if (!form.codigo.trim()) { toast.error('El código interno o SKU es obligatorio'); return }

    setGuardando(true)
    try {
      const uCaja = parseInt(form.contenido_caja) || 1
      const uBlister = parseInt(form.contenido_blister) || 0
      const pCaja = redondearPrecio(form.precio_caja || form.precio_venta, modoRedondeo)
      const pBlister = (uCaja <= 1 || uBlister <= 1) ? 0 : redondearPrecio(form.precio_blister || 0, modoRedondeo)
      const pUnidad = (uCaja <= 1) ? 0 : redondearPrecio(form.precio_unidad || 0, modoRedondeo)
      const pVenta = pCaja

      const payload = {
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim(),
        codigo_barras: form.codigo_barras?.trim() || null,
        codigo_barras_blister: (uCaja <= 1 || uBlister <= 1) ? null : (form.codigo_barras_blister?.trim() || null),
        codigo_barras_unidad: (uCaja <= 1) ? null : (form.codigo_barras_unidad?.trim() || null),
        principio_activo: form.principio_activo?.trim() || null,
        laboratorio: form.laboratorio?.trim() || null,
        categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
        unidad_medida_id: form.unidad_medida_id ? parseInt(form.unidad_medida_id) : null,
        ubicacion: form.ubicacion?.trim() || null,
        precio_costo: parseFloat(form.precio_costo) || 0,
        precio_venta: pVenta,
        iva_porcentaje: parseFloat(form.iva_porcentaje) || 0,
        stock_minimo: parseFloat(form.stock_minimo) || 0,
        maneja_fracciones: form.maneja_fracciones || false,
        contenido_caja: uCaja,
        contenido_blister: (uCaja <= 1) ? 0 : uBlister,
        precio_caja: pCaja,
        precio_blister: pBlister,
        precio_unidad: pUnidad,
        afecta_inventario: form.afecta_inventario,
      }

      if (form.id) {
        await productosApi.actualizar(form.id, payload)
        toast.success(`Producto "${form.nombre}" actualizado correctamente`)
      } else {
        await productosApi.crear(payload)
        toast.success(`Producto "${form.nombre}" creado exitosamente`)
      }
      setModal(false)
      cargarProductos(pagina)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al guardar producto')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de desactivar el producto "${nombre}"?`)) return
    try {
      await productosApi.eliminar(id)
      toast.success('Producto desactivado')
      cargarProductos(pagina)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al desactivar producto')
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Barra Superior y Acciones ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-dark-700">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package size={20} className="text-primary-500" />
            Parametrización de Productos y Catálogo
          </h2>
          <p className="text-dark-400 text-xs mt-0.5">
            Alta de productos, códigos de barra (caja/blister/unidad), fraccionamiento y cálculo de márgenes
          </p>
        </div>

        <button
          onClick={abrirCrear}
          className="btn-primary flex items-center gap-2 py-2 px-4 font-bold text-xs shadow-lg self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* ── Buscador y Filtros ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            className="input-field pl-10 pr-10 py-2 text-xs"
            value={busqueda}
            onChange={e => buscar(e.target.value)}
            placeholder="Buscar por Nombre, Código Interno, Código de Barras o Principio Activo..."
          />
          {busqueda && (
            <button
              onClick={() => { setBusqueda(''); cargarProductos(1, '', categoriaId) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            className="input-field py-2 text-xs"
            value={categoriaId}
            onChange={e => filtrarCategoria(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.total_productos || 0})</option>
            ))}
          </select>

          <span className="bg-dark-800 px-3 py-2 rounded-xl border border-dark-700 text-xs text-dark-400 font-medium whitespace-nowrap">
            Total: <strong className="text-white ml-1">{total}</strong>
          </span>
        </div>
      </div>

      {/* ── Tabla de Productos ─────────────────────────────────── */}
      {cargando ? (
        <div className="text-center py-12 space-y-2">
          <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-dark-500 text-xs">Cargando catálogo de productos...</p>
        </div>
      ) : productos.length === 0 ? (
        <div className="card text-center py-12 space-y-3 border-dashed border-dark-700">
          <Package size={36} className="mx-auto text-dark-600" />
          <h3 className="text-white font-semibold text-sm">No se encontraron productos</h3>
          <p className="text-dark-500 text-xs max-w-sm mx-auto">
            {busqueda
              ? `No hay coincidencias para "${busqueda}".`
              : 'Empieza registrando los productos de tu catálogo.'}
          </p>
          <button onClick={abrirCrear} className="btn-secondary text-xs px-4 py-2 mt-1">
            + Crear primer producto
          </button>
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto shadow-xl">
          <table className="w-full text-xs">
            <thead className="border-b border-dark-700 bg-dark-900/40 text-dark-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5 text-left">Código / Barras</th>
                <th className="px-3 py-2.5 text-left">Producto / Presentación</th>
                <th className="px-3 py-2.5 text-left">Categoría</th>
                <th className="px-3 py-2.5 text-right">Costo ($)</th>
                <th className="px-3 py-2.5 text-right">P. Venta ($)</th>
                <th className="px-3 py-2.5 text-center">% Margen</th>
                <th className="px-3 py-2.5 text-center">Stock</th>
                <th className="px-3 py-2.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/60">
              {productos.map(p => {
                const costo = parseFloat(p.precio_costo) || 0
                const venta = parseFloat(p.precio_venta) || 0
                const ganancia = venta - costo
                const margen = costo > 0 ? ((ganancia / costo) * 100).toFixed(1) : '—'

                return (
                  <tr key={p.id} className="hover:bg-dark-700/30 transition-colors">
                    {/* Códigos */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-mono font-bold text-white bg-dark-900 px-1.5 py-0.5 rounded border border-dark-700">
                        {p.codigo}
                      </span>
                      {p.codigo_barras && (
                        <span className="block text-[10px] text-dark-400 font-mono mt-0.5" title="Código de barras caja">
                          📦 {p.codigo_barras}
                        </span>
                      )}
                    </td>

                    {/* Nombre y presentación */}
                    <td className="px-3 py-2 min-w-[220px]">
                      <p className="text-white font-semibold text-xs leading-tight">{p.nombre}</p>
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-dark-400 mt-0.5">
                        {p.principio_activo && <span className="text-primary-300">🧪 {p.principio_activo}</span>}
                        {p.laboratorio && <span>🏷️ {p.laboratorio}</span>}
                        {p.maneja_fracciones && (
                          <span className="bg-primary-950/60 border border-primary-800 text-primary-300 px-1 rounded font-medium">
                            Fracción (Caja x{p.contenido_caja})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Categoría */}
                    <td className="px-3 py-2 whitespace-nowrap text-dark-300">
                      {p.categoria?.nombre || 'General'}
                    </td>

                    {/* Costo */}
                    <td className="px-3 py-2 text-right font-mono text-dark-400">
                      {formatCOP(costo)}
                    </td>

                    {/* Venta */}
                    <td className="px-3 py-2 text-right font-mono font-bold text-primary-400">
                      {formatCOP(venta)}
                    </td>

                    {/* Margen */}
                    <td className="px-3 py-2 text-center font-mono">
                      <span className="bg-dark-900 px-1.5 py-0.5 rounded text-green-400 font-bold text-[11px] border border-dark-700">
                        {margen}%
                      </span>
                    </td>

                    {/* Stock */}
                    <td className="px-3 py-2 text-center font-mono">
                      <span className={`font-bold ${p.stock_actual <= p.stock_minimo ? 'text-amber-400' : 'text-white'}`}>
                        {p.stock_actual}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => abrirEditar(p)}
                          className="p-1 rounded-lg bg-dark-700 hover:bg-primary-900/40 hover:text-primary-300 hover:border-primary-500/50 border border-dark-600 text-dark-300 transition-colors"
                          title="Editar parámetros del producto"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminar(p.id, p.nombre)}
                          className="p-1 rounded-lg text-dark-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                          title="Desactivar producto"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="bg-dark-900/80 px-4 py-2.5 border-t border-dark-700 flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => { setPagina(p => Math.max(1, p - 1)); cargarProductos(pagina - 1) }}
                disabled={pagina === 1}
                className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft size={13} /> Anterior
              </button>
              <span className="text-dark-400 text-xs">
                Página <strong className="text-white">{pagina}</strong> de {totalPaginas} ({total} productos)
              </span>
              <button
                type="button"
                onClick={() => { setPagina(p => Math.min(totalPaginas, p + 1)); cargarProductos(pagina + 1) }}
                disabled={pagina >= totalPaginas}
                className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none"
              >
                Siguiente <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de Crear / Editar Producto ───────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModal(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-dark-600 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-dark-700 flex justify-between items-center bg-dark-900/50">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package size={18} className="text-primary-400" />
                  {form.id ? 'Editar Producto' : 'Registrar Nuevo Producto'}
                </h3>
                <p className="text-dark-400 text-xs mt-0.5">
                  Parametrización de precios, códigos de barra y fraccionamiento
                </p>
              </div>
              <button onClick={() => setModal(false)} className="text-dark-500 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={guardar} className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Sección 1: Información General */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-primary-400 uppercase tracking-wider block">
                  1. Información Principal y Clasificación
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-dark-400 mb-1">Nombre Comercial del Producto *</label>
                    <input
                      className="input-field py-1.5 text-xs font-semibold"
                      placeholder="Ej: Dolex Avanzado 500mg"
                      value={form.nombre}
                      onChange={e => setForm({ ...form, nombre: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">Código Interno / SKU *</label>
                    <input
                      className="input-field py-1.5 text-xs font-mono font-bold"
                      placeholder="Ej: FAR-001"
                      value={form.codigo}
                      onChange={e => setForm({ ...form, codigo: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">Categoría</label>
                    <select
                      className="input-field py-1.5 text-xs"
                      value={form.categoria_id}
                      onChange={e => setForm({ ...form, categoria_id: e.target.value })}
                    >
                      <option value="">Sin categoría</option>
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">🧪 Sustancia / Principio Activo</label>
                    <input
                      className="input-field py-1.5 text-xs"
                      placeholder="Ej: Acetaminofén"
                      value={form.principio_activo}
                      onChange={e => setForm({ ...form, principio_activo: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">🏷️ Laboratorio / Marca</label>
                    <input
                      className="input-field py-1.5 text-xs"
                      placeholder="Ej: GSK, MK, Genfar..."
                      value={form.laboratorio}
                      onChange={e => setForm({ ...form, laboratorio: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Códigos de Barra Múltiples */}
              <div className="space-y-3 pt-3 border-t border-dark-700">
                <span className="text-xs font-bold text-primary-400 uppercase tracking-wider block">
                  2. Códigos de Barra (Caja / Blister / Unidad)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">📦 Código Barras Caja</label>
                    <input
                      className="input-field py-1.5 text-xs font-mono"
                      placeholder="Escanear..."
                      value={form.codigo_barras}
                      onChange={e => setForm({ ...form, codigo_barras: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">
                      📑 Código Barras Blister
                      {form.maneja_fracciones && (
                        ((parseInt(form.contenido_caja) || 1) <= 1 || (parseInt(form.contenido_blister) || 0) <= 1) && (
                          <span className="text-[10px] text-dark-500 ml-1">(No aplica)</span>
                        )
                      )}
                    </label>
                    <input
                      className={`input-field py-1.5 text-xs font-mono ${
                        form.maneja_fracciones &&
                        ((parseInt(form.contenido_caja) || 1) <= 1 || (parseInt(form.contenido_blister) || 0) <= 1)
                          ? 'bg-dark-800/50 text-dark-500 border-dark-700 cursor-not-allowed'
                          : ''
                      }`}
                      placeholder={
                        form.maneja_fracciones &&
                        ((parseInt(form.contenido_caja) || 1) <= 1 || (parseInt(form.contenido_blister) || 0) <= 1)
                          ? 'No aplica (Sin blíster)'
                          : 'Escanear...'
                      }
                      disabled={
                        form.maneja_fracciones &&
                        ((parseInt(form.contenido_caja) || 1) <= 1 || (parseInt(form.contenido_blister) || 0) <= 1)
                      }
                      value={form.codigo_barras_blister}
                      onChange={e => setForm({ ...form, codigo_barras_blister: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">
                      💊 Código Barras Unidad
                      {form.maneja_fracciones && ((parseInt(form.contenido_caja) || 1) <= 1) && (
                        <span className="text-[10px] text-dark-500 ml-1">(No aplica: 1 unidad)</span>
                      )}
                    </label>
                    <input
                      className={`input-field py-1.5 text-xs font-mono ${
                        form.maneja_fracciones && ((parseInt(form.contenido_caja) || 1) <= 1)
                          ? 'bg-dark-800/50 text-dark-500 border-dark-700 cursor-not-allowed'
                          : ''
                      }`}
                      placeholder={
                        form.maneja_fracciones && ((parseInt(form.contenido_caja) || 1) <= 1)
                          ? 'No aplica (Caja de 1 unidad)'
                          : 'Escanear...'
                      }
                      disabled={form.maneja_fracciones && ((parseInt(form.contenido_caja) || 1) <= 1)}
                      value={form.codigo_barras_unidad}
                      onChange={e => setForm({ ...form, codigo_barras_unidad: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Calculadora Bidireccional de Ganancia */}
              <div className="space-y-3 pt-3 border-t border-dark-700">
                <span className="text-xs font-bold text-primary-400 uppercase tracking-wider block">
                  3. Costo y Calculadora Bidireccional de Ganancia
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-dark-900/60 p-3.5 rounded-xl border border-dark-700">
                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1 font-semibold">Costo Unitario ($) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input-field py-1.5 text-xs font-mono font-bold"
                      value={form.precio_costo}
                      onChange={e => {
                        const c = parseFloat(e.target.value) || 0
                        const m = form.porcentaje_ganancia || margenDefecto
                        const p = calcularPrecioDesdeCosto(c, m, modoRedondeo)
                        setForm({
                          ...form,
                          precio_costo: c,
                          precio_venta: p,
                          precio_caja: form.maneja_fracciones ? p : form.precio_caja,
                        })
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1 font-semibold">% Margen de Ganancia</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        className="input-field py-1.5 pl-2 pr-6 text-xs font-mono font-bold text-primary-300"
                        value={form.porcentaje_ganancia}
                        onChange={e => {
                          const m = parseFloat(e.target.value) || 0
                          const p = calcularPrecioDesdeCosto(form.precio_costo, m, modoRedondeo)
                          setForm({
                            ...form,
                            porcentaje_ganancia: m,
                            precio_venta: p,
                            precio_caja: form.maneja_fracciones ? p : form.precio_caja,
                          })
                        }}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-500 font-bold text-xs">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1 font-semibold">Precio de Venta Final ($) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input-field py-1.5 text-xs font-mono font-bold text-white border-primary-500"
                      value={form.precio_venta}
                      onChange={e => {
                        const p = parseFloat(e.target.value) || 0
                        const c = form.precio_costo
                        const m = calcularMargenDesdePrecio(c, p)
                        setForm({
                          ...form,
                          precio_venta: p,
                          porcentaje_ganancia: m,
                          precio_caja: form.maneja_fracciones ? p : form.precio_caja,
                        })
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Sección 4: Fraccionamiento */}
              <div className="space-y-3 pt-3 border-t border-dark-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary-400 uppercase tracking-wider block">
                      4. Desglose y Fraccionamiento (Cajas / Blisters / Unidades)
                    </span>
                    {form.maneja_fracciones && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        (parseInt(form.contenido_caja) || 1) <= 1
                          ? 'bg-dark-800 text-dark-400 border border-dark-600'
                          : (parseInt(form.contenido_blister) || 0) > 1
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-green-950 text-green-300 border border-green-800'
                      }`}>
                        {(parseInt(form.contenido_caja) || 1) <= 1
                          ? '⚪ Producto Unitario (1 unidad — Sin Fraccionar)'
                          : (parseInt(form.contenido_blister) || 0) > 1
                          ? `📦 Caja x${form.contenido_caja} + 📑 Blíster x${form.contenido_blister} + 💊 Unidad`
                          : `📦 Caja x${form.contenido_caja} + 💊 Unidad Directa (Sin Blíster)`}
                      </span>
                    )}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                    <input
                      type="checkbox"
                      checked={form.maneja_fracciones || false}
                      onChange={e => {
                        const activa = e.target.checked
                        setForm({
                          ...form,
                          maneja_fracciones: activa,
                          precio_caja: activa ? form.precio_venta : 0,
                        })
                      }}
                      className="rounded bg-dark-700 border-dark-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span>Habilitar Fraccionamiento</span>
                  </label>
                </div>

                {form.maneja_fracciones && (
                  <div className="space-y-3 bg-dark-900/60 p-4 rounded-xl border border-primary-600/30">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-dark-400 mb-1">Contenido de la Caja (Unidades totales)</label>
                        <input
                          type="number"
                          min="1"
                          className="input-field py-1.5 text-xs font-mono"
                          value={form.contenido_caja || 1}
                          onChange={e => {
                            const cVal = parseInt(e.target.value) || 1
                            setForm({
                              ...form,
                              contenido_caja: cVal,
                              precio_unidad: cVal <= 1 ? 0 : form.precio_unidad,
                              precio_blister: cVal <= 1 ? 0 : form.precio_blister,
                            })
                          }}
                          placeholder="Ej: 12 (Labiales) o 100 (Tabletas)"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[11px] text-dark-400">Unidades por Blister / Paquete</label>
                          <span className="text-[10px] text-dark-500 font-medium">0 ó 1 si no usa blister</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          disabled={(parseInt(form.contenido_caja) || 1) <= 1}
                          className={`input-field py-1.5 text-xs font-mono ${
                            (parseInt(form.contenido_caja) || 1) <= 1
                              ? 'bg-dark-800/50 text-dark-500 border-dark-700 cursor-not-allowed'
                              : ''
                          }`}
                          value={(parseInt(form.contenido_caja) || 1) <= 1 ? 0 : (form.contenido_blister || 0)}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0
                            setForm({
                              ...form,
                              contenido_blister: val,
                              precio_blister: val <= 1 ? 0 : form.precio_blister,
                            })
                          }}
                          placeholder="0 = Sin blister"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="block text-[11px] text-dark-400 mb-1">📦 Precio Venta Caja ($)</label>
                        <input
                          type="number"
                          step="any"
                          className="input-field py-1.5 text-xs font-mono font-bold text-primary-300"
                          value={form.precio_caja || form.precio_venta}
                          onChange={e => setForm({ ...form, precio_caja: parseFloat(e.target.value) || 0 })}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-dark-400 mb-1">
                          📑 Precio Venta Blister ($)
                          {((parseInt(form.contenido_caja) || 1) <= 1 || (parseInt(form.contenido_blister) || 0) <= 1) ? (
                            <span className="text-[10px] text-dark-500 ml-1">(No aplica)</span>
                          ) : (
                            <span className="text-[10px] text-dark-500 block font-normal">(0 = No vender blister)</span>
                          )}
                        </label>
                        <input
                          type="number"
                          step="any"
                          disabled={
                            (parseInt(form.contenido_caja) || 1) <= 1 ||
                            (parseInt(form.contenido_blister) || 0) <= 1
                          }
                          className={`input-field py-1.5 text-xs font-mono font-bold ${
                            (parseInt(form.contenido_caja) || 1) <= 1 ||
                            (parseInt(form.contenido_blister) || 0) <= 1
                              ? 'bg-dark-800/50 text-dark-500 border-dark-700 cursor-not-allowed'
                              : 'text-blue-300'
                          }`}
                          value={
                            (parseInt(form.contenido_caja) || 1) <= 1 ||
                            (parseInt(form.contenido_blister) || 0) <= 1
                              ? 0
                              : (form.precio_blister ?? 0)
                          }
                          onChange={e => setForm({ ...form, precio_blister: parseFloat(e.target.value) || 0 })}
                          placeholder="0 = No vender blister"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-dark-400 mb-1">
                          💊 Precio Venta Unidad ($)
                          {((parseInt(form.contenido_caja) || 1) <= 1) ? (
                            <span className="text-[10px] text-dark-500 ml-1">(1 unidad)</span>
                          ) : (
                            <span className="text-[10px] text-emerald-400/80 block font-normal">(0 = NO vender suelto)</span>
                          )}
                        </label>
                        <input
                          type="number"
                          step="any"
                          disabled={(parseInt(form.contenido_caja) || 1) <= 1}
                          className={`input-field py-1.5 text-xs font-mono font-bold ${
                            (parseInt(form.contenido_caja) || 1) <= 1
                              ? 'bg-dark-800/50 text-dark-500 border-dark-700 cursor-not-allowed'
                              : 'text-green-300'
                          }`}
                          value={(parseInt(form.contenido_caja) || 1) <= 1 ? 0 : (form.precio_unidad ?? 0)}
                          onChange={e => setForm({ ...form, precio_unidad: parseFloat(e.target.value) || 0 })}
                          placeholder="0 = No vender suelto"
                        />
                      </div>
                    </div>

                    {/* Botón de auto-sugerir precios de blister y unidad */}
                    <button
                      type="button"
                      onClick={() => {
                        const cajaPrecio = form.precio_caja || form.precio_venta || 0
                        const totalU = parseInt(form.contenido_caja) || 1
                        const uBlister = parseInt(form.contenido_blister) || 0

                        if (totalU <= 1) {
                          setForm({
                            ...form,
                            precio_unidad: 0,
                            precio_blister: 0,
                          })
                          toast.info(`Producto unitario: solo se vende por Caja/Unidad completa ($${cajaPrecio})`)
                          return
                        }

                        const precioUnidadSug = totalU > 0 ? redondearPrecio((cajaPrecio / totalU) * 1.25, modoRedondeo) : 0
                        const precioBlisterSug = (uBlister > 1 && totalU > uBlister)
                          ? redondearPrecio((cajaPrecio / (totalU / uBlister)) * 1.12, modoRedondeo)
                          : 0

                        setForm({
                          ...form,
                          precio_unidad: precioUnidadSug,
                          precio_blister: precioBlisterSug,
                        })
                        if (uBlister <= 1) {
                          toast.success(`Calculado: Caja ($${formatCOP(cajaPrecio)}) y Unidad Individual ($${formatCOP(precioUnidadSug)}) — Sin blíster`)
                        } else {
                          toast.success('Precios de Caja, Blíster y Unidad calculados con éxito')
                        }
                      }}
                      className="text-xs text-primary-400 hover:text-primary-300 underline pt-1 block"
                    >
                      ⚡ Auto-calcular precios sugeridos {
                        ((parseInt(form.contenido_caja) || 1) <= 1)
                          ? '(Caja de 1 Unidad)'
                          : ((parseInt(form.contenido_blister) || 0) <= 1)
                          ? 'de Unidad Individual (Sin Blíster)'
                          : 'de Blíster y Unidad'
                      }
                    </button>
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-3 border-t border-dark-700">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="btn-secondary flex-1 py-2 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary flex-1 py-2 text-xs font-bold"
                >
                  {guardando ? 'Guardando...' : form.id ? '✓ Guardar Cambios' : '✓ Registrar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

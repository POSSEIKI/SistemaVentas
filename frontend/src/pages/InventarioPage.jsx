import { useState, useEffect, useRef } from 'react'
import { productosApi } from '../api/services'
import {
  Search, Plus, Package, Upload, Download, Edit2,
  Trash2, X, CheckCircle, AlertCircle, AlertTriangle, HelpCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0)
}

const FORM_PRODUCTO_VACIO = {
  codigo: '',
  codigo_barras: '',
  nombre: '',
  descripcion: '',
  categoria_id: '',
  unidad_medida_id: 1,
  precio_costo: 0,
  precio_venta: 0,
  iva_porcentaje: 0,
  stock_actual: 0,
  stock_minimo: 5,
  afecta_inventario: true,
  es_servicio: false,
  
  // Fracciones
  maneja_fracciones: false,
  contenido_caja: 1,
  contenido_blister: 0,
  precio_caja: 0,
  precio_blister: 0,
  precio_unidad: 0,

  laboratorio: '',
  principio_activo: '',
  ubicacion: '',
}

export default function InventarioPage() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [unidades, setUnidades] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [cargando, setCargando] = useState(true)

  // Modales
  const [modalProducto, setModalProducto] = useState(false)
  const [modalImportar, setModalImportar] = useState(false)
  const [productoEditando, setProductoEditando] = useState(null)
  const [formProducto, setFormProducto] = useState(FORM_PRODUCTO_VACIO)
  const [guardando, setGuardando] = useState(false)

  // Modal nueva categoría rápida
  const [modalNuevaCat, setModalNuevaCat] = useState(false)
  const [nombreNuevaCat, setNombreNuevaCat] = useState('')

  // Importación
  const [archivoImportar, setArchivoImportar] = useState(null)
  const [importando, setImportando] = useState(false)
  const [resumenImportacion, setResumenImportacion] = useState(null)
  const fileInputRef = useRef(null)

  const cargarDatos = async (busq = '') => {
    setCargando(true)
    try {
      if (busq.trim().length >= 2) {
        const prods = await productosApi.buscar(busq.trim())
        setProductos(prods)
      } else {
        const [prods, cats, unis] = await Promise.all([
          productosApi.listar({ activo: true, limite: 150 }),
          productosApi.categorias(),
          productosApi.unidades(),
        ])
        setProductos(prods)
        setCategorias(cats)
        setUnidades(unis)
      }
    } catch {
      toast.error('Error cargando inventario')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const handleBusquedaChange = (val) => {
    setBusqueda(val)
    clearTimeout(window._invSearchTimer)
    window._invSearchTimer = setTimeout(() => {
      cargarDatos(val)
    }, 300)
  }

  const abrirCrear = () => {
    setProductoEditando(null)
    setFormProducto(FORM_PRODUCTO_VACIO)
    setModalProducto(true)
  }

  const abrirEditar = (p) => {
    setProductoEditando(p)
    setFormProducto({
      codigo: p.codigo || '',
      codigo_barras: p.codigo_barras || '',
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      categoria_id: p.categoria_id || '',
      unidad_medida_id: p.unidad_medida_id || 1,
      precio_costo: parseFloat(p.precio_costo) || 0,
      precio_venta: parseFloat(p.precio_venta) || 0,
      iva_porcentaje: parseFloat(p.iva_porcentaje) || 0,
      stock_actual: parseFloat(p.stock_actual) || 0,
      stock_minimo: parseFloat(p.stock_minimo) || 0,
      afecta_inventario: p.afecta_inventario ?? true,
      es_servicio: p.es_servicio ?? false,
      maneja_fracciones: p.maneja_fracciones ?? false,
      contenido_caja: p.contenido_caja || 1,
      contenido_blister: p.contenido_blister || 0,
      precio_caja: parseFloat(p.precio_caja) || 0,
      precio_blister: parseFloat(p.precio_blister) || 0,
      precio_unidad: parseFloat(p.precio_unidad) || 0,
      laboratorio: p.laboratorio || '',
      principio_activo: p.principio_activo || '',
      ubicacion: p.ubicacion || '',
    })
    setModalProducto(true)
  }

  const handleGuardarProducto = async (e) => {
    e.preventDefault()
    if (!formProducto.codigo.trim()) { toast.error('El código es obligatorio'); return }
    if (!formProducto.nombre.trim()) { toast.error('El nombre es obligatorio'); return }

    setGuardando(true)
    try {
      const payload = {
        ...formProducto,
        categoria_id: formProducto.categoria_id ? parseInt(formProducto.categoria_id) : null,
        unidad_medida_id: formProducto.unidad_medida_id ? parseInt(formProducto.unidad_medida_id) : 1,
        precio_costo: parseFloat(formProducto.precio_costo) || 0,
        precio_venta: parseFloat(formProducto.precio_venta) || 0,
        iva_porcentaje: parseFloat(formProducto.iva_porcentaje) || 0,
        stock_actual: parseFloat(formProducto.stock_actual) || 0,
        stock_minimo: parseFloat(formProducto.stock_minimo) || 0,
        contenido_caja: parseInt(formProducto.contenido_caja) || 1,
        contenido_blister: parseInt(formProducto.contenido_blister) || 0,
        precio_caja: parseFloat(formProducto.precio_caja) || 0,
        precio_blister: parseFloat(formProducto.precio_blister) || 0,
        precio_unidad: parseFloat(formProducto.precio_unidad) || 0,
      }

      if (productoEditando) {
        const actualizado = await productosApi.actualizar(productoEditando.id, payload)
        toast.success('Producto actualizado exitosamente')
        setProductos(prev => [actualizado, ...prev.filter(p => p.id !== actualizado.id)])
      } else {
        const nuevo = await productosApi.crear(payload)
        toast.success('Producto creado exitosamente')
        setProductos(prev => [nuevo, ...prev])
      }

      setModalProducto(false)
      setProductoEditando(null)
    } catch (err) {
      const msg = err.message || 'Error al guardar producto'
      if (msg.includes('Ya existe un producto con el código')) {
        toast((t) => (
          <div className="space-y-2">
            <p className="text-xs text-white">
              ⚠️ El producto con código <b>"{formProducto.codigo}"</b> ya existe.
            </p>
            <button
              onClick={async () => {
                toast.dismiss(t.id)
                try {
                  const prod = await productosApi.porCodigo(formProducto.codigo)
                  abrirEditar(prod)
                } catch {
                  toast.error('No se pudo cargar el producto existente')
                }
              }}
              className="bg-primary-600 hover:bg-primary-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold w-full"
            >
              ✏️ Cargar para editar ahora
            </button>
          </div>
        ), { duration: 8000 })
      } else {
        toast.error(msg)
      }
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarProducto = async (p) => {
    if (!window.confirm(`¿Estás seguro de eliminar el producto "${p.nombre}"?`)) return
    try {
      await productosApi.eliminar(p.id)
      toast.success('Producto eliminado')
      cargarDatos()
    } catch (err) {
      toast.error(err.message || 'Error al eliminar')
    }
  }

  const handleCrearCategoriaRapida = async () => {
    if (!nombreNuevaCat.trim()) return
    try {
      const nueva = await productosApi.crearCategoria(nombreNuevaCat.trim())
      setCategorias(prev => [...prev, nueva])
      setFormProducto(f => ({ ...f, categoria_id: nueva.id }))
      setNombreNuevaCat('')
      setModalNuevaCat(false)
      toast.success(`Categoría "${nueva.nombre}" creada`)
    } catch (err) {
      toast.error(err.message || 'Error al crear categoría')
    }
  }

  const handleSubirArchivo = async () => {
    if (!archivoImportar) { toast.error('Selecciona un archivo Excel o CSV'); return }
    setImportando(true)
    setResumenImportacion(null)
    try {
      const formData = new FormData()
      formData.append('archivo', archivoImportar)
      const res = await productosApi.importarExcel(formData)
      setResumenImportacion(res)
      toast.success(res.mensaje)
      cargarDatos()
    } catch (err) {
      toast.error(err.message || 'Error al procesar archivo')
    } finally {
      setImportando(false)
    }
  }

  // Formato desglosado de stock
  const renderStock = (p) => {
    const stockTotal = parseFloat(p.stock_actual) || 0
    if (!p.maneja_fracciones || p.contenido_caja <= 1) {
      return (
        <div>
          <span className="text-white font-semibold">{stockTotal}</span>
          <span className="text-dark-500 text-xs ml-1">{p.unidad_abreviatura || 'und'}</span>
        </div>
      )
    }

    const cCaja = p.contenido_caja || 1
    const unidsBlister = p.contenido_blister > 0 ? Math.floor(cCaja / p.contenido_blister) : 0

    const cajas = Math.floor(stockTotal / cCaja)
    let resto = stockTotal % cCaja

    let blisters = 0
    if (unidsBlister > 0) {
      blisters = Math.floor(resto / unidsBlister)
      resto = resto % unidsBlister
    }
    const unidadesSueltas = resto

    return (
      <div className="text-right">
        <div className="text-primary-300 font-medium text-xs">
          {cajas > 0 && <span className="mr-1">{cajas} Cj</span>}
          {blisters > 0 && <span className="mr-1">{blisters} Bl</span>}
          <span>{unidadesSueltas} Und</span>
        </div>
        <span className="text-dark-500 text-[11px]">({stockTotal} total)</span>
      </div>
    )
  }

  const filtrados = productos.filter(p => {
    const q = busqueda.toLowerCase()
    const matchBusq = !q ||
      p.nombre.toLowerCase().includes(q) ||
      p.codigo.toLowerCase().includes(q) ||
      (p.codigo_barras && p.codigo_barras.toLowerCase().includes(q)) ||
      (p.laboratorio && p.laboratorio.toLowerCase().includes(q)) ||
      (p.principio_activo && p.principio_activo.toLowerCase().includes(q))
    const matchCat = !catFiltro || p.categoria_id === parseInt(catFiltro)
    return matchBusq && matchCat
  })

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">

      {/* ── Encabezado & Acciones Principales ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Package size={24} className="text-primary-500" />
            Catálogo e Inventario
          </h1>
          <p className="text-dark-500 text-xs mt-0.5">
            {productos.length} producto(s) registrados
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalImportar(true)}
            className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm"
          >
            <Upload size={16} />
            <span>Importar Excel</span>
          </button>

          <button
            onClick={abrirCrear}
            className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
          >
            <Plus size={18} />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* ── Barra de Búsqueda y Filtro ─────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            className="input-field pl-9 py-2"
            value={busqueda}
            onChange={e => handleBusquedaChange(e.target.value)}
            placeholder="Buscar por nombre, código, barra, principio activo..."
          />
          {busqueda && (
            <button
              onClick={() => { setBusqueda(''); cargarDatos('') }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="input-field w-auto py-2"
          value={catFiltro}
          onChange={e => setCatFiltro(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* ── Tabla de Productos ─────────────────────────────────────── */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-dark-700 bg-dark-800/80">
            <tr className="text-dark-500 text-left text-xs font-semibold uppercase tracking-wider">
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Producto / Presentación</th>
              <th className="px-4 py-3">Categoría / Marca</th>
              <th className="px-4 py-3 text-right">P. Venta</th>
              <th className="px-4 py-3 text-right">P. Costo</th>
              <th className="px-4 py-3 text-right">Stock Actual</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {cargando ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-dark-500">
                  Cargando productos...
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-dark-500">
                  No se encontraron productos. Crea uno nuevo o importa un archivo Excel.
                </td>
              </tr>
            ) : (
              filtrados.map(p => {
                const stockBajo = parseFloat(p.stock_actual) <= parseFloat(p.stock_minimo)
                return (
                  <tr key={p.id} className="hover:bg-dark-700/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-dark-400">
                      <div>{p.codigo}</div>
                      {p.codigo_barras && (
                        <div className="text-[10px] text-dark-500">{p.codigo_barras}</div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{p.nombre}</div>
                      {p.maneja_fracciones ? (
                        <div className="text-xs text-primary-400 font-mono mt-0.5">
                          📦 Caja x{p.contenido_caja} ({formatCOP(p.precio_caja)})
                          {p.contenido_blister > 0 && ` · 📑 Blister x${Math.floor(p.contenido_caja / p.contenido_blister)} (${formatCOP(p.precio_blister)})`}
                          {p.precio_unidad > 0 && ` · 💊 Unid (${formatCOP(p.precio_unidad)})`}
                        </div>
                      ) : p.principio_activo ? (
                        <div className="text-xs text-dark-500 italic">{p.principio_activo}</div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3 text-dark-400 text-xs">
                      <div>{p.categoria_nombre || 'General'}</div>
                      {p.laboratorio && (
                        <div className="text-dark-500 text-[11px]">{p.laboratorio}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-primary-400">
                      {formatCOP(p.precio_venta)}
                    </td>

                    <td className="px-4 py-3 text-right text-dark-400">
                      {formatCOP(p.precio_costo)}
                    </td>

                    <td className="px-4 py-3">
                      {renderStock(p)}
                      {stockBajo && (
                        <div className="text-right">
                          <span className="badge-warning text-[10px] py-0.5 px-1.5 inline-block mt-0.5">
                            Stock Bajo
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => abrirEditar(p)}
                          className="p-1.5 text-dark-500 hover:text-white hover:bg-dark-600 rounded-lg"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleEliminarProducto(p)}
                          className="p-1.5 text-dark-500 hover:text-red-400 hover:bg-dark-600 rounded-lg"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
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

      {/* ── MODAL: CREAR / EDITAR PRODUCTO (1 a 1) ────────────────── */}
      {modalProducto && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModalProducto(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-dark-700 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="p-4 border-b border-dark-700 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {productoEditando ? 'Editar Producto' : 'Nuevo Producto'}
                </h3>
                <p className="text-dark-500 text-xs">
                  Completa los datos del artículo y sus opciones de venta
                </p>
              </div>
              <button
                onClick={() => setModalProducto(false)}
                className="text-dark-500 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulario con scroll */}
            <form onSubmit={handleGuardarProducto} className="p-6 overflow-y-auto space-y-6">

              {/* 1. Datos Principales */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-primary-400 uppercase tracking-wide">
                  1. Información Principal
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-dark-500 mb-1">Código Único / Referencia *</label>
                    <input
                      className="input-field"
                      placeholder="Ej: 100026176 o FER-001"
                      value={formProducto.codigo}
                      onChange={e => setFormProducto({ ...formProducto, codigo: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-dark-500 mb-1">Código de Barras (EAN/UPC)</label>
                    <input
                      className="input-field"
                      placeholder="Escanea o escribe el código"
                      value={formProducto.codigo_barras}
                      onChange={e => setFormProducto({ ...formProducto, codigo_barras: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-dark-500 mb-1">Nombre Completo del Producto *</label>
                  <input
                    className="input-field"
                    placeholder="Ej: ACETAMINOFEN MK 500 MG 100 TAB o MARTILLO TITAN 16OZ"
                    value={formProducto.nombre}
                    onChange={e => setFormProducto({ ...formProducto, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs text-dark-500">Categoría</label>
                      <button
                        type="button"
                        onClick={() => setModalNuevaCat(true)}
                        className="text-[11px] text-primary-400 hover:underline"
                      >
                        + Nueva categoría
                      </button>
                    </div>
                    <select
                      className="input-field"
                      value={formProducto.categoria_id}
                      onChange={e => setFormProducto({ ...formProducto, categoria_id: e.target.value })}
                    >
                      <option value="">Selecciona categoría...</option>
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-dark-500 mb-1">Laboratorio / Marca</label>
                    <input
                      className="input-field"
                      placeholder="Ej: Tecnoquímicas, Genfar, Stanley"
                      value={formProducto.laboratorio}
                      onChange={e => setFormProducto({ ...formProducto, laboratorio: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Precios & Costos */}
              <div className="space-y-3 pt-2 border-t border-dark-700">
                <h4 className="text-sm font-semibold text-primary-400 uppercase tracking-wide">
                  2. Costos y Precios Base
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-dark-500 mb-1">Precio de Costo ($)</label>
                    <input
                      type="number"
                      step="any"
                      className="input-field"
                      value={formProducto.precio_costo}
                      onChange={e => setFormProducto({ ...formProducto, precio_costo: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-dark-500 mb-1">Precio de Venta Base ($) *</label>
                    <input
                      type="number"
                      step="any"
                      className="input-field font-semibold text-primary-400"
                      value={formProducto.precio_venta}
                      onChange={e => setFormProducto({ ...formProducto, precio_venta: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-dark-500 mb-1">IVA (%)</label>
                    <select
                      className="input-field"
                      value={formProducto.iva_porcentaje}
                      onChange={e => setFormProducto({ ...formProducto, iva_porcentaje: e.target.value })}
                    >
                      <option value="0">0% (Exento / Excluido)</option>
                      <option value="5">5%</option>
                      <option value="19">19% (General)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Fraccionamiento & Multi-Presentación */}
              <div className="space-y-3 pt-2 border-t border-dark-700 bg-dark-900/50 p-4 rounded-xl border border-dark-700">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      📦 Fraccionamiento y Empaque Múltiple
                    </span>
                    <p className="text-dark-500 text-xs">
                      Activa si este producto viene en caja y se vende fraccionado (caja, blister, unidad)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="chkFracciones"
                    checked={formProducto.maneja_fracciones}
                    onChange={e => setFormProducto({ ...formProducto, maneja_fracciones: e.target.checked })}
                    className="w-5 h-5 accent-primary-600 rounded cursor-pointer"
                  />
                </div>

                {formProducto.maneja_fracciones && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-dark-500 mb-1">
                          Unidades totales por Caja / Display
                        </label>
                        <input
                          type="number"
                          className="input-field"
                          placeholder="Ej: 100"
                          value={formProducto.contenido_caja}
                          onChange={e => setFormProducto({ ...formProducto, contenido_caja: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-dark-500 mb-1">
                          Número de Blisters / Paquetes por Caja (0 si no aplica)
                        </label>
                        <input
                          type="number"
                          className="input-field"
                          placeholder="Ej: 10"
                          value={formProducto.contenido_blister}
                          onChange={e => setFormProducto({ ...formProducto, contenido_blister: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-xs text-dark-500 mb-1">Precio Venta Caja ($)</label>
                        <input
                          type="number"
                          step="any"
                          className="input-field text-primary-300 font-medium"
                          value={formProducto.precio_caja}
                          onChange={e => setFormProducto({ ...formProducto, precio_caja: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-dark-500 mb-1">Precio Venta Blister ($)</label>
                        <input
                          type="number"
                          step="any"
                          className="input-field text-primary-300 font-medium"
                          value={formProducto.precio_blister}
                          onChange={e => setFormProducto({ ...formProducto, precio_blister: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-dark-500 mb-1">Precio Venta Unidad Suelta ($)</label>
                        <input
                          type="number"
                          step="any"
                          className="input-field text-primary-300 font-medium"
                          value={formProducto.precio_unidad}
                          onChange={e => setFormProducto({ ...formProducto, precio_unidad: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Control de Inventario */}
              <div className="space-y-3 pt-2 border-t border-dark-700">
                <h4 className="text-sm font-semibold text-primary-400 uppercase tracking-wide">
                  3. Existencias
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-dark-500 mb-1">
                      Stock Actual {formProducto.maneja_fracciones ? '(en Unidades Mínimas)' : ''}
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="input-field font-semibold text-white"
                      value={formProducto.stock_actual}
                      onChange={e => setFormProducto({ ...formProducto, stock_actual: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-dark-500 mb-1">Stock Mínimo de Alerta</label>
                    <input
                      type="number"
                      step="any"
                      className="input-field"
                      value={formProducto.stock_minimo}
                      onChange={e => setFormProducto({ ...formProducto, stock_minimo: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-4 border-t border-dark-700">
                <button
                  type="button"
                  onClick={() => setModalProducto(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary flex-1"
                >
                  {guardando ? 'Guardando...' : (productoEditando ? '✓ Actualizar' : '✓ Guardar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: IMPORTAR ARCHIVO EXCEL / CSV ────────────────────── */}
      {modalImportar && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setModalImportar(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-lg p-6 border border-dark-700 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-dark-700 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload size={20} className="text-primary-500" />
                Importar Productos Masivamente
              </h3>
              <button
                onClick={() => setModalImportar(false)}
                className="text-dark-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-dark-400 text-sm">
              Carga tu catálogo desde un archivo <span className="text-white font-semibold">.xlsx (Excel)</span> o <span className="text-white font-semibold">.csv</span>.
            </p>

            <div className="bg-dark-900/60 p-3 rounded-xl border border-dark-700 text-xs text-dark-300 space-y-1">
              <div className="font-semibold text-primary-400">✨ Formatos Compatibles Automáticos:</div>
              <div>• Formato Droguería / Farmacia (Reporte Maestro con Cajas, Blisters y Unidades).</div>
              <div>• Formato Ferretería (Código, Nombre, Precios).</div>
              <div>• Plantilla Oficial Estándar de SistemaVentas.</div>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-xs text-dark-500">¿No tienes plantilla?</span>
              <a
                href={productosApi.descargarPlantillaUrl()}
                download
                className="text-xs text-primary-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Download size={14} /> Descargar plantilla de ejemplo (.xlsx)
              </a>
            </div>

            {/* Input file */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-dark-900/40"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={e => setArchivoImportar(e.target.files[0])}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <Upload size={32} className="mx-auto text-dark-500 mb-2" />
              {archivoImportar ? (
                <div className="text-white text-sm font-medium">
                  {archivoImportar.name}
                  <span className="text-dark-500 block text-xs mt-0.5">
                    ({(archivoImportar.size / 1024).toFixed(1)} KB) — Clic para cambiar
                  </span>
                </div>
              ) : (
                <div>
                  <p className="text-white text-sm font-medium">Haz clic para seleccionar tu archivo</p>
                  <p className="text-dark-500 text-xs mt-1">Archivos Excel (.xlsx, .xls) o CSV</p>
                </div>
              )}
            </div>

            {/* Resumen de resultados si ya se procesó */}
            {resumenImportacion && (
              <div className="bg-primary-950/40 border border-primary-800/60 rounded-xl p-3 text-xs space-y-1">
                <div className="text-primary-300 font-bold flex items-center gap-1">
                  <CheckCircle size={14} /> {resumenImportacion.mensaje}
                </div>
                <div className="text-dark-300">
                  Creados: <b>{resumenImportacion.creados}</b> · Actualizados: <b>{resumenImportacion.actualizados}</b>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalImportar(false)}
                className="btn-secondary flex-1"
              >
                Cerrar
              </button>
              <button
                onClick={handleSubirArchivo}
                disabled={!archivoImportar || importando}
                className="btn-primary flex-1"
              >
                {importando ? 'Procesando...' : 'Iniciar Importación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVA CATEGORÍA RÁPIDA ─────────────────────────── */}
      {modalNuevaCat && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setModalNuevaCat(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-sm p-4 border border-dark-700 shadow-xl space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <h4 className="text-sm font-bold text-white">Nueva Categoría</h4>
            <input
              className="input-field"
              placeholder="Nombre de la categoría (ej: Analgésicos)"
              value={nombreNuevaCat}
              onChange={e => setNombreNuevaCat(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalNuevaCat(false)}
                className="btn-secondary flex-1 py-2 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCrearCategoriaRapida}
                className="btn-primary flex-1 py-2 text-xs"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

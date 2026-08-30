import { useState, useEffect, useRef } from 'react'
import { productosApi } from '../api/services'
import {
  Search, Plus, Package, Upload, Download, Edit2,
  Trash2, X, CheckCircle, AlertCircle, AlertTriangle, HelpCircle,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  FileSpreadsheet, Scale, FileCheck, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import toast from 'react-hot-toast'

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0)
}

const FORM_PRODUCTO_VACIO = {
  codigo: '',
  codigo_barras: '',
  codigo_barras_blister: '',
  codigo_barras_unidad: '',
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

  // Paginación
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(25)
  const [totalProductos, setTotalProductos] = useState(0)
  const [totalPaginas, setTotalPaginas] = useState(1)

  // Modales
  const [modalProducto, setModalProducto] = useState(false)
  const [modalImportar, setModalImportar] = useState(false)
  const [modalAjusteFisico, setModalAjusteFisico] = useState(false)
  const [productoEditando, setProductoEditando] = useState(null)
  const [formProducto, setFormProducto] = useState(FORM_PRODUCTO_VACIO)
  const [guardando, setGuardando] = useState(false)

  // Modal nueva categoría rápida
  const [modalNuevaCat, setModalNuevaCat] = useState(false)
  const [nombreNuevaCat, setNombreNuevaCat] = useState('')

  // Importación de Catálogo
  const [archivoImportar, setArchivoImportar] = useState(null)
  const [importando, setImportando] = useState(false)
  const [resumenImportacion, setResumenImportacion] = useState(null)

  // Ajuste / Conciliación de Inventario Físico
  const [archivoAjuste, setArchivoAjuste] = useState(null)
  const [ajustandoFisico, setAjustandoFisico] = useState(false)
  const [resumenAjuste, setResumenAjuste] = useState(null)
  const [filtroDesfase, setFiltroDesfase] = useState('TODOS') // TODOS | SOBRANTES | FALTANTES
  const fileAjusteRef = useRef(null)
  const fileInputRef = useRef(null)

  const cargarDatos = async (busq = busqueda, cat = catFiltro, pag = pagina, lim = limite) => {
    setCargando(true)
    try {
      const params = {
        activo: true,
        pagina: pag,
        limite: lim,
      }
      if (cat) params.categoria_id = parseInt(cat)
      if (busq && busq.trim()) params.q = busq.trim()

      const [resProds, cats, unis] = await Promise.all([
        productosApi.listar(params),
        productosApi.categorias(),
        productosApi.unidades(),
      ])

      if (resProds && resProds.items) {
        setProductos(resProds.items)
        setTotalProductos(resProds.total)
        setTotalPaginas(resProds.total_paginas || 1)
        setPagina(resProds.pagina || pag)
      } else if (Array.isArray(resProds)) {
        setProductos(resProds)
        setTotalProductos(resProds.length)
        setTotalPaginas(1)
      }

      setCategorias(cats)
      setUnidades(unis)
    } catch {
      toast.error('Error cargando inventario')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos('', '', 1, 25)
  }, [])

  const handleBusquedaChange = (val) => {
    setBusqueda(val)
    setPagina(1)
    clearTimeout(window._invSearchTimer)
    window._invSearchTimer = setTimeout(() => {
      cargarDatos(val, catFiltro, 1, limite)
    }, 300)
  }

  const handleCategoriaChange = (val) => {
    setCatFiltro(val)
    setPagina(1)
    cargarDatos(busqueda, val, 1, limite)
  }

  const cambiarPagina = (nuevaPag) => {
    if (nuevaPag < 1 || nuevaPag > totalPaginas) return
    setPagina(nuevaPag)
    cargarDatos(busqueda, catFiltro, nuevaPag, limite)
  }

  const cambiarLimite = (nuevoLim) => {
    const lim = parseInt(nuevoLim)
    setLimite(lim)
    setPagina(1)
    cargarDatos(busqueda, catFiltro, 1, lim)
  }

  // Generador de páginas numeradas
  const getNumerosPaginacion = () => {
    if (totalPaginas <= 7) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1)
    }
    const pages = []
    if (pagina <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push('...')
      pages.push(totalPaginas)
    } else if (pagina >= totalPaginas - 3) {
      pages.push(1)
      pages.push('...')
      for (let i = totalPaginas - 4; i <= totalPaginas; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push('...')
      pages.push(pagina - 1)
      pages.push(pagina)
      pages.push(pagina + 1)
      pages.push('...')
      pages.push(totalPaginas)
    }
    return pages
  }

  const handleDescargarTomaFisica = () => {
    toast.success('Generando hoja de conteo físico Excel...')
    const params = {}
    if (catFiltro) params.categoria_id = catFiltro
    if (busqueda) params.q = busqueda
    window.open(productosApi.exportarInventarioFisicoUrl(params), '_blank')
  }

  const handleSubirAjusteFisico = async () => {
    if (!archivoAjuste) {
      toast.error('Selecciona el archivo Excel diligenciado con el conteo físico')
      return
    }
    setAjustandoFisico(true)
    setResumenAjuste(null)
    try {
      const formData = new FormData()
      formData.append('archivo', archivoAjuste)
      const res = await productosApi.ajustarInventarioFisico(formData)
      setResumenAjuste(res)
      toast.success(`Inventario actualizado: ${res.total_ajustados} productos ajustados`)
      cargarDatos(busqueda, catFiltro, pagina, limite)
    } catch (err) {
      toast.error(err.message || 'Error procesando ajuste de inventario')
    } finally {
      setAjustandoFisico(false)
    }
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
      codigo_barras_blister: p.codigo_barras_blister || '',
      codigo_barras_unidad: p.codigo_barras_unidad || '',
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
        unidad_medida_id: formProducto.unidad_medida_id ? parseInt(formProducto.unidad_medida_id) : (unidades[0]?.id || 1),
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

  const totalCatalogo = categorias.reduce((acc, c) => acc + (c.total_productos || 0), 0)
  const filtrados = productos

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">

      {/* ── Encabezado & Acciones Principales ──────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Package size={24} className="text-primary-500" />
            Catálogo e Inventario
          </h1>
          <p className="text-dark-500 text-xs mt-0.5">
            {totalProductos > 0 ? `${totalProductos.toLocaleString()} productos en catálogo` : '0 productos'}
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full max-w-full touch-pan-x flex-nowrap sm:flex-wrap">
          {/* Botón Descargar Hoja de Toma Física */}
          <button
            onClick={handleDescargarTomaFisica}
            className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs hover:border-primary-500 hover:text-primary-400 transition-colors flex-shrink-0 whitespace-nowrap"
            title="Descarga el inventario actual en Excel con columnas para conteo físico"
          >
            <Download size={15} />
            <span>Hoja Toma Física (.xlsx)</span>
          </button>

          {/* Botón Conciliar / Ajustar Inventario Físico */}
          <button
            onClick={() => { setResumenAjuste(null); setArchivoAjuste(null); setModalAjusteFisico(true) }}
            className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs hover:border-amber-500 hover:text-amber-400 transition-colors bg-amber-950/20 border-amber-800/40 text-amber-300 flex-shrink-0 whitespace-nowrap"
            title="Cargar archivo Excel con conteo físico para calcular desfase y actualizar stock"
          >
            <Scale size={15} />
            <span>Conciliar Físico</span>
          </button>

          {/* Botón Importar Catálogo */}
          <button
            onClick={() => setModalImportar(true)}
            className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs flex-shrink-0 whitespace-nowrap"
          >
            <Upload size={15} />
            <span>Importar Catálogo</span>
          </button>

          {/* Botón Nuevo Producto */}
          <button
            onClick={abrirCrear}
            className="btn-primary flex items-center gap-1.5 py-2 px-3.5 text-xs font-bold shadow-md flex-shrink-0 whitespace-nowrap"
          >
            <Plus size={16} />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* ── Barra de Búsqueda y Filtro ─────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            className="input-field pl-9 py-2 text-xs"
            value={busqueda}
            onChange={e => handleBusquedaChange(e.target.value)}
            placeholder="Buscar por nombre, código, barra, principio activo..."
          />
          {busqueda && (
            <button
              onClick={() => { setBusqueda(''); setPagina(1); cargarDatos('', catFiltro, 1, limite) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="input-field w-auto py-2 text-xs font-medium"
          value={catFiltro}
          onChange={e => handleCategoriaChange(e.target.value)}
        >
          <option value="">Todas las categorías ({totalProductos})</option>
          {categorias.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({c.total_productos || 0})
            </option>
          ))}
        </select>
      </div>

      {/* ── Sub-header: Estado de Búsqueda y Paginación Rápida Superior ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-dark-400">
        <div className="flex items-center gap-2">
          {busqueda ? (
            <span className="text-white font-medium flex items-center gap-1.5">
              <span>🔍 Encontrados:</span>
              <strong className="text-primary-400 font-mono text-sm">{totalProductos.toLocaleString()}</strong>
              <span>artículos para</span>
              <strong className="text-amber-300 font-semibold bg-dark-800 px-2 py-0.5 rounded border border-dark-700">
                "{busqueda}"
              </strong>
            </span>
          ) : (
            <span>
              Mostrando <strong className="text-white font-mono">{totalProductos > 0 ? ((pagina - 1) * limite) + 1 : 0} - {Math.min(pagina * limite, totalProductos)}</strong> de <strong className="text-white font-mono">{totalProductos.toLocaleString()}</strong> productos
            </span>
          )}
        </div>

        {totalProductos > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-dark-500">
              Página <strong className="text-white font-mono">{pagina}</strong> de <strong className="text-white font-mono">{totalPaginas}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => cambiarPagina(pagina - 1)}
                disabled={pagina === 1}
                className="p-1 rounded bg-dark-800 border border-dark-700 text-dark-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:border-dark-600"
                title="Página anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => cambiarPagina(pagina + 1)}
                disabled={pagina >= totalPaginas}
                className="p-1 rounded bg-dark-800 border border-dark-700 text-dark-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:border-dark-600"
                title="Página siguiente"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabla de Productos ─────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden shadow-lg border border-dark-700 w-full max-w-full">
        <div className="overflow-x-auto w-full max-w-full touch-scroll-x table-responsive-container">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="border-b border-dark-700 bg-dark-800/90">
              <tr className="text-dark-400 text-left text-xs font-semibold uppercase tracking-wider">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Producto / Presentación</th>
                <th className="px-4 py-3">Categoría / Marca</th>
                <th className="px-4 py-3 text-right">P. Venta</th>
                <th className="px-4 py-3 text-right">P. Costo</th>
                <th className="px-4 py-3 text-right">Stock Actual</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/70">
              {cargando ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-dark-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Cargando página {pagina}...</span>
                    </div>
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-dark-500">
                    {busqueda ? (
                      <div className="space-y-1">
                        <p className="text-white text-sm font-semibold">No se encontraron productos para "{busqueda}"</p>
                        <p className="text-xs text-dark-500">Intenta buscar por otro término o limpia el buscador</p>
                      </div>
                    ) : (
                      <p>No hay productos registrados en esta categoría.</p>
                    )}
                  </td>
                </tr>
              ) : (
                filtrados.map(p => {
                  const stockBajo = parseFloat(p.stock_actual) <= parseFloat(p.stock_minimo)
                  return (
                    <tr key={p.id} className="hover:bg-dark-700/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-dark-400">
                        <div className="font-semibold text-dark-300">{p.codigo}</div>
                        <div className="space-y-0.5 mt-1">
                          {p.codigo_barras && (
                            <div className="text-[10px] text-dark-400 flex items-center gap-1" title="Código de barras caja / principal">
                              <span className="text-[11px]">📦</span>
                              <span className="text-dark-300 font-mono">{p.codigo_barras}</span>
                            </div>
                          )}
                          {p.codigo_barras_blister && (
                            <div className="text-[10px] text-blue-400 flex items-center gap-1" title="Código de barras blister">
                              <span className="text-[11px]">📑</span>
                              <span className="text-blue-300 font-mono">{p.codigo_barras_blister}</span>
                            </div>
                          )}
                          {p.codigo_barras_unidad && (
                            <div className="text-[10px] text-emerald-400 flex items-center gap-1" title="Código de barras unidad / suelta">
                              <span className="text-[11px]">💊</span>
                              <span className="text-emerald-300 font-mono">{p.codigo_barras_unidad}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-white font-medium text-sm">{p.nombre}</div>
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
                        <div className="text-dark-300">{p.categoria_nombre || 'General'}</div>
                        {p.laboratorio && (
                          <div className="text-dark-500 text-[11px]">{p.laboratorio}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-primary-400">
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
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => abrirEditar(p)}
                            className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors"
                            title="Editar producto"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleEliminarProducto(p)}
                            className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-dark-600 rounded-lg transition-colors"
                            title="Eliminar producto"
                          >
                            <Trash2 size={15} />
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

        {/* ── BARRA DE PAGINACIÓN COMPLETA CON BOTONES NUMÉRICOS ────── */}
        {totalProductos > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-3 bg-dark-800/90 border-t border-dark-700 text-xs text-dark-400">
            <div>
              Mostrando{' '}
              <strong className="text-white font-mono">
                {((pagina - 1) * limite) + 1} - {Math.min(pagina * limite, totalProductos)}
              </strong>{' '}
              de <strong className="text-white font-mono">{totalProductos.toLocaleString()}</strong> artículos
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-center">
              {/* Selector de límite por página */}
              <div className="flex items-center gap-1.5">
                <span className="text-dark-500">Filas:</span>
                <select
                  value={limite}
                  onChange={e => cambiarLimite(e.target.value)}
                  className="bg-dark-700 border border-dark-600 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                </select>
              </div>

              {/* Botones de navegación numerados */}
              <div className="flex items-center gap-1">
                {/* Primera página */}
                <button
                  onClick={() => cambiarPagina(1)}
                  disabled={pagina === 1}
                  className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors"
                  title="Primera página"
                >
                  <ChevronsLeft size={15} />
                </button>
                {/* Anterior */}
                <button
                  onClick={() => cambiarPagina(pagina - 1)}
                  disabled={pagina === 1}
                  className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors"
                  title="Página anterior"
                >
                  <ChevronLeft size={15} />
                </button>

                {/* Botones numéricos de página */}
                <div className="flex items-center gap-1 px-1">
                  {getNumerosPaginacion().map((pNum, idx) => {
                    if (pNum === '...') {
                      return (
                        <span key={`dots-${idx}`} className="px-1.5 text-dark-600 font-mono">
                          …
                        </span>
                      )
                    }
                    const esActual = pNum === pagina
                    return (
                      <button
                        key={`pag-${pNum}`}
                        onClick={() => cambiarPagina(pNum)}
                        className={`min-w-[28px] h-7 px-1.5 rounded-lg font-mono text-xs font-semibold transition-all ${
                          esActual
                            ? 'bg-primary-600 text-white shadow-md shadow-primary-900/30'
                            : 'text-dark-400 hover:text-white hover:bg-dark-700'
                        }`}
                      >
                        {pNum}
                      </button>
                    )
                  })}
                </div>

                {/* Siguiente */}
                <button
                  onClick={() => cambiarPagina(pagina + 1)}
                  disabled={pagina >= totalPaginas}
                  className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors"
                  title="Página siguiente"
                >
                  <ChevronRight size={15} />
                </button>
                {/* Última página */}
                <button
                  onClick={() => cambiarPagina(totalPaginas)}
                  disabled={pagina >= totalPaginas}
                  className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors"
                  title="Última página"
                >
                  <ChevronsRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
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
                    <label className="block text-xs text-dark-500 mb-1">Código de Barras Principal / Caja (EAN/UPC)</label>
                    <input
                      className="input-field font-mono"
                      placeholder="Ej: 7702132001456 (Escanear o escribir)"
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
                      📦 Fraccionamiento y Códigos por Presentación
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
                  <div className="space-y-4 pt-2">
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

                    {/* Precios por presentación */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-dark-400 font-semibold mb-1">Precio Venta Caja ($)</label>
                        <input
                          type="number"
                          step="any"
                          className="input-field text-primary-300 font-medium"
                          value={formProducto.precio_caja}
                          onChange={e => setFormProducto({ ...formProducto, precio_caja: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-dark-400 font-semibold mb-1">
                          Precio Blister ($)
                          <span className="text-[10px] text-dark-500 block font-normal">(Dejar en $0 si no vendes blíster)</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          className="input-field text-primary-300 font-medium"
                          value={formProducto.precio_blister}
                          onChange={e => setFormProducto({ ...formProducto, precio_blister: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-dark-400 font-semibold mb-1">
                          Precio Unidad Suelta ($)
                          <span className="text-[10px] text-emerald-400/80 block font-normal">(Dejar en $0 para NO vender suelto)</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          className="input-field text-primary-300 font-medium"
                          placeholder="0 = No vende suelto"
                          value={formProducto.precio_unidad}
                          onChange={e => setFormProducto({ ...formProducto, precio_unidad: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Códigos de barra individuales por presentación */}
                    <div className="p-3 bg-dark-800/80 rounded-xl border border-dark-600/60 space-y-2.5">
                      <span className="text-xs font-bold text-white block">
                        📑 Códigos de Barras por Presentación (Escaneo Rápido)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-blue-400 font-medium mb-1">
                            📑 Código de Barras Blister
                          </label>
                          <input
                            className="input-field font-mono text-xs border-blue-500/30 focus:border-blue-500"
                            placeholder="Escanea o escribe código del blister"
                            value={formProducto.codigo_barras_blister}
                            onChange={e => setFormProducto({ ...formProducto, codigo_barras_blister: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-emerald-400 font-medium mb-1">
                            💊 Código de Barras Unidad / Sobre
                          </label>
                          <input
                            className="input-field font-mono text-xs border-emerald-500/30 focus:border-emerald-500"
                            placeholder="Escanea o escribe código de la unidad"
                            value={formProducto.codigo_barras_unidad}
                            onChange={e => setFormProducto({ ...formProducto, codigo_barras_unidad: e.target.value })}
                          />
                        </div>
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
                    <label className="block text-xs text-dark-500 mb-1">Stock Mínimo Alerta</label>
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

      {/* ── MODAL: CONCILIACIÓN & AJUSTE DE INVENTARIO FÍSICO ──────── */}
      {modalAjusteFisico && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModalAjusteFisico(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-dark-700 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-4 border-b border-dark-700 flex justify-between items-center bg-dark-900/40">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Scale size={20} className="text-amber-400" />
                  Conciliación & Ajuste de Inventario Físico
                </h3>
                <p className="text-dark-500 text-xs mt-0.5">
                  Compara el conteo físico real contra el sistema, detecta desfases y actualiza el stock
                </p>
              </div>
              <button
                onClick={() => setModalAjusteFisico(false)}
                className="text-dark-500 hover:text-white p-1 rounded-lg hover:bg-dark-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 overflow-y-auto space-y-5">
              {!resumenAjuste ? (
                /* PASO 1: SUBIR ARCHIVO */
                <div className="space-y-4">
                  <div className="bg-dark-900/60 p-4 rounded-xl border border-dark-700 text-xs space-y-2">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
                      📋 Instrucciones para la toma de inventario físico:
                    </div>
                    <p className="text-dark-300">
                      1. Descarga la <b>Hoja de Toma Física (.xlsx)</b> con el inventario actual.
                    </p>
                    <p className="text-dark-300">
                      2. Diligencia el <b>conteo real en las columnas amarillas</b> (Cajas/Blisters/Unidades o Conteo Físico).
                    </p>
                    <p className="text-dark-300">
                      3. Sube el archivo aquí. El sistema calculará automáticamente las diferencias (desfases) y actualizará el stock digital.
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleDescargarTomaFisica}
                        className="text-primary-400 hover:text-primary-300 font-semibold underline inline-flex items-center gap-1"
                      >
                        <Download size={13} /> Descargar Hoja de Toma Física ahora (.xlsx)
                      </button>
                    </div>
                  </div>

                  {/* Dropzone */}
                  <div
                    onClick={() => fileAjusteRef.current?.click()}
                    className="border-2 border-dashed border-dark-600 hover:border-amber-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-dark-900/40"
                  >
                    <input
                      type="file"
                      ref={fileAjusteRef}
                      onChange={e => setArchivoAjuste(e.target.files[0])}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                    />
                    <FileSpreadsheet size={36} className="mx-auto text-amber-400 mb-2" />
                    {archivoAjuste ? (
                      <div className="text-white text-sm font-medium">
                        {archivoAjuste.name}
                        <span className="text-dark-500 block text-xs mt-0.5">
                          ({(archivoAjuste.size / 1024).toFixed(1)} KB) — Clic para cambiar archivo
                        </span>
                      </div>
                    ) : (
                      <div>
                        <p className="text-white text-sm font-bold">Seleccionar archivo Excel de Conteo Físico</p>
                        <p className="text-dark-500 text-xs mt-1">Formato .xlsx o .xls con el conteo diligenciado</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalAjusteFisico(false)}
                      className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSubirAjusteFisico}
                      disabled={!archivoAjuste || ajustandoFisico}
                      className="btn-primary flex-1 py-2.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 border-amber-600"
                    >
                      {ajustandoFisico ? 'Calculando y actualizando...' : '⚖️ Procesar y Ajustar Inventario'}
                    </button>
                  </div>
                </div>
              ) : (
                /* PASO 2: RESUMEN DE CONCILIACIÓN & REPORTE DE DESFASES */
                <div className="space-y-5">
                  {/* Tarjetas de Estadísticas */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="bg-dark-900/80 p-3 rounded-xl border border-dark-700 text-center">
                      <span className="text-[11px] text-dark-500 block">Total Contados</span>
                      <span className="text-base font-bold text-white font-mono">{resumenAjuste.total_contados}</span>
                    </div>

                    <div className="bg-dark-900/80 p-3 rounded-xl border border-dark-700 text-center">
                      <span className="text-[11px] text-dark-500 block">Exactos / Coincidentes</span>
                      <span className="text-base font-bold text-green-400 font-mono">{resumenAjuste.total_coincidentes}</span>
                    </div>

                    <div className="bg-dark-900/80 p-3 rounded-xl border border-dark-700 text-center">
                      <span className="text-[11px] text-dark-500 block">Sobrantes (+)</span>
                      <span className="text-base font-bold text-blue-400 font-mono">+{resumenAjuste.sobrantes}</span>
                    </div>

                    <div className="bg-dark-900/80 p-3 rounded-xl border border-dark-700 text-center">
                      <span className="text-[11px] text-dark-500 block">Faltantes (-)</span>
                      <span className="text-base font-bold text-red-400 font-mono">-{resumenAjuste.faltantes}</span>
                    </div>

                    <div className="col-span-2 sm:col-span-1 bg-dark-900/80 p-3 rounded-xl border border-dark-700 text-center">
                      <span className="text-[11px] text-dark-500 block">Impacto Neto ($)</span>
                      <span className={`text-xs font-bold font-mono ${resumenAjuste.impacto_total_costo >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {formatCOP(resumenAjuste.impacto_total_costo)}
                      </span>
                    </div>
                  </div>

                  {/* Mensajes de confirmación */}
                  <div className="space-y-2">
                    <div className="bg-green-950/40 border border-green-800/60 rounded-xl p-3 flex items-center gap-2 text-xs text-green-300">
                      <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                      <span>
                        <b>¡Inventario Físico Conciliado!</b> Se actualizaron <b>{resumenAjuste.total_ajustados}</b> productos con diferencias de stock en la base de datos.
                      </span>
                    </div>

                    {resumenAjuste.barras_actualizadas > 0 && (
                      <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-3 flex items-center gap-2 text-xs text-blue-300">
                        <span className="text-sm">🏷️</span>
                        <span>
                          <b>¡Códigos de Barra Sincronizados!</b> Se detectaron y actualizaron automáticamente los códigos de barra (caja/blister/unidad) de <b>{resumenAjuste.barras_actualizadas}</b> productos.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tabla de Desfases */}
                  {resumenAjuste.desfases && resumenAjuste.desfases.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Detalle de Discrepancias ({resumenAjuste.desfases.length})
                        </h4>

                        {/* Filtros rápidos */}
                        <div className="flex gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setFiltroDesfase('TODOS')}
                            className={`px-2 py-0.5 rounded font-medium ${
                              filtroDesfase === 'TODOS' ? 'bg-dark-600 text-white' : 'text-dark-500 hover:text-white'
                            }`}
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setFiltroDesfase('SOBRANTES')}
                            className={`px-2 py-0.5 rounded font-medium ${
                              filtroDesfase === 'SOBRANTES' ? 'bg-blue-900/60 text-blue-300' : 'text-dark-500 hover:text-white'
                            }`}
                          >
                            🟢 Sobrantes ({resumenAjuste.sobrantes})
                          </button>
                          <button
                            type="button"
                            onClick={() => setFiltroDesfase('FALTANTES')}
                            className={`px-2 py-0.5 rounded font-medium ${
                              filtroDesfase === 'FALTANTES' ? 'bg-red-900/60 text-red-300' : 'text-dark-500 hover:text-white'
                            }`}
                          >
                            🔴 Faltantes ({resumenAjuste.faltantes})
                          </button>
                        </div>
                      </div>

                      <div className="card p-0 overflow-x-auto max-h-64 overflow-y-auto border border-dark-700 w-full max-w-full touch-scroll-x table-responsive-container" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
                        <table className="w-full text-xs min-w-[620px]" style={{ touchAction: 'pan-x' }}>
                          <thead className="bg-dark-900 text-dark-500 text-left sticky top-0 border-b border-dark-700">
                            <tr>
                              <th className="px-3 py-2">Código</th>
                              <th className="px-3 py-2">Producto</th>
                              <th className="px-3 py-2 text-right">Stock Anterior</th>
                              <th className="px-3 py-2 text-right">Físico Real</th>
                              <th className="px-3 py-2 text-right">Desfase</th>
                              <th className="px-3 py-2 text-right">Impacto Costo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dark-700/60 font-mono">
                            {resumenAjuste.desfases
                              .filter(d => {
                                if (filtroDesfase === 'SOBRANTES') return d.desfase > 0
                                if (filtroDesfase === 'FALTANTES') return d.desfase < 0
                                return true
                              })
                              .map(d => {
                                const esSobrante = d.desfase > 0
                                return (
                                  <tr key={d.id} className="hover:bg-dark-700/30">
                                    <td className="px-3 py-2 text-dark-400">{d.codigo}</td>
                                    <td className="px-3 py-2 font-sans font-medium text-white max-w-xs truncate">
                                      {d.nombre}
                                    </td>
                                    <td className="px-3 py-2 text-right text-dark-400">{d.stock_digital}</td>
                                    <td className="px-3 py-2 text-right font-bold text-white">{d.conteo_fisico}</td>
                                    <td className="px-3 py-2 text-right">
                                      <span className={`px-1.5 py-0.5 rounded font-bold text-[11px] ${
                                        esSobrante
                                          ? 'bg-blue-950/60 text-blue-300 border border-blue-800/60'
                                          : 'bg-red-950/60 text-red-300 border border-red-800/60'
                                      }`}>
                                        {esSobrante ? `+${d.desfase}` : d.desfase}
                                      </span>
                                    </td>
                                    <td className={`px-3 py-2 text-right font-bold ${
                                      esSobrante ? 'text-blue-400' : 'text-red-400'
                                    }`}>
                                      {formatCOP(d.impacto_costo)}
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setResumenAjuste(null); setArchivoAjuste(null) }}
                      className="btn-secondary flex-1 py-2.5 text-xs"
                    >
                      ← Cargar otro archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalAjusteFisico(false)}
                      className="btn-primary flex-1 py-2.5 text-xs font-bold"
                    >
                      ✓ Finalizar y Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

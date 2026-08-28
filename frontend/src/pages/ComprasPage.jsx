import { useState, useEffect, useRef } from 'react'
import { inventarioApi, productosApi, configApi, proveedoresApi } from '../api/services'
import {
  Search, Plus, Trash2, Package, ChevronLeft, ChevronRight,
  FileSpreadsheet, Upload, AlertTriangle, CheckCircle2, Settings,
  Percent, DollarSign, Layers, Pill, Sparkles, X, RefreshCw,
  Gift, Split, ArrowRightLeft, Boxes, Check,
  FileText, History, Eye, CheckCircle, ShieldAlert, Printer, Calendar, Truck
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  redondearPrecio,
  calcularPrecioDesdeCosto,
  calcularMargenDesdePrecio,
  formatCOP,
} from '../utils/pricing'

const LIMITE_BUSQUEDA = 6

export default function ComprasPage() {
  const [tabActiva, setTabActiva] = useState('NUEVA_COMPRA') // 'NUEVA_COMPRA' | 'HISTORIAL'
  const [proveedores, setProveedores] = useState([])
  const [categorias, setCategorias] = useState([])
  const [proveedorId, setProveedorId] = useState('')
  const [numFactura, setNumFactura] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [pagBusqueda, setPagBusqueda] = useState(1)
  const [lineas, setLineas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [analizandoExcel, setAnalizandoExcel] = useState(false)
  const [resumenCargue, setResumenCargue] = useState(null)
  const [rubro, setRubro] = useState('FARMACIA')
  const [margenPredeterminado, setMargenPredeterminado] = useState(30.0)
  const [modoRedondeo, setModoRedondeo] = useState('CENTENA_100')
  const [estrategiaCostoGlobal, setEstrategiaCostoGlobal] = useState('PROMEDIO_PONDERADO') // 'PROMEDIO_PONDERADO' | 'COSTO_MAS_ALTO' | 'ULTIMO_COSTO'

  // Modal de Parametrización y Alta de Producto / Fraccionamiento
  const [modalParametrizar, setModalParametrizar] = useState(null)
  const [guardandoProductoModal, setGuardandoProductoModal] = useState(false)

  // Modal de Crear Proveedor Rápido
  const [modalNuevoProveedor, setModalNuevoProveedor] = useState(null)
  const [guardandoProveedor, setGuardandoProveedor] = useState(false)

  // Modal Convertidor de Obsequios (OBS) y Desagregador de Packs/Combos (DTE)
  const [modalConvertidor, setModalConvertidor] = useState(null)
  const [busqDestino, setBusqDestino] = useState('')
  const [resultadosDestino, setResultadosDestino] = useState([])
  const [buscandoDestino, setBuscandoDestino] = useState(false)

  // Modal de Alerta de Factura Duplicada
  const [facturaDuplicadaModal, setFacturaDuplicadaModal] = useState(null)

  // Historial y Detalle de Facturas Registradas
  const [historialCompras, setHistorialCompras] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [filtroHistorial, setFiltroHistorial] = useState('')
  const [compraDetalleModal, setCompraDetalleModal] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  const fileInputRef = useRef(null)

  const abrirModalNuevoProveedor = (nombreSugerido = '') => {
    setModalNuevoProveedor({
      razon_social: nombreSugerido || '',
      nit: '',
      contacto: '',
      telefono: '',
      email: '',
      direccion: '',
      ciudad: '',
    })
  }

  const handleGuardarProveedor = async (e) => {
    e.preventDefault()
    if (!modalNuevoProveedor.razon_social?.trim()) {
      toast.error('La Razón Social o Nombre del proveedor es obligatoria')
      return
    }

    setGuardandoProveedor(true)
    try {
      const nuevo = await proveedoresApi.crear({
        razon_social: modalNuevoProveedor.razon_social.trim(),
        nit: modalNuevoProveedor.nit?.trim() || null,
        contacto: modalNuevoProveedor.contacto?.trim() || null,
        telefono: modalNuevoProveedor.telefono?.trim() || null,
        email: modalNuevoProveedor.email?.trim() || null,
        direccion: modalNuevoProveedor.direccion?.trim() || null,
        ciudad: modalNuevoProveedor.ciudad?.trim() || null,
        activo: true,
      })

      // Recargar lista de proveedores y auto-asignarlo a la compra actual
      const provsActualizados = await inventarioApi.proveedores()
      setProveedores(provsActualizados || [])
      setProveedorId(nuevo.id)
      toast.success(`✓ Proveedor "${nuevo.razon_social}" creado y asignado a la compra`, { duration: 4000 })
      setModalNuevoProveedor(null)
    } catch (err) {
      toast.error(err.message || 'Error al crear el proveedor')
    } finally {
      setGuardandoProveedor(false)
    }
  }

  useEffect(() => {
    inventarioApi.proveedores().then(setProveedores).catch(() => {})
    productosApi.categorias().then(setCategorias).catch(() => {})
    configApi.get().then(cfg => {
      if (cfg) {
        if (cfg.rubro) setRubro(cfg.rubro)
        if (cfg.margen_ganancia_predeterminado) setMargenPredeterminado(parseFloat(cfg.margen_ganancia_predeterminado) || 30.0)
        if (cfg.modo_redondeo) setModoRedondeo(cfg.modo_redondeo)
      }
    }).catch(() => {})
    cargarHistorial()
  }, [])

  const cargarHistorial = async (q = '') => {
    setCargandoHistorial(true)
    try {
      const data = await inventarioApi.listarCompras(q ? { q } : {})
      setHistorialCompras(data || [])
    } catch {
      toast.error('Error al cargar historial de compras')
    } finally {
      setCargandoHistorial(false)
    }
  }

  const abrirDetalleCompra = async (id) => {
    setCargandoDetalle(true)
    try {
      const data = await inventarioApi.obtenerCompra(id)
      setCompraDetalleModal(data)
    } catch {
      toast.error('No se pudo cargar el detalle de la factura')
    } finally {
      setCargandoDetalle(false)
    }
  }

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
    if (lineas.find(l => l.producto_id === p.id)) {
      toast.error('Este producto ya está agregado en la compra')
      return
    }

    const costo = parseFloat(p.precio_costo) || 0
    const precioVenta = parseFloat(p.precio_venta) || (costo > 0 ? costo * (1 + margenPredeterminado / 100) : 0)
    const ganancia = precioVenta - costo
    const margen = costo > 0 ? (ganancia / costo) * 100 : margenPredeterminado

    setLineas(prev => [...prev, {
      key: `prod_${p.id}_${Date.now()}`,
      producto_id: p.id,
      estado: 'ENCONTRADO',
      nombre: p.nombre,
      codigo: p.codigo,
      codigo_barras: p.codigo_barras || '',
      codigo_barras_blister: p.codigo_barras_blister || '',
      codigo_barras_unidad: p.codigo_barras_unidad || '',
      principio_activo: p.principio_activo || '',
      laboratorio: p.laboratorio || '',
      cantidad: 1,
      costo_unitario: costo,
      iva_porcentaje: parseFloat(p.iva_porcentaje) || 0,
      porcentaje_ganancia: parseFloat(margen.toFixed(2)),
      precio_sugerido: parseFloat(precioVenta.toFixed(2)),
      maneja_fracciones: p.maneja_fracciones || false,
      contenido_caja: p.contenido_caja || 1,
      contenido_blister: p.contenido_blister || 0,
      precio_caja: parseFloat(p.precio_caja || precioVenta),
      precio_blister: parseFloat(p.precio_blister || 0),
      precio_unidad: parseFloat(p.precio_unidad || 0),
    }])
  }

  // ─── Calculadora Bidireccional de Costo, Margen y Precio ──────────────────
  const handleCambioCosto = (lineaKey, nuevoCosto) => {
    const costo = parseFloat(nuevoCosto) || 0
    setLineas(prev => prev.map(l => {
      if (l.key === lineaKey) {
        const precio = calcularPrecioDesdeCosto(costo, l.porcentaje_ganancia || margenPredeterminado, modoRedondeo)
        return {
          ...l,
          costo_unitario: costo,
          precio_sugerido: precio,
          precio_caja: l.maneja_fracciones ? precio : l.precio_caja,
        }
      }
      return l
    }))
  }

  const handleCambioMargen = (lineaKey, nuevoMargen) => {
    const margen = parseFloat(nuevoMargen) || 0
    setLineas(prev => prev.map(l => {
      if (l.key === lineaKey) {
        const precio = calcularPrecioDesdeCosto(l.costo_unitario, margen, modoRedondeo)
        return {
          ...l,
          porcentaje_ganancia: margen,
          precio_sugerido: precio,
          precio_caja: l.maneja_fracciones ? precio : l.precio_caja,
        }
      }
      return l
    }))
  }

  const handleCambioPrecioVenta = (lineaKey, nuevoPrecio) => {
    const precio = parseFloat(nuevoPrecio) || 0
    setLineas(prev => prev.map(l => {
      if (l.key === lineaKey) {
        const costo = l.costo_unitario
        const margen = calcularMargenDesdePrecio(costo, precio)
        return {
          ...l,
          precio_sugerido: precio,
          porcentaje_ganancia: margen,
          precio_caja: l.maneja_fracciones ? precio : l.precio_caja,
        }
      }
      return l
    }))
  }

  const setLineaCampo = (lineaKey, campo, valor) => {
    setLineas(prev => prev.map(l => l.key === lineaKey ? { ...l, [campo]: valor } : l))
  }

  const handleCambiarEstrategiaCostoLinea = (lineaKey, nuevaEstrategia) => {
    setLineas(prev => prev.map(l => {
      if (l.key === lineaKey) {
        let nuevoCosto = l.costo_unitario
        if (nuevaEstrategia === 'PROMEDIO_PONDERADO') {
          nuevoCosto = l.costo_promedio_ponderado || l.costo_unitario
        } else if (nuevaEstrategia === 'COSTO_MAS_ALTO') {
          nuevoCosto = l.costo_mas_alto || l.costo_unitario
        } else if (nuevaEstrategia === 'ULTIMO_COSTO') {
          nuevoCosto = l.costo_ultimo || l.costo_factura || l.costo_unitario
        }
        const nuevoPrecio = calcularPrecioDesdeCosto(nuevoCosto, l.porcentaje_ganancia, modoRedondeo)
        return {
          ...l,
          estrategia_costo: nuevaEstrategia,
          costo_unitario: nuevoCosto,
          precio_sugerido: nuevoPrecio,
          precio_caja: l.maneja_fracciones ? nuevoPrecio : l.precio_caja,
        }
      }
      return l
    }))
  }

  const handleCambiarEstrategiaGlobal = (nuevaEstrategia) => {
    setEstrategiaCostoGlobal(nuevaEstrategia)
    setLineas(prev => prev.map(l => {
      let nuevoCosto = l.costo_unitario
      if (nuevaEstrategia === 'PROMEDIO_PONDERADO') {
        nuevoCosto = l.costo_promedio_ponderado || l.costo_unitario
      } else if (nuevaEstrategia === 'COSTO_MAS_ALTO') {
        nuevoCosto = l.costo_mas_alto || l.costo_unitario
      } else if (nuevaEstrategia === 'ULTIMO_COSTO') {
        nuevoCosto = l.costo_ultimo || l.costo_factura || l.costo_unitario
      }
      const nuevoPrecio = calcularPrecioDesdeCosto(nuevoCosto, l.porcentaje_ganancia, modoRedondeo)
      return {
        ...l,
        estrategia_costo: nuevaEstrategia,
        costo_unitario: nuevoCosto,
        precio_sugerido: nuevoPrecio,
        precio_caja: l.maneja_fracciones ? nuevoPrecio : l.precio_caja,
      }
    }))
    toast.success(`Estrategia aplicada: ${nuevaEstrategia === 'PROMEDIO_PONDERADO' ? '⚖️ Promedio Ponderado' : nuevaEstrategia === 'COSTO_MAS_ALTO' ? '🛡️ Costo Más Alto' : '🔄 Último Costo'}`)
  }

  // ─── Cargue y Análisis de Factura Multi-formato (Coopidrogas .DAT, XML DIAN, Excel, CSV) ─────────────
  const handleCargarFacturaExcel = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAnalizandoExcel(true)
    const formData = new FormData()
    formData.append('archivo', file)

    try {
      const res = await inventarioApi.analizarFacturaExcel(formData)
      if (!res.items || res.items.length === 0) {
        toast.error('No se pudieron extraer productos válidos del archivo.')
        return
      }

      setResumenCargue(res)

      // Auto-completar número de factura si fue detectado en el archivo
      if (res.numero_factura_detectado && !numFactura) {
        setNumFactura(res.numero_factura_detectado)
      }

      // Auto-seleccionar proveedor si fue detectado y coincide con la lista
      if (res.proveedor_detectado && !proveedorId) {
        const provNorm = res.proveedor_detectado.toLowerCase()
        const provMatch = proveedores.find(p =>
          p.razon_social?.toLowerCase().includes(provNorm) ||
          provNorm.includes(p.razon_social?.toLowerCase()) ||
          (p.nit && provNorm.includes(p.nit))
        )
        if (provMatch) {
          setProveedorId(provMatch.id)
          toast.success(`Proveedor auto-asignado: ${provMatch.razon_social}`)
        }
      }

      // Transformar a líneas de compra
      const nuevasLineas = res.items.map((it, idx) => ({
        key: `cargue_${it.producto_id || 'nuevo'}_${idx}_${Date.now()}`,
        producto_id: it.producto_id || null,
        estado: it.estado, // 'ENCONTRADO' | 'NUEVO'
        nombre: it.nombre,
        nombre_original: it.nombre_original || it.nombre,
        codigo: it.codigo || '',
        codigo_barras: it.codigo_barras || '',
        codigo_barras_blister: it.codigo_barras_blister || '',
        codigo_barras_unidad: it.codigo_barras_unidad || '',
        principio_activo: it.principio_activo || '',
        laboratorio: it.laboratorio || '',
        lote: it.lote || null,
        vencimiento: it.vencimiento || null,
        cantidad: it.cantidad || 1,
        costo_unitario: it.costo_unitario || 0,
        costo_factura: it.costo_factura || it.costo_unitario || 0,
        costo_anterior_bd: it.costo_anterior_bd || 0,
        costo_promedio_ponderado: it.costo_promedio_ponderado || it.costo_unitario || 0,
        costo_mas_alto: it.costo_mas_alto || it.costo_unitario || 0,
        costo_ultimo: it.costo_ultimo || it.costo_unitario || 0,
        estrategia_costo: it.estrategia_costo || 'PROMEDIO_PONDERADO',
        cambio_costo_detectado: it.cambio_costo_detectado || false,
        iva_porcentaje: it.iva_porcentaje || 0,
        porcentaje_ganancia: it.porcentaje_ganancia || margenPredeterminado,
        precio_sugerido: it.precio_sugerido || 0,
        stock_actual_bd: it.stock_actual_bd || 0,
        maneja_fracciones: it.maneja_fracciones || false,
        contenido_caja: it.contenido_caja || 1,
        contenido_blister: it.contenido_blister || 0,
        precio_caja: it.precio_caja || it.precio_sugerido || 0,
        precio_blister: it.precio_blister || 0,
        precio_unidad: it.precio_unidad || 0,
        es_obsequio_probable: it.es_obsequio_probable || false,
        es_combo_probable: it.es_combo_probable || false,
        factor_combo_sugerido: it.factor_combo_sugerido || 1,
        convertido_desde_pack: false,
        nombre_origen_pack: null,
      }))

      // Si la factura ya fue registrada previamente, bloquear y abrir alerta informativa con botón para ver el detalle
      if (res.factura_ya_registrada && res.compra_previa) {
        setFacturaDuplicadaModal({
          numeroFactura: res.numero_factura_detectado || 'Sin número',
          proveedor: res.proveedor_detectado || res.compra_previa.proveedor_nombre || 'Proveedor',
          compraPrevia: res.compra_previa,
          totalItems: res.total_filas,
        })
        setLineas([])
        setResumenCargue(null)
        toast.error(
          `🚫 Factura ya registrada previamente: Comprobante ${res.compra_previa.numero}. Se bloquea el cargue para evitar duplicar el inventario.`,
          { duration: 8000 }
        )
        return
      }

      setLineas(nuevasLineas)
      const descFormato = res.formato_detectado?.includes('PDF')
        ? 'Factura PDF'
        : res.formato_detectado?.includes('DAT') || res.formato_detectado?.includes('TEXT')
        ? 'Archivo Plano (.DAT / .TXT)'
        : res.formato_detectado === 'XML_DIAN'
        ? 'DIAN Factura Electrónica XML'
        : res.formato_detectado === 'EXCEL'
        ? 'Archivo Excel'
        : 'Factura Digital'

      const msgEscala = res.escala_precios_detectada > 1
        ? ` (Auto-escalado ÷${res.escala_precios_detectada} por centavos implícitos)`
        : ''

      toast.success(
        `📄 ${descFormato} procesado: ${res.total_filas} artículos (${res.encontrados} en catálogo, ${res.nuevos} nuevos)${msgEscala}`,
        { duration: 5000 }
      )
    } catch (err) {
      toast.error(err.message || 'Error al analizar el archivo de factura')
    } finally {
      setAnalizandoExcel(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── Convertidor / Desagregador de Obsequios y Packs ───────────────────────
  const abrirModalConvertidor = (linea) => {
    const esCombo = Boolean(linea.es_combo_probable)
    const factorDef = linea.factor_combo_sugerido || (esCombo ? 2 : 1)
    const nombreLimpio = (linea.nombre_original || linea.nombre || '')
      .replace(/\b(OBS\.?|OBSEQUIO|BONIF\.?|MUESTRA|\d+\s*DTE|PACK\s*X\s*\d+|\d+X\d+|DUO\s*PACK|TRIO\s*PACK|COMBO|\+\s*\d+\s*GTS|GTS|GRATIS|P\.E)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    setModalConvertidor({
      linea,
      modo: linea.es_obsequio_probable ? 'OBSEQUIO' : 'DESEMPACAR_PACK',
      factor: factorDef,
      productoDestino: null,
      costoTratamiento: 'CERO', // 'CERO' | 'PROMEDIO'
      precioVentaPersonalizado: null,
      margenPersonalizado: null,
    })
    setBusqDestino(nombreLimpio)
    buscarProductosDestino(nombreLimpio)
  }

  const buscarProductosDestino = async (q) => {
    if (!q || q.trim().length < 2) { setResultadosDestino([]); return }
    setBuscandoDestino(true)
    try {
      const res = await productosApi.buscar(q.trim())
      setResultadosDestino(res || [])
    } catch {
      setResultadosDestino([])
    } finally {
      setBuscandoDestino(false)
    }
  }

  const handleSeleccionarProductoDestino = (p) => {
    const factorNum = Math.max(1, parseInt(modalConvertidor?.factor) || 1)
    let costoFacturaUnit = 0
    if (modalConvertidor?.modo === 'OBSEQUIO') {
      costoFacturaUnit = modalConvertidor?.costoTratamiento === 'CERO' ? 0 : parseFloat(p.precio_costo || 0)
    } else {
      costoFacturaUnit = factorNum > 0 ? (modalConvertidor.linea.costo_unitario / factorNum) : modalConvertidor.linea.costo_unitario
      costoFacturaUnit = Math.round(costoFacturaUnit * 100) / 100
    }

    const stockAnt = parseFloat(p.stock_actual || 0)
    const costoAnt = parseFloat(p.precio_costo || 0)
    const cantNueva = modalConvertidor.linea.cantidad * factorNum

    let cpp = costoFacturaUnit
    let costoMax = costoFacturaUnit
    let costoUlt = costoFacturaUnit
    let cambioCosto = false

    if (stockAnt > 0 && costoAnt > 0 && costoFacturaUnit > 0) {
      cpp = Math.round((((stockAnt * costoAnt) + (cantNueva * costoFacturaUnit)) / (stockAnt + cantNueva)) * 100) / 100
      costoMax = Math.max(costoAnt, costoFacturaUnit)
      cambioCosto = Math.abs(costoFacturaUnit - costoAnt) > 0.01
    }

    const estrategia = modalConvertidor?.estrategiaCosto || estrategiaCostoGlobal || 'PROMEDIO_PONDERADO'
    const costoEfectivo = estrategia === 'PROMEDIO_PONDERADO'
      ? cpp
      : estrategia === 'COSTO_MAS_ALTO'
      ? costoMax
      : costoUlt

    let pVenta = parseFloat(p.precio_venta || 0)
    let margen = parseFloat(p.porcentaje_ganancia || margenPredeterminado)
    if (pVenta <= 0 && costoEfectivo > 0) {
      pVenta = calcularPrecioDesdeCosto(costoEfectivo, margen, modoRedondeo)
    } else if (pVenta > 0 && costoEfectivo > 0) {
      margen = calcularMargenDesdePrecio(costoEfectivo, pVenta)
    }

    setModalConvertidor(prev => ({
      ...prev,
      productoDestino: p,
      costoFacturaUnit,
      costoPromedioPonderado: cpp,
      costoMasAlto: costoMax,
      costoUltimo: costoUlt,
      estrategiaCosto: estrategia,
      costoEfectivo,
      cambioCostoDetectado: cambioCosto,
      precioVentaPersonalizado: pVenta,
      margenPersonalizado: margen,
    }))
  }

  const handleCambioPrecioModalConvertidor = (nuevoPrecioStr) => {
    const pVenta = Math.max(0, parseFloat(nuevoPrecioStr) || 0)
    const costoActual = modalConvertidor?.costoEfectivo || modalConvertidor?.costoFacturaUnit || 0
    const nuevoMargen = costoActual > 0 ? calcularMargenDesdePrecio(costoActual, pVenta) : 100

    setModalConvertidor(prev => ({
      ...prev,
      precioVentaPersonalizado: pVenta,
      margenPersonalizado: nuevoMargen,
    }))
  }

  const handleCambioMargenModalConvertidor = (nuevoMargenStr) => {
    const margen = parseFloat(nuevoMargenStr) || 0
    const costoActual = modalConvertidor?.costoEfectivo || modalConvertidor?.costoFacturaUnit || 0
    const nuevoPrecio = costoActual > 0
      ? calcularPrecioDesdeCosto(costoActual, margen, modoRedondeo)
      : (modalConvertidor?.precioVentaPersonalizado || 0)

    setModalConvertidor(prev => ({
      ...prev,
      precioVentaPersonalizado: nuevoPrecio,
      margenPersonalizado: margen,
    }))
  }

  const handleCambioEstrategiaModalConvertidor = (nuevaEstrategia) => {
    setModalConvertidor(prev => {
      if (!prev?.productoDestino) return prev
      const cpp = prev.costoPromedioPonderado || prev.costoFacturaUnit || 0
      const costoMax = prev.costoMasAlto || prev.costoFacturaUnit || 0
      const costoUlt = prev.costoUltimo || prev.costoFacturaUnit || 0

      const nuevoCosto = nuevaEstrategia === 'PROMEDIO_PONDERADO'
        ? cpp
        : nuevaEstrategia === 'COSTO_MAS_ALTO'
        ? costoMax
        : costoUlt

      const margen = prev.margenPersonalizado !== null ? prev.margenPersonalizado : margenPredeterminado
      const nuevoPrecio = nuevoCosto > 0
        ? calcularPrecioDesdeCosto(nuevoCosto, margen, modoRedondeo)
        : prev.precioVentaPersonalizado

      return {
        ...prev,
        estrategiaCosto: nuevaEstrategia,
        costoEfectivo: nuevoCosto,
        precioVentaPersonalizado: nuevoPrecio,
      }
    })
  }

  const handleCambioModoOParametros = (actualizaciones) => {
    setModalConvertidor(prev => {
      const nuevo = { ...prev, ...actualizaciones }
      if (nuevo.productoDestino) {
        const factorNum = Math.max(1, parseInt(nuevo.factor) || 1)
        let costoFacturaUnit = 0
        if (nuevo.modo === 'OBSEQUIO') {
          costoFacturaUnit = nuevo.costoTratamiento === 'CERO' ? 0 : parseFloat(nuevo.productoDestino.precio_costo || 0)
        } else {
          costoFacturaUnit = factorNum > 0 ? (nuevo.linea.costo_unitario / factorNum) : nuevo.linea.costo_unitario
          costoFacturaUnit = Math.round(costoFacturaUnit * 100) / 100
        }

        const stockAnt = parseFloat(nuevo.productoDestino.stock_actual || 0)
        const costoAnt = parseFloat(nuevo.productoDestino.precio_costo || 0)
        const cantNueva = nuevo.linea.cantidad * factorNum

        let cpp = costoFacturaUnit
        let costoMax = costoFacturaUnit
        let costoUlt = costoFacturaUnit

        if (stockAnt > 0 && costoAnt > 0 && costoFacturaUnit > 0) {
          cpp = Math.round((((stockAnt * costoAnt) + (cantNueva * costoFacturaUnit)) / (stockAnt + cantNueva)) * 100) / 100
          costoMax = Math.max(costoAnt, costoFacturaUnit)
        }

        const estrategia = nuevo.estrategiaCosto || estrategiaCostoGlobal || 'PROMEDIO_PONDERADO'
        const costoEfectivo = estrategia === 'PROMEDIO_PONDERADO' ? cpp : estrategia === 'COSTO_MAS_ALTO' ? costoMax : costoUlt

        let pVenta = nuevo.precioVentaPersonalizado !== null ? nuevo.precioVentaPersonalizado : parseFloat(nuevo.productoDestino.precio_venta || 0)
        let margen = nuevo.margenPersonalizado !== null ? nuevo.margenPersonalizado : parseFloat(nuevo.productoDestino.porcentaje_ganancia || margenPredeterminado)

        if (pVenta <= 0 && costoEfectivo > 0) {
          pVenta = calcularPrecioDesdeCosto(costoEfectivo, margen, modoRedondeo)
        } else if (pVenta > 0 && costoEfectivo > 0) {
          margen = calcularMargenDesdePrecio(costoEfectivo, pVenta)
        }

        nuevo.costoFacturaUnit = costoFacturaUnit
        nuevo.costoPromedioPonderado = cpp
        nuevo.costoMasAlto = costoMax
        nuevo.costoUltimo = costoUlt
        nuevo.costoEfectivo = costoEfectivo
        nuevo.precioVentaPersonalizado = pVenta
        nuevo.margenPersonalizado = margen
      }
      return nuevo
    })
  }

  const handleConfirmarConversion = () => {
    if (!modalConvertidor || !modalConvertidor.productoDestino) {
      toast.error('Selecciona un producto destino del catálogo')
      return
    }
    const {
      linea, modo, factor, productoDestino,
      costoTratamiento, precioVentaPersonalizado, margenPersonalizado,
      costoPromedioPonderado, costoMasAlto, costoUltimo, estrategiaCosto, costoEfectivo,
      costoFacturaUnit
    } = modalConvertidor

    const factorNum = Math.max(1, parseInt(factor) || 1)
    const stockAnt = parseFloat(productoDestino.stock_actual || 0)
    const costoAnt = parseFloat(productoDestino.precio_costo || 0)

    let nuevaCantidad = linea.cantidad
    let costoFactura = linea.costo_unitario

    if (modo === 'OBSEQUIO') {
      nuevaCantidad = linea.cantidad
      costoFactura = costoTratamiento === 'CERO' ? 0 : costoAnt
    } else if (modo === 'DESEMPACAR_PACK') {
      nuevaCantidad = linea.cantidad * factorNum
      costoFactura = factorNum > 0 ? (linea.costo_unitario / factorNum) : linea.costo_unitario
      costoFactura = Math.round(costoFactura * 100) / 100
    }

    let cpp = costoFactura
    let costoMax = costoFactura
    let costoUlt = costoFactura
    let cambioCosto = false

    if (stockAnt > 0 && costoAnt > 0 && costoFactura > 0) {
      cpp = Math.round((((stockAnt * costoAnt) + (nuevaCantidad * costoFactura)) / (stockAnt + nuevaCantidad)) * 100) / 100
      costoMax = Math.max(costoAnt, costoFactura)
      cambioCosto = Math.abs(costoFactura - costoAnt) > 0.01
    }

    const estrategiaActiva = estrategiaCosto || estrategiaCostoGlobal || 'PROMEDIO_PONDERADO'
    const costoFinalLinea = costoEfectivo || (
      estrategiaActiva === 'PROMEDIO_PONDERADO' ? cpp : estrategiaActiva === 'COSTO_MAS_ALTO' ? costoMax : costoUlt
    )

    const nuevoPrecioVenta = (precioVentaPersonalizado !== undefined && precioVentaPersonalizado !== null)
      ? parseFloat(precioVentaPersonalizado)
      : parseFloat(productoDestino.precio_venta || 0)

    const nuevoMargen = (margenPersonalizado !== undefined && margenPersonalizado !== null)
      ? parseFloat(margenPersonalizado)
      : (costoFinalLinea > 0 ? calcularMargenDesdePrecio(costoFinalLinea, nuevoPrecioVenta) : margenPredeterminado)

    // Actualizar la línea en el listado de compra
    setLineas(prev => prev.map(l => {
      if (l.key === linea.key) {
        return {
          ...l,
          producto_id: productoDestino.id,
          estado: 'ENCONTRADO',
          nombre: `${productoDestino.nombre} (Conv. desde: ${linea.nombre_original || linea.nombre})`,
          codigo: productoDestino.codigo,
          codigo_barras: productoDestino.codigo_barras || '',
          codigo_barras_blister: productoDestino.codigo_barras_blister || '',
          codigo_barras_unidad: productoDestino.codigo_barras_unidad || '',
          principio_activo: productoDestino.principio_activo || '',
          laboratorio: productoDestino.laboratorio || '',
          cantidad: nuevaCantidad,
          costo_unitario: costoFinalLinea,
          costo_factura: costoFactura,
          costo_anterior_bd: stockAnt > 0 ? costoAnt : 0,
          costo_promedio_ponderado: cpp,
          costo_mas_alto: costoMax,
          costo_ultimo: costoUlt,
          stock_actual_bd: stockAnt,
          estrategia_costo: estrategiaActiva,
          cambio_costo_detectado: cambioCosto,
          precio_sugerido: nuevoPrecioVenta,
          porcentaje_ganancia: nuevoMargen,
          maneja_fracciones: productoDestino.maneja_fracciones || false,
          contenido_caja: productoDestino.contenido_caja || 1,
          contenido_blister: productoDestino.contenido_blister || 0,
          precio_caja: parseFloat(productoDestino.precio_caja || nuevoPrecioVenta),
          precio_blister: parseFloat(productoDestino.precio_blister || 0),
          precio_unidad: parseFloat(productoDestino.precio_unidad || 0),
          convertido_desde_pack: true,
          nombre_origen_pack: linea.nombre_original || linea.nombre,
          es_obsequio_probable: false,
          es_combo_probable: false,
        }
      }
      return l
    }))

    toast.success(`✓ Línea convertida a "${productoDestino.nombre}" (${nuevaCantidad} unid. a costo ${formatCOP(costoFinalLinea)} / Venta: ${formatCOP(nuevoPrecioVenta)})`)
    setModalConvertidor(null)
  }

  // ─── Ajuste Rápido de Escala de Precios (÷100 / ÷1000 / ×100) ───────────────
  const aplicarFactorEscala = (factor) => {
    if (!factor || factor <= 0) return
    setLineas(prev => prev.map(l => {
      const nuevoCosto = Math.max(0, Math.round((l.costo_unitario * factor) * 100) / 100)
      const nuevoPrecio = Math.max(0, Math.round((l.precio_sugerido * factor) * 100) / 100)
      const ganancia = nuevoPrecio - nuevoCosto
      const margen = nuevoCosto > 0 ? (ganancia / nuevoCosto) * 100 : l.porcentaje_ganancia
      return {
        ...l,
        costo_unitario: nuevoCosto,
        precio_sugerido: nuevoPrecio,
        porcentaje_ganancia: parseFloat(margen.toFixed(2)),
        precio_caja: l.maneja_fracciones ? nuevoPrecio : l.precio_caja,
      }
    }))
    toast.success(
      factor < 1
        ? `Precios ajustados: divididos por ${Math.round(1 / factor)}`
        : `Precios ajustados: multiplicados por ${Math.round(factor)}`
    )
  }

  // ─── Modal de Parametrización y Alta de Producto / Fraccionamiento ────────
  const abrirModalParametrizar = (linea) => {
    setModalParametrizar({
      ...linea,
      categoria_id: linea.categoria_id || (categorias[0]?.id || null),
    })
  }

  const handleGuardarModalParametrizar = async (e) => {
    e.preventDefault()
    if (!modalParametrizar) return
    const p = modalParametrizar

    setGuardandoProductoModal(true)
    try {
      let prodId = p.producto_id
      const uCaja = parseInt(p.contenido_caja) || 1
      const uBlister = parseInt(p.contenido_blister) || 0
      const pCaja = redondearPrecio(p.precio_caja || p.precio_sugerido, modoRedondeo)
      const pBlister = (uCaja <= 1 || uBlister <= 1) ? 0 : redondearPrecio(p.precio_blister || 0, modoRedondeo)
      const pUnidad = (uCaja <= 1) ? 0 : redondearPrecio(p.precio_unidad || 0, modoRedondeo)
      const pSugerido = pCaja

      // Si es un producto nuevo en BD, crearlo ahora
      if (!prodId || p.estado === 'NUEVO') {
        const nuevo = await productosApi.crear({
          codigo: p.codigo.trim(),
          codigo_barras: p.codigo_barras?.trim() || null,
          codigo_barras_blister: (uCaja <= 1 || uBlister <= 1) ? null : (p.codigo_barras_blister?.trim() || null),
          codigo_barras_unidad: (uCaja <= 1) ? null : (p.codigo_barras_unidad?.trim() || null),
          nombre: p.nombre.trim(),
          principio_activo: p.principio_activo?.trim() || null,
          laboratorio: p.laboratorio?.trim() || null,
          categoria_id: p.categoria_id || null,
          precio_costo: p.costo_unitario,
          precio_venta: pSugerido,
          iva_porcentaje: p.iva_porcentaje || 0,
          maneja_fracciones: p.maneja_fracciones || false,
          contenido_caja: uCaja,
          contenido_blister: (uCaja <= 1) ? 0 : uBlister,
          precio_caja: pCaja,
          precio_blister: pBlister,
          precio_unidad: pUnidad,
          stock_actual: 0,
          afecta_inventario: true,
        })
        prodId = nuevo.id
        toast.success(`✓ Producto "${nuevo.nombre}" creado y parametrizado en catálogo`)
      } else {
        // Actualizar parámetros en producto existente
        await productosApi.actualizar(prodId, {
          codigo_barras: p.codigo_barras?.trim() || null,
          codigo_barras_blister: (uCaja <= 1 || uBlister <= 1) ? null : (p.codigo_barras_blister?.trim() || null),
          codigo_barras_unidad: (uCaja <= 1) ? null : (p.codigo_barras_unidad?.trim() || null),
          principio_activo: p.principio_activo?.trim() || null,
          laboratorio: p.laboratorio?.trim() || null,
          precio_costo: p.costo_unitario,
          precio_venta: pSugerido,
          maneja_fracciones: p.maneja_fracciones || false,
          contenido_caja: uCaja,
          contenido_blister: (uCaja <= 1) ? 0 : uBlister,
          precio_caja: pCaja,
          precio_blister: pBlister,
          precio_unidad: pUnidad,
        })
        toast.success(`✓ Parámetros actualizados para "${p.nombre}"`)
      }

      // Actualizar la línea en la tabla de compras
      setLineas(prev => prev.map(l => {
        if (l.key === p.key) {
          return {
            ...p,
            producto_id: prodId,
            estado: 'ENCONTRADO',
          }
        }
        return l
      }))

      setModalParametrizar(null)
    } catch (err) {
      toast.error(err.message || 'Error guardando datos del producto')
    } finally {
      setGuardandoProductoModal(false)
    }
  }

  // ─── Guardar Compra Completa ──────────────────────────────────────────────
  const total = lineas.reduce((acc, l) => acc + (l.cantidad * l.costo_unitario * (1 + (l.iva_porcentaje || 0) / 100)), 0)

  const obsequiosPendientes = lineas.filter(l => {
    const esObs = l.es_obsequio_probable || (l.costo_unitario <= 0 && !l.convertido_desde_pack)
    const sinPrecio = !l.precio_sugerido || parseFloat(l.precio_sugerido) <= 0
    return (esObs && !l.convertido_desde_pack) || (sinPrecio)
  })

  const productosNuevosPendientes = lineas.filter(l => l.estado === 'NUEVO' && !l.convertido_desde_pack)

  const guardar = async () => {
    if (lineas.length === 0) { toast.error('Agrega al menos un producto a la compra'); return }

    // 0. Validar que no haya obsequios (OBS) sin precio o no convertidos
    if (obsequiosPendientes.length > 0) {
      const primerObs = obsequiosPendientes[0]
      toast.error(
        `⚠️ Hay ${obsequiosPendientes.length} obsequio(s) (OBS) o artículo(s) sin precio de venta. Es obligatorio convertirlos a productos vendibles del catálogo antes de registrar la compra.`,
        { duration: 7000 }
      )
      abrirModalConvertidor(primerObs)
      return
    }

    setGuardando(true)
    try {
      // 1. Dar de alta automáticamente cualquier producto marcado como NUEVO que no haya sido parametrizado
      const lineasProcesadas = []
      for (const l of lineas) {
        let prodId = l.producto_id
        if (!prodId || l.estado === 'NUEVO') {
          const nuevo = await productosApi.crear({
            codigo: l.codigo?.trim() || `PROD-${Date.now().toString().slice(-6)}`,
            codigo_barras: l.codigo_barras?.trim() || null,
            codigo_barras_blister: l.codigo_barras_blister?.trim() || null,
            codigo_barras_unidad: l.codigo_barras_unidad?.trim() || null,
            nombre: l.nombre.trim(),
            principio_activo: l.principio_activo?.trim() || null,
            laboratorio: l.laboratorio?.trim() || null,
            precio_costo: l.costo_unitario,
            precio_venta: l.precio_sugerido,
            iva_porcentaje: l.iva_porcentaje || 0,
            maneja_fracciones: l.maneja_fracciones || false,
            contenido_caja: l.contenido_caja || 1,
            contenido_blister: l.contenido_blister || 0,
            precio_caja: l.precio_caja || l.precio_sugerido,
            precio_blister: l.precio_blister || 0,
            precio_unidad: l.precio_unidad || 0,
            stock_actual: 0,
            afecta_inventario: true,
          })
          prodId = nuevo.id
        }

        lineasProcesadas.push({
          producto_id: prodId,
          cantidad: l.cantidad,
          costo_unitario: l.costo_factura || l.costo_unitario,
          costo_calculado_producto: l.costo_unitario,
          estrategia_costo: l.estrategia_costo || estrategiaCostoGlobal || 'PROMEDIO_PONDERADO',
          iva_porcentaje: l.iva_porcentaje || 0,
          precio_sugerido: l.precio_sugerido || null,
          maneja_fracciones: l.maneja_fracciones,
          contenido_caja: l.contenido_caja,
          contenido_blister: l.contenido_blister,
          precio_caja: l.precio_caja,
          precio_blister: l.precio_blister,
          precio_unidad: l.precio_unidad,
          codigo_barras: l.codigo_barras,
          codigo_barras_blister: l.codigo_barras_blister,
          codigo_barras_unidad: l.codigo_barras_unidad,
        })
      }

      // 2. Registrar compra en inventario
      const res = await inventarioApi.registrarCompra({
        proveedor_id: proveedorId ? parseInt(proveedorId) : null,
        numero_factura_proveedor: numFactura || null,
        estrategia_costo_global: estrategiaCostoGlobal || 'PROMEDIO_PONDERADO',
        lineas: lineasProcesadas,
      })

      toast.success(`✅ Compra ${res.numero} registrada exitosamente — Total: ${formatCOP(res.total)}`, { duration: 5000 })
      setLineas([])
      setNumFactura('')
      setProveedorId('')
      setResumenCargue(null)
      cargarHistorial()
    } catch (err) {
      toast.error(err.message || 'Error al registrar la compra')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* Header y Botones de Acción */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-dark-700">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Package size={22} className="text-primary-500" />
            Módulo de Compras e Inventario
          </h1>
          <p className="text-dark-400 text-xs mt-0.5">
            Recepción de facturas, anti-duplicados, desglose de packs y consulta de compras ingresadas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tabActiva === 'NUEVA_COMPRA' && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleCargarFacturaExcel}
                accept=".pdf,.xlsx,.xls,.csv,.dat,.txt,.xml,.prn,.tsv,.json"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={analizandoExcel}
                className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary-900/30"
              >
                {analizandoExcel ? (
                  <RefreshCw size={15} className="animate-spin text-white" />
                ) : (
                  <FileSpreadsheet size={16} />
                )}
                <span>{analizandoExcel ? 'Analizando Factura...' : '📄 Cargar Factura (PDF, XML DIAN, Excel, CSV, Archivos Planos .DAT / .TXT)'}</span>
              </button>

              {lineas.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setLineas([]); setResumenCargue(null) }}
                  className="btn-secondary py-2 px-3 text-xs"
                >
                  Limpiar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Selector de Pestañas: Nueva Compra vs Historial de Facturas */}
      <div className="flex items-center gap-2 border-b border-dark-700 pb-2">
        <button
          type="button"
          onClick={() => setTabActiva('NUEVA_COMPRA')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tabActiva === 'NUEVA_COMPRA'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
              : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
        >
          <Package size={16} />
          <span>📥 Recepción y Cargue de Compras</span>
          {lineas.length > 0 && (
            <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {lineas.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setTabActiva('HISTORIAL')
            cargarHistorial()
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tabActiva === 'HISTORIAL'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
              : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
        >
          <History size={16} />
          <span>📑 Historial de Facturas Registradas</span>
          {historialCompras.length > 0 && (
            <span className="bg-dark-900 text-primary-400 border border-primary-800/40 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {historialCompras.length}
            </span>
          )}
        </button>
      </div>

      {tabActiva === 'NUEVA_COMPRA' && (
        <div className="space-y-4 animate-in fade-in duration-150">

      {/* Resumen del Cargue de Factura */}
      {resumenCargue && (
        <div className="bg-gradient-to-r from-dark-800 to-dark-850 border border-dark-600 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-sm">
                📊
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-bold text-sm">Factura Importada con Éxito</h3>
                  {resumenCargue.formato_detectado && (
                    <span className="bg-primary-950 border border-primary-700 text-primary-300 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                      ⚡ Formato: {
                        resumenCargue.formato_detectado?.includes('PDF') ? 'Factura PDF' :
                        resumenCargue.formato_detectado?.includes('DAT') || resumenCargue.formato_detectado?.includes('TEXT') ? 'Archivo Plano (.DAT / .TXT)' :
                        resumenCargue.formato_detectado === 'XML_DIAN' ? 'DIAN XML (Factura Electrónica)' :
                        resumenCargue.formato_detectado === 'EXCEL' ? 'Excel (.xlsx / .xls)' :
                        resumenCargue.formato_detectado === 'CSV' ? 'Archivo CSV' :
                        'Factura Digital'
                      }
                    </span>
                  )}
                </div>
                <p className="text-dark-400 text-xs mt-0.5">
                  {resumenCargue.total_filas} artículos detectados · Margen predeterminado aplicado: <strong className="text-primary-400">{resumenCargue.margen_predeterminado}%</strong>
                  {resumenCargue.numero_factura_detectado && (
                    <span className="ml-2 text-dark-300">· Factura / Pedido N°: <strong className="text-white">{resumenCargue.numero_factura_detectado}</strong></span>
                  )}
                  {resumenCargue.fecha_detectada && (
                    <span className="ml-2 text-dark-300">· Fecha: <strong className="text-amber-400 font-mono">{resumenCargue.fecha_detectada}</strong></span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="bg-dark-900 px-3 py-1.5 rounded-lg border border-dark-700 text-green-400 font-bold">
                ✓ {resumenCargue.encontrados} en catálogo
              </span>
              <span className={`px-3 py-1.5 rounded-lg border font-bold ${
                resumenCargue.nuevos > 0
                  ? 'bg-amber-950/60 border-amber-600 text-amber-300'
                  : 'bg-dark-900 border-dark-700 text-dark-400'
              }`}>
                ⚠️ {resumenCargue.nuevos} nuevos
              </span>
            </div>
          </div>

          {/* Barra de Ajuste Rápido de Escala de Precios / Decimales */}
          <div className="bg-dark-900/80 border border-dark-700 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-dark-300">
              <span className="font-semibold text-white">⚙️ Ajuste de Decimales y Escala:</span>
              <span className="text-[11px] text-dark-400">¿El proveedor envió precios en centavos sin punto decimal o con ceros de más?</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => aplicarFactorEscala(0.01)}
                className="px-2.5 py-1 rounded bg-dark-800 hover:bg-dark-700 text-primary-300 font-bold border border-primary-800/40 text-[11px] transition-colors"
                title="Dividir todos los costos y precios entre 100 (Quitar 2 ceros)"
              >
                ÷ 100 (Quitar 2 ceros)
              </button>
              <button
                type="button"
                onClick={() => aplicarFactorEscala(0.001)}
                className="px-2.5 py-1 rounded bg-dark-800 hover:bg-dark-700 text-blue-300 font-bold border border-blue-800/40 text-[11px] transition-colors"
                title="Dividir todos los costos y precios entre 1000"
              >
                ÷ 1.000
              </button>
              <button
                type="button"
                onClick={() => aplicarFactorEscala(100)}
                className="px-2.5 py-1 rounded bg-dark-800 hover:bg-dark-700 text-amber-300 font-bold border border-amber-800/40 text-[11px] transition-colors"
                title="Multiplicar por 100 si se dividieron de más"
              >
                × 100
              </button>
            </div>
          </div>

          {productosNuevosPendientes.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle size={18} className="flex-shrink-0 text-amber-400" />
                <span>
                  Hay <strong>{productosNuevosPendientes.length} productos nuevos</strong> sin código o fraccionamiento registrado. Puedes parametrizarlos uno a uno o crearlos automáticamente al guardar.
                </span>
              </div>
              <button
                type="button"
                onClick={() => abrirModalParametrizar(productosNuevosPendientes[0])}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex-shrink-0 flex items-center gap-1.5"
              >
                <Settings size={14} />
                <span>Parametrizar Primer Nuevo</span>
              </button>
            </div>
          )}

          {obsequiosPendientes.length > 0 && (
            <div className="bg-purple-950/40 border border-purple-500/70 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="flex items-center gap-2.5 text-purple-200">
                <div className="w-8 h-8 rounded-lg bg-purple-900 border border-purple-500 text-purple-300 flex items-center justify-center flex-shrink-0">
                  <Gift size={18} className="animate-bounce" />
                </div>
                <div>
                  <p className="text-white font-bold text-xs">
                    ⚠️ {obsequiosPendientes.length} Obsequio(s) (OBS) o artículo(s) sin precio de venta detectados
                  </p>
                  <p className="text-purple-300/80 text-[11px] mt-0.5">
                    Es obligatorio convertirlos a productos vendibles del catálogo para poder registrar la compra en inventario.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => abrirModalConvertidor(obsequiosPendientes[0])}
                className="btn-primary py-1.5 px-3 text-xs font-bold bg-purple-600 hover:bg-purple-500 border-purple-500 whitespace-nowrap shadow-md flex-shrink-0 flex items-center gap-1.5"
              >
                <Gift size={14} />
                <span>Convertir ({obsequiosPendientes[0].nombre_original || obsequiosPendientes[0].nombre})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Proveedor + # factura */}
      <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wide">
              Proveedor / Distribuidor
            </label>
            <button
              type="button"
              onClick={() => abrirModalNuevoProveedor(resumenCargue?.proveedor_detectado || '')}
              className="text-xs text-primary-400 hover:text-primary-300 font-bold flex items-center gap-1 transition-colors hover:underline"
            >
              <Plus size={13} />
              <span>+ Nuevo Proveedor</span>
            </button>
          </div>
          <select className="input-field py-2 text-sm" value={proveedorId} onChange={e => setProveedorId(e.target.value)}>
            <option value="">Sin proveedor asignado</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social} {p.nit ? `(${p.nit})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-dark-400 mb-1 uppercase tracking-wide">N° Factura del Proveedor</label>
          <input className="input-field py-2 text-sm font-mono" value={numFactura} onChange={e => setNumFactura(e.target.value)} placeholder="Ej: FE-984321" />
        </div>
      </div>

      {/* Buscar producto manual */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
        <input
          className="input-field pl-10 pr-4 py-2 text-sm"
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); clearTimeout(window._bt); window._bt = setTimeout(() => buscarProducto(e.target.value), 250) }}
          placeholder="Buscar producto por nombre, código interno o escanear código de barras para añadir a la compra..."
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
                      <div className="flex items-center gap-2 text-xs text-dark-400">
                        <span className="font-mono text-[11px]">{p.codigo}</span>
                        {p.principio_activo && <span>· 🧪 {p.principio_activo}</span>}
                      </div>
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

      {/* Tabla de Líneas de Compra */}
      {lineas.length > 0 ? (
        <div className="card p-0 overflow-x-auto shadow-xl">
          <div className="px-4 py-2.5 border-b border-dark-700 flex flex-wrap justify-between items-center gap-3 bg-dark-900/70">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-white font-bold text-sm">Artículos a Ingresar en Inventario</h2>

              {/* Botones de Estrategia de Costos para Desktop (PC) */}
              <div className="hidden sm:flex items-center gap-1 bg-dark-800/90 p-1 rounded-xl border border-dark-700">
                <button
                  type="button"
                  onClick={() => handleCambiarEstrategiaGlobal('PROMEDIO_PONDERADO')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    estrategiaCostoGlobal === 'PROMEDIO_PONDERADO'
                      ? 'bg-primary-600 text-white border-primary-500 shadow-sm shadow-primary-900/40'
                      : 'bg-dark-900 text-dark-400 border-dark-700 hover:text-white hover:bg-dark-700'
                  }`}
                  title="Promedia el costo del stock actual con la compra entrante"
                >
                  <span>⚖️ Promedio Ponderado</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCambiarEstrategiaGlobal('COSTO_MAS_ALTO')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    estrategiaCostoGlobal === 'COSTO_MAS_ALTO'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-sm shadow-amber-900/40'
                      : 'bg-dark-900 text-dark-400 border-dark-700 hover:text-white hover:bg-dark-700'
                  }`}
                  title="Mantiene el costo más alto para proteger el margen de ganancia"
                >
                  <span>🛡️ Costo Más Alto (Techo)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCambiarEstrategiaGlobal('ULTIMO_COSTO')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    estrategiaCostoGlobal === 'ULTIMO_COSTO'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-900/40'
                      : 'bg-dark-900 text-dark-400 border-dark-700 hover:text-white hover:bg-dark-700'
                  }`}
                  title="Aplica directamente el costo de la factura actual"
                >
                  <span>🔄 Último Costo Factura</span>
                </button>
              </div>

              {/* Menú Desplegable de Estrategia para Móvil */}
              <div className="flex sm:hidden items-center gap-1.5">
                <span className="text-[11px] text-dark-400 font-semibold">Estrategia:</span>
                <select
                  value={estrategiaCostoGlobal}
                  onChange={e => handleCambiarEstrategiaGlobal(e.target.value)}
                  className="bg-dark-800 text-white border border-dark-600 rounded-lg py-1 px-2 text-xs font-bold focus:ring-1 focus:ring-primary-500"
                >
                  <option value="PROMEDIO_PONDERADO">⚖️ Promedio Ponderado</option>
                  <option value="COSTO_MAS_ALTO">🛡️ Costo Más Alto</option>
                  <option value="ULTIMO_COSTO">🔄 Último Factura</option>
                </select>
              </div>
            </div>

            <span className="text-dark-400 text-xs font-mono">{lineas.length} ítems en orden</span>
          </div>

          <table className="w-full text-xs">
            <thead className="border-b border-dark-700 bg-dark-900/40 text-dark-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5 text-left">Estado</th>
                <th className="px-3 py-2.5 text-left">Producto / Códigos</th>
                <th className="px-2 py-2.5 text-center">Cant.</th>
                <th className="px-2 py-2.5 text-left">Costo Unit. ($)</th>
                <th className="px-2 py-2.5 text-left">% Ganancia</th>
                <th className="px-2 py-2.5 text-left">P. Venta Final ($)</th>
                <th className="px-2 py-2.5 text-center">IVA %</th>
                <th className="px-3 py-2.5 text-right">Subtotal</th>
                <th className="px-3 py-2.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/60">
              {lineas.map(l => {
                const esNuevo = l.estado === 'NUEVO'
                const gananciaUnitaria = (l.precio_sugerido || 0) - (l.costo_unitario || 0)

                return (
                  <tr
                    key={l.key}
                    className={`hover:bg-dark-700/30 transition-colors ${
                      esNuevo ? 'bg-amber-950/10' : ''
                    }`}
                  >
                    {/* Badge Estado */}
                    <td className="px-3 py-2 whitespace-nowrap space-y-1">
                      {l.convertido_desde_pack ? (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                          ✓ Convertido
                        </span>
                      ) : esNuevo ? (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                          ⚠️ Nuevo
                        </span>
                      ) : (
                        <span className="bg-green-500/20 text-green-400 border border-green-500/40 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                          ✓ Catálogo
                        </span>
                      )}

                      {l.es_obsequio_probable && !l.convertido_desde_pack && (
                        <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 w-fit">
                          🎁 Obsequio (OBS)
                        </span>
                      )}

                      {l.es_combo_probable && !l.convertido_desde_pack && (
                        <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 w-fit">
                          📦 Pack x{l.factor_combo_sugerido || 2}
                        </span>
                      )}
                    </td>

                    {/* Producto */}
                    <td className="px-3 py-2 min-w-[220px]">
                      <p className="text-white font-semibold text-xs leading-tight truncate">{l.nombre}</p>
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-dark-400 mt-0.5">
                        <span className="font-mono bg-dark-900 px-1 rounded border border-dark-700">{l.codigo || 'S/C'}</span>
                        {l.codigo_barras && <span>📦 {l.codigo_barras}</span>}
                        {l.lote && (
                          <span className="text-emerald-300 bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.2 rounded font-mono font-bold">
                            🏷️ Lote: {l.lote}
                          </span>
                        )}
                        {l.vencimiento && (
                          <span className="text-amber-300 bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.2 rounded font-mono font-bold">
                            📅 Vence: {l.vencimiento}
                          </span>
                        )}
                        {l.maneja_fracciones && (
                          <span className="text-primary-300 bg-primary-950/60 border border-primary-800/60 px-1 rounded font-medium">
                            Fracción (Caja x{l.contenido_caja})
                          </span>
                        )}
                        {l.nombre_origen_pack && (
                          <span className="text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 px-1 rounded font-medium">
                            Orig: {l.nombre_origen_pack}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Cantidad */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="input-field w-20 py-1 px-1 text-center font-mono text-xs"
                        value={l.cantidad}
                        onChange={e => setLineaCampo(l.key, 'cantidad', parseFloat(e.target.value) || 1)}
                      />
                    </td>

                    {/* Costo Unitario */}
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="input-field w-24 py-1 px-2 font-mono text-xs"
                        value={l.costo_unitario}
                        onChange={e => handleCambioCosto(l.key, e.target.value)}
                      />
                    </td>

                    {/* % Ganancia */}
                    <td className="px-2 py-2">
                      <div className="relative w-20">
                        <input
                          type="number"
                          step="any"
                          className="input-field w-full py-1 pl-2 pr-5 font-mono text-xs font-bold text-primary-300"
                          value={l.porcentaje_ganancia}
                          onChange={e => handleCambioMargen(l.key, e.target.value)}
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-dark-500 text-[11px] pointer-events-none">%</span>
                      </div>
                    </td>

                    {/* P. Venta Sugerido */}
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="input-field w-26 py-1 px-2 font-mono text-xs font-bold text-white border-primary-500/40"
                        value={l.precio_sugerido}
                        onChange={e => handleCambioPrecioVenta(l.key, e.target.value)}
                      />
                      <span className="text-[10px] text-green-400 font-mono block mt-0.5">
                        +{formatCOP(gananciaUnitaria)} util.
                      </span>
                    </td>

                    {/* IVA % */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        className="input-field w-14 py-1 px-1 text-center font-mono text-xs"
                        value={l.iva_porcentaje || 0}
                        onChange={e => setLineaCampo(l.key, 'iva_porcentaje', parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    {/* Subtotal */}
                    <td className="px-3 py-2 text-right font-mono font-bold text-primary-400 whitespace-nowrap">
                      {formatCOP(l.cantidad * l.costo_unitario * (1 + (l.iva_porcentaje || 0) / 100))}
                    </td>

                    {/* Acciones */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {(l.es_obsequio_probable || l.es_combo_probable || l.convertido_desde_pack || l.costo_unitario === 0) ? (
                          <button
                            type="button"
                            onClick={() => abrirModalConvertidor(l)}
                            className="p-1 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 hover:text-indigo-200 border border-indigo-700/60 text-indigo-300 transition-colors flex items-center gap-1 px-2 py-1 text-[11px] font-bold shadow-sm"
                            title="Convertir Obsequio (OBS) o Desempacar Pack/Combo a Unidades"
                          >
                            <Gift size={13} />
                            <span>Convertir</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => abrirModalConvertidor(l)}
                            className="p-1 rounded-lg bg-dark-700 hover:bg-indigo-950/60 hover:text-indigo-300 hover:border-indigo-600/50 border border-dark-600 text-dark-400 transition-colors"
                            title="Desempacar Pack o Vincular a otro Producto"
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => abrirModalParametrizar(l)}
                          className="p-1 rounded-lg bg-dark-700 hover:bg-primary-900/40 hover:text-primary-300 hover:border-primary-500/50 border border-dark-600 text-dark-300 transition-colors"
                          title="Parametrizar Fracciones, Códigos de Barra y Márgenes"
                        >
                          <Settings size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setLineas(prev => prev.filter(x => x.key !== l.key))}
                          className="p-1 rounded-lg text-dark-500 hover:text-red-400 transition-colors"
                          title="Quitar de la lista"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card text-center py-12 space-y-3 border-dashed border-dark-700">
          <div className="w-14 h-14 bg-dark-700/60 rounded-full flex items-center justify-center mx-auto text-dark-400">
            <Package size={28} />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">No hay productos en la orden de compra</h3>
            <p className="text-dark-500 text-xs mt-1">
              Haz clic en <strong>"📄 Cargar Factura Excel / CSV"</strong> o busca productos arriba para agregarlos manualmente.
            </p>
          </div>
        </div>
      )}

      {/* Barra inferior: Total y Guardar */}
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <span className="text-dark-400 text-xs uppercase tracking-wide font-semibold block">Total de la Compra</span>
          <p className="text-2xl font-bold font-mono text-primary-400">{formatCOP(total)}</p>
        </div>

        <button
          className="btn-primary px-8 py-3 text-sm font-bold shadow-lg shadow-primary-900/30 flex items-center gap-2"
          onClick={guardar}
          disabled={guardando || lineas.length === 0}
        >
          {guardando ? (
            <>
              <RefreshCw size={16} className="animate-spin text-white" />
              <span>Guardando y Actualizando Inventario...</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={18} />
              <span>Registrar Compra y Actualizar Stock ({lineas.length} ítems)</span>
            </>
          )}
        </button>
      </div>
      </div>
      )}

      {/* ── PESTAÑA: HISTORIAL DE FACTURAS REGISTRADAS ─────────────────────── */}
      {tabActiva === 'HISTORIAL' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Barra de Búsqueda y Filtros */}
          <div className="card flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                type="text"
                className="input-field pl-9 pr-4 py-2 text-xs w-full font-medium"
                placeholder="Buscar por N° Comprobante (CO-0001), N° Factura Proveedor o Nombre del Proveedor..."
                value={filtroHistorial}
                onChange={e => {
                  setFiltroHistorial(e.target.value)
                  clearTimeout(window._ht)
                  window._ht = setTimeout(() => cargarHistorial(e.target.value), 250)
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => cargarHistorial(filtroHistorial)}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw size={14} className={cargandoHistorial ? 'animate-spin' : ''} />
              <span>Actualizar</span>
            </button>
          </div>

          {/* Tabla de Facturas de Compras */}
          <div className="card p-0 overflow-hidden border border-dark-700/80 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-900 text-dark-400 text-[11px] uppercase tracking-wider font-semibold border-b border-dark-700">
                  <tr>
                    <th className="px-4 py-3">Comprobante</th>
                    <th className="px-4 py-3">N° Factura Proveedor</th>
                    <th className="px-4 py-3">Fecha y Hora</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3 text-center">Ítems</th>
                    <th className="px-4 py-3 text-right">Total Factura</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/60">
                  {cargandoHistorial ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-dark-400">
                        <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-primary-400" />
                        <p className="text-xs">Cargando facturas registradas...</p>
                      </td>
                    </tr>
                  ) : historialCompras.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-dark-400">
                        <div className="w-12 h-12 bg-dark-700/60 rounded-full flex items-center justify-center mx-auto mb-2 text-dark-500">
                          <History size={24} />
                        </div>
                        <p className="font-semibold text-white text-xs">No se encontraron facturas registradas</p>
                        <p className="text-[11px] text-dark-500 mt-0.5">
                          Las compras que guardes o importes aparecerán en este historial para consulta permanente.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    historialCompras.map(comp => (
                      <tr key={comp.id} className="hover:bg-dark-700/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-primary-400 whitespace-nowrap">
                          {comp.numero}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-white">
                          {comp.numero_factura_proveedor ? (
                            <span className="font-mono bg-dark-900 px-1.5 py-0.5 rounded border border-dark-700">
                              {comp.numero_factura_proveedor}
                            </span>
                          ) : (
                            <span className="text-dark-500 italic">S/N</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-dark-300 whitespace-nowrap text-[11px]">
                          {comp.fecha ? new Date(comp.fecha).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-white font-semibold text-xs">{comp.proveedor_nombre}</p>
                          {comp.proveedor_nit && (
                            <span className="text-[10px] text-dark-500 font-mono">NIT: {comp.proveedor_nit}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-dark-300">
                          {comp.total_items}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-green-400 whitespace-nowrap text-sm">
                          {formatCOP(comp.total)}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => abrirDetalleCompra(comp.id)}
                            className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1.5 hover:text-primary-300 hover:border-primary-500/50 shadow-sm"
                            title="Revisar qué productos ingresaron en esta factura"
                          >
                            <Eye size={14} />
                            <span>Ver Detalle</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PARAMETRIZACIÓN COMPLETA Y DESGLOSE DE FRACCIONES ──── */}
      {modalParametrizar && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModalParametrizar(null)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-dark-600 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-4 border-b border-dark-700 flex justify-between items-center bg-dark-900/50">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings size={18} className="text-primary-400" />
                  Parametrizar Producto y Fracciones
                </h3>
                <p className="text-dark-400 text-xs mt-0.5">
                  {modalParametrizar.estado === 'NUEVO' ? 'Alta de Nuevo Producto' : 'Actualización de Parámetros de Catálogo'}
                </p>
              </div>
              <button
                onClick={() => setModalParametrizar(null)}
                className="text-dark-500 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardarModalParametrizar} className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* 1. Datos Básicos */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-primary-400 uppercase tracking-wider block">
                  1. Información General y Códigos
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-dark-400 mb-1">Nombre Comercial del Producto *</label>
                    <input
                      className="input-field py-1.5 text-xs font-semibold"
                      value={modalParametrizar.nombre}
                      onChange={e => setModalParametrizar({ ...modalParametrizar, nombre: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">Código Interno / SKU *</label>
                    <input
                      className="input-field py-1.5 text-xs font-mono"
                      value={modalParametrizar.codigo}
                      onChange={e => setModalParametrizar({ ...modalParametrizar, codigo: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">📦 Código Barras Caja</label>
                    <input
                      className="input-field py-1.5 text-xs font-mono"
                      placeholder="Escanear..."
                      value={modalParametrizar.codigo_barras || ''}
                      onChange={e => setModalParametrizar({ ...modalParametrizar, codigo_barras: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">
                      📑 Código Barras Blister
                      {modalParametrizar.maneja_fracciones && (
                        ((parseInt(modalParametrizar.contenido_caja) || 1) <= 1 || (parseInt(modalParametrizar.contenido_blister) || 0) <= 1) && (
                          <span className="text-[10px] text-dark-500 ml-1">(No aplica)</span>
                        )
                      )}
                    </label>
                    <input
                      className={`input-field py-1.5 text-xs font-mono ${
                        modalParametrizar.maneja_fracciones &&
                        ((parseInt(modalParametrizar.contenido_caja) || 1) <= 1 || (parseInt(modalParametrizar.contenido_blister) || 0) <= 1)
                          ? 'bg-dark-800/50 text-dark-500 border-dark-700 cursor-not-allowed'
                          : ''
                      }`}
                      placeholder={
                        modalParametrizar.maneja_fracciones &&
                        ((parseInt(modalParametrizar.contenido_caja) || 1) <= 1 || (parseInt(modalParametrizar.contenido_blister) || 0) <= 1)
                          ? 'No aplica (Sin blíster)'
                          : 'Escanear...'
                      }
                      disabled={
                        modalParametrizar.maneja_fracciones &&
                        ((parseInt(modalParametrizar.contenido_caja) || 1) <= 1 || (parseInt(modalParametrizar.contenido_blister) || 0) <= 1)
                      }
                      value={modalParametrizar.codigo_barras_blister || ''}
                      onChange={e => setModalParametrizar({ ...modalParametrizar, codigo_barras_blister: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">
                      💊 Código Barras Unidad
                      {modalParametrizar.maneja_fracciones && ((parseInt(modalParametrizar.contenido_caja) || 1) <= 1) && (
                        <span className="text-[10px] text-dark-500 ml-1">(No aplica: 1 unidad)</span>
                      )}
                    </label>
                    <input
                      className={`input-field py-1.5 text-xs font-mono ${
                        modalParametrizar.maneja_fracciones && ((parseInt(modalParametrizar.contenido_caja) || 1) <= 1)
                          ? 'bg-dark-800/50 text-dark-500 border-dark-700 cursor-not-allowed'
                          : ''
                      }`}
                      placeholder={
                        modalParametrizar.maneja_fracciones && ((parseInt(modalParametrizar.contenido_caja) || 1) <= 1)
                          ? 'No aplica (Caja de 1 unidad)'
                          : 'Escanear...'
                      }
                      disabled={modalParametrizar.maneja_fracciones && ((parseInt(modalParametrizar.contenido_caja) || 1) <= 1)}
                      value={modalParametrizar.codigo_barras_unidad || ''}
                      onChange={e => setModalParametrizar({ ...modalParametrizar, codigo_barras_unidad: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">🧪 Sustancia / Principio Activo</label>
                    <input
                      className="input-field py-1.5 text-xs"
                      placeholder="Ej: Acetaminofen 500mg"
                      value={modalParametrizar.principio_activo || ''}
                      onChange={e => setModalParametrizar({ ...modalParametrizar, principio_activo: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1">🏷️ Laboratorio / Fabricante</label>
                    <input
                      className="input-field py-1.5 text-xs"
                      placeholder="Ej: Genfar, MK, Lafrancol..."
                      value={modalParametrizar.laboratorio || ''}
                      onChange={e => setModalParametrizar({ ...modalParametrizar, laboratorio: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Calculadora Bidireccional de Costo, Margen y Precio */}
              <div className="space-y-3 pt-3 border-t border-dark-700">
                <span className="text-xs font-bold text-primary-400 uppercase tracking-wider block">
                  2. Costo y Calculadora Bidireccional de Ganancia
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-dark-900/60 p-3.5 rounded-xl border border-dark-700">
                  <div>
                    <label className="block text-[11px] text-dark-400 mb-1 font-semibold">Costo de Compra Unitario ($) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input-field py-1.5 text-xs font-mono font-bold"
                      value={modalParametrizar.costo_unitario}
                      onChange={e => {
                        const c = parseFloat(e.target.value) || 0
                        const m = modalParametrizar.porcentaje_ganancia || margenPredeterminado
                        const p = calcularPrecioDesdeCosto(c, m, modoRedondeo)
                        setModalParametrizar({
                          ...modalParametrizar,
                          costo_unitario: c,
                          precio_sugerido: p,
                          precio_caja: modalParametrizar.maneja_fracciones ? p : modalParametrizar.precio_caja,
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
                        value={modalParametrizar.porcentaje_ganancia}
                        onChange={e => {
                          const m = parseFloat(e.target.value) || 0
                          const p = calcularPrecioDesdeCosto(modalParametrizar.costo_unitario, m, modoRedondeo)
                          setModalParametrizar({
                            ...modalParametrizar,
                            porcentaje_ganancia: m,
                            precio_sugerido: p,
                            precio_caja: modalParametrizar.maneja_fracciones ? p : modalParametrizar.precio_caja,
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
                      value={modalParametrizar.precio_sugerido}
                      onChange={e => {
                        const p = parseFloat(e.target.value) || 0
                        const c = modalParametrizar.costo_unitario
                        const m = calcularMargenDesdePrecio(c, p)
                        setModalParametrizar({
                          ...modalParametrizar,
                          precio_sugerido: p,
                          porcentaje_ganancia: m,
                          precio_caja: modalParametrizar.maneja_fracciones ? p : modalParametrizar.precio_caja,
                        })
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 3. Desglose y Fraccionamiento */}
              <div className="space-y-3 pt-3 border-t border-dark-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary-400 uppercase tracking-wider block">
                      3. Desglose y Fraccionamiento (Cajas / Blisters / Unidades)
                    </span>
                    {modalParametrizar.maneja_fracciones && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        (parseInt(modalParametrizar.contenido_caja) || 1) <= 1
                          ? 'bg-dark-800 text-dark-400 border border-dark-600'
                          : (parseInt(modalParametrizar.contenido_blister) || 0) > 1
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-green-950 text-green-300 border border-green-800'
                      }`}>
                        {(parseInt(modalParametrizar.contenido_caja) || 1) <= 1
                          ? '⚪ Producto Unitario (1 unidad — Sin Fraccionar)'
                          : (parseInt(modalParametrizar.contenido_blister) || 0) > 1
                          ? `📦 Caja x${modalParametrizar.contenido_caja} + 📑 Blíster x${modalParametrizar.contenido_blister} + 💊 Unidad`
                          : `📦 Caja x${modalParametrizar.contenido_caja} + 💊 Unidad Directa (Sin Blíster)`}
                      </span>
                    )}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                    <input
                      type="checkbox"
                      checked={modalParametrizar.maneja_fracciones || false}
                      onChange={e => {
                        const activa = e.target.checked
                        setModalParametrizar({
                          ...modalParametrizar,
                          maneja_fracciones: activa,
                          precio_caja: activa ? modalParametrizar.precio_sugerido : 0,
                        })
                      }}
                      className="rounded bg-dark-700 border-dark-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span>Habilitar Fraccionamiento</span>
                  </label>
                </div>

                {modalParametrizar.maneja_fracciones && (
                  <div className="space-y-3 bg-dark-900/60 p-4 rounded-xl border border-primary-600/30">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-dark-400 mb-1">Contenido de la Caja (Unidades totales)</label>
                        <input
                          type="number"
                          min="1"
                          className="input-field py-1.5 text-xs font-mono"
                          value={modalParametrizar.contenido_caja || 1}
                          onChange={e => {
                            const cVal = parseInt(e.target.value) || 1
                            setModalParametrizar({
                              ...modalParametrizar,
                              contenido_caja: cVal,
                              precio_unidad: cVal <= 1 ? 0 : modalParametrizar.precio_unidad,
                              precio_blister: cVal <= 1 ? 0 : modalParametrizar.precio_blister,
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
                          disabled={(parseInt(modalParametrizar.contenido_caja) || 1) <= 1}
                          className={`input-field py-1.5 text-xs font-mono ${
                            (parseInt(modalParametrizar.contenido_caja) || 1) <= 1
                              ? 'bg-dark-800/50 text-dark-500 border-dark-700 cursor-not-allowed'
                              : ''
                          }`}
                          value={(parseInt(modalParametrizar.contenido_caja) || 1) <= 1 ? 0 : (modalParametrizar.contenido_blister || 0)}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0
                            setModalParametrizar({
                              ...modalParametrizar,
                              contenido_blister: val,
                              precio_blister: val <= 1 ? 0 : modalParametrizar.precio_blister,
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
                          value={modalParametrizar.precio_caja || modalParametrizar.precio_sugerido}
                          onChange={e => setModalParametrizar({ ...modalParametrizar, precio_caja: parseFloat(e.target.value) || 0 })}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-dark-400 mb-1">
                          📑 Precio Venta Blister ($)
                          {((parseInt(modalParametrizar.contenido_caja) || 1) <= 1 || (parseInt(modalParametrizar.contenido_blister) || 0) <= 1) ? (
                            <span className="text-[10px] text-dark-500 ml-1">(No aplica)</span>
                          ) : (
                            <span className="text-[10px] text-dark-500 block font-normal">(0 = No vender blister)</span>
                          )}
                        </label>
                        <input
                          type="number"
                          step="any"
                          disabled={
                            (parseInt(modalParametrizar.contenido_caja) || 1) <= 1 ||
                            (parseInt(modalParametrizar.contenido_blister) || 0) <= 1
                          }
                          className={`input-field py-1.5 text-xs font-mono font-bold ${
                            (parseInt(modalParametrizar.contenido_caja) || 1) <= 1 ||
                            (parseInt(modalParametrizar.contenido_blister) || 0) <= 1
                              ? 'bg-dark-800/50 text-dark-500 border-dark-700 cursor-not-allowed'
                              : 'text-blue-300'
                          }`}
                          value={
                            (parseInt(modalParametrizar.contenido_caja) || 1) <= 1 ||
                            (parseInt(modalParametrizar.contenido_blister) || 0) <= 1
                              ? 0
                              : (modalParametrizar.precio_blister ?? 0)
                          }
                          onChange={e => setModalParametrizar({ ...modalParametrizar, precio_blister: parseFloat(e.target.value) || 0 })}
                          placeholder="0 = No vender blister"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-dark-400 mb-1">
                          💊 Precio Venta Unidad ($)
                          {((parseInt(modalParametrizar.contenido_caja) || 1) <= 1) ? (
                            <span className="text-[10px] text-dark-500 ml-1">(1 unidad)</span>
                          ) : (
                            <span className="text-[10px] text-emerald-400/80 block font-normal">(0 = NO vender suelto)</span>
                          )}
                        </label>
                        <input
                          type="number"
                          step="any"
                          disabled={(parseInt(modalParametrizar.contenido_caja) || 1) <= 1}
                          className={`input-field py-1.5 text-xs font-mono font-bold ${
                            (parseInt(modalParametrizar.contenido_caja) || 1) <= 1
                              ? 'bg-dark-800/50 text-dark-500 border-dark-700 cursor-not-allowed'
                              : 'text-green-300'
                          }`}
                          value={(parseInt(modalParametrizar.contenido_caja) || 1) <= 1 ? 0 : (modalParametrizar.precio_unidad ?? 0)}
                          onChange={e => setModalParametrizar({ ...modalParametrizar, precio_unidad: parseFloat(e.target.value) || 0 })}
                          placeholder="0 = No vender suelto"
                        />
                      </div>
                    </div>

                    {/* Botón de auto-sugerir precios de blister y unidad */}
                    <button
                      type="button"
                      onClick={() => {
                        const cajaPrecio = modalParametrizar.precio_caja || modalParametrizar.precio_sugerido || 0
                        const totalU = parseInt(modalParametrizar.contenido_caja) || 1
                        const uBlister = parseInt(modalParametrizar.contenido_blister) || 0

                        if (totalU <= 1) {
                          setModalParametrizar({
                            ...modalParametrizar,
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

                        setModalParametrizar({
                          ...modalParametrizar,
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
                        ((parseInt(modalParametrizar.contenido_caja) || 1) <= 1)
                          ? '(Caja de 1 Unidad)'
                          : ((parseInt(modalParametrizar.contenido_blister) || 0) <= 1)
                          ? 'de Unidad Individual (Sin Blíster)'
                          : 'de Blíster y Unidad'
                      }
                    </button>
                  </div>
                )}
              </div>

              {/* Botones del Modal */}
              <div className="flex gap-3 pt-3 border-t border-dark-700">
                <button
                  type="button"
                  onClick={() => setModalParametrizar(null)}
                  className="btn-secondary flex-1 py-2.5 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoProductoModal}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold"
                >
                  {guardandoProductoModal ? 'Guardando...' : '✓ Guardar y Asociar a la Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── MODAL: CONVERTIDOR DE OBSEQUIOS (OBS) Y DESAGREGADOR DE PACKS (DTE) ── */}
      {modalConvertidor && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-dark-800 border border-indigo-700/50 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 my-8">
            {/* Cabecera */}
            <div className="flex items-start justify-between border-b border-dark-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-700/60 text-indigo-400 flex items-center justify-center">
                  <Gift size={22} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base flex items-center gap-2">
                    Convertidor de Obsequios y Packs
                  </h3>
                  <p className="text-dark-400 text-xs">
                    Transforma ítems de factura (OBS, 2 DTE, Packs, Combos) a productos de tu catálogo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalConvertidor(null)}
                className="text-dark-400 hover:text-white p-1 rounded-lg hover:bg-dark-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Ficha del ítem origen en factura */}
            <div className="bg-dark-900/80 p-3.5 rounded-xl border border-dark-700/80 space-y-2">
              <span className="text-[10px] text-dark-500 font-bold uppercase tracking-wider block">
                📄 Ítem detectado en la factura de compra:
              </span>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {modalConvertidor.linea.nombre_original || modalConvertidor.linea.nombre}
                  </p>
                  <p className="text-dark-400 text-xs font-mono">
                    Cant. Facturada: <strong className="text-white">{modalConvertidor.linea.cantidad}</strong> · 
                    Costo Facturado: <strong className="text-primary-300">{formatCOP(modalConvertidor.linea.costo_unitario)}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Selector de Modo */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCambioModoOParametros({ modo: 'DESEMPACAR_PACK' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  modalConvertidor.modo === 'DESEMPACAR_PACK'
                    ? 'bg-indigo-950/70 border-indigo-500 ring-1 ring-indigo-500/40 text-white'
                    : 'bg-dark-700/40 border-dark-700 text-dark-400 hover:border-dark-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Boxes size={16} className={modalConvertidor.modo === 'DESEMPACAR_PACK' ? 'text-indigo-400' : 'text-dark-400'} />
                  <span className="text-xs font-bold">1. Desempacar Combo / Pack</span>
                </div>
                <p className="text-[11px] leading-tight text-dark-400">
                  Para <strong>2 DTE</strong>, dúo packs, 2x1 o combos. Divide el costo y multiplica la cantidad en unidades.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleCambioModoOParametros({ modo: 'OBSEQUIO' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  modalConvertidor.modo === 'OBSEQUIO'
                    ? 'bg-purple-950/70 border-purple-500 ring-1 ring-purple-500/40 text-white'
                    : 'bg-dark-700/40 border-dark-700 text-dark-400 hover:border-dark-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Gift size={16} className={modalConvertidor.modo === 'OBSEQUIO' ? 'text-purple-400' : 'text-dark-400'} />
                  <span className="text-xs font-bold">2. Obsequio / Bonificación</span>
                </div>
                <p className="text-[11px] leading-tight text-dark-400">
                  Para <strong>OBS</strong>, muestras o regalos sin costo. Lo asocia al producto regular conservando su precio de venta.
                </p>
              </button>
            </div>

            {/* Parámetros según el modo */}
            {modalConvertidor.modo === 'DESEMPACAR_PACK' && (
              <div className="bg-indigo-950/30 border border-indigo-800/40 p-3 rounded-xl space-y-2">
                <label className="block text-xs text-indigo-300 font-semibold">
                  ¿Cuántas unidades individuales contiene cada pack facturado?
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    className="input-field w-24 py-1.5 px-2 font-mono text-sm font-bold text-center border-indigo-500"
                    value={modalConvertidor.factor}
                    onChange={e => handleCambioModoOParametros({ factor: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                  <span className="text-xs text-dark-400">
                    Ej: Si compraste <strong>5 packs de 2 desodorantes</strong>, escribe <strong>2</strong> (ingresarán 10 unidades a mitad de costo).
                  </span>
                </div>
              </div>
            )}

            {modalConvertidor.modo === 'OBSEQUIO' && (
              <div className="bg-purple-950/30 border border-purple-800/40 p-3 rounded-xl space-y-2 text-xs">
                <label className="block text-purple-300 font-semibold">Tratamiento del costo de ingreso:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                    modalConvertidor.costoTratamiento === 'CERO' ? 'bg-purple-900/40 border-purple-500 text-white' : 'border-dark-700 text-dark-400'
                  }`}>
                    <input
                      type="radio"
                      name="costoTratamiento"
                      checked={modalConvertidor.costoTratamiento === 'CERO'}
                      onChange={() => handleCambioModoOParametros({ costoTratamiento: 'CERO' })}
                      className="text-purple-600"
                    />
                    <div>
                      <p className="font-bold text-xs">Costo $0 (Recomendado)</p>
                      <p className="text-[10px] text-dark-400">100% de ganancia en la venta</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                    modalConvertidor.costoTratamiento === 'PROMEDIO' ? 'bg-purple-900/40 border-purple-500 text-white' : 'border-dark-700 text-dark-400'
                  }`}>
                    <input
                      type="radio"
                      name="costoTratamiento"
                      checked={modalConvertidor.costoTratamiento === 'PROMEDIO'}
                      onChange={() => handleCambioModoOParametros({ costoTratamiento: 'PROMEDIO' })}
                      className="text-purple-600"
                    />
                    <div>
                      <p className="font-bold text-xs">Usar Costo del Catálogo</p>
                      <p className="text-[10px] text-dark-400">Mantener costo de referencia</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Buscador de Producto Destino en Catálogo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-dark-300 font-semibold flex items-center gap-1.5">
                  <Search size={14} className="text-primary-400" />
                  Buscar Producto Individual Destino en Catálogo:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const l = modalConvertidor.linea
                    const factor = modalConvertidor.modo === 'DESEMPACAR_PACK' ? Math.max(1, parseInt(modalConvertidor.factor) || 1) : 1
                    const cUnit = modalConvertidor.modo === 'OBSEQUIO' ? 0 : (l.costo_unitario / factor)
                    const pSug = calcularPrecioDesdeCosto(cUnit, margenPredeterminado, modoRedondeo)
                    setModalConvertidor(null)
                    abrirModalParametrizar({
                      ...l,
                      estado: 'NUEVO',
                      producto_id: null,
                      nombre: busqDestino || l.nombre,
                      cantidad: l.cantidad * factor,
                      costo_unitario: cUnit,
                      precio_sugerido: pSug,
                      precio_caja: pSug,
                    })
                  }}
                  className="text-xs text-primary-400 hover:text-primary-300 underline font-medium"
                >
                  + Crear como producto nuevo
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  className="input-field py-2 pl-9 pr-3 text-xs w-full font-medium"
                  placeholder="Escribe el nombre o código del producto regular (ej: REXONA CLINICAL)..."
                  value={busqDestino}
                  onChange={e => {
                    setBusqDestino(e.target.value)
                    buscarProductosDestino(e.target.value)
                  }}
                />
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              </div>

              {/* Lista de resultados encontrados */}
              {resultadosDestino.length > 0 && (
                <div className="divide-y divide-dark-700/60 max-h-48 overflow-y-auto bg-dark-900 rounded-xl border border-dark-700">
                  {resultadosDestino.map(p => {
                    const seleccionado = modalConvertidor.productoDestino?.id === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSeleccionarProductoDestino(p)}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-left transition-colors ${
                          seleccionado ? 'bg-primary-950/60 border-l-4 border-primary-500' : 'hover:bg-dark-800'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className={`text-xs font-bold truncate ${seleccionado ? 'text-primary-300' : 'text-white'}`}>
                            {p.nombre}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-dark-400">
                            <span className="font-mono">{p.codigo}</span>
                            {p.principio_activo && <span>· 🧪 {p.principio_activo}</span>}
                            <span>· Stock actual: <strong className="text-white">{p.stock_actual}</strong></span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-primary-400 font-bold font-mono text-xs block">
                            {formatCOP(p.precio_venta)}
                          </span>
                          <span className="text-[10px] text-dark-500">Costo: {formatCOP(p.precio_costo)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Resumen / Previsualización y Edición de Precios de la Conversión */}
            {modalConvertidor.productoDestino && (
              <div className="bg-dark-900 p-4 rounded-xl border border-emerald-500/40 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-dark-700/80 pb-2">
                  <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={15} /> Parámetros Finales de Ingreso y Venta al Público:
                  </span>
                  <span className="text-[11px] text-dark-400">
                    Producto vinculado: <strong className="text-white">{modalConvertidor.productoDestino.nombre}</strong>
                  </span>
                </div>

                {/* Selector de Estrategia de Costo en Modal */}
                {parseFloat(modalConvertidor.productoDestino.stock_actual || 0) > 0 && parseFloat(modalConvertidor.productoDestino.precio_costo || 0) > 0 && (
                  <div className="bg-dark-800 p-3 rounded-xl border border-primary-700/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                        ⚖️ Estrategia de Costo para Inventario:
                      </span>
                      <span className="text-[10px] text-dark-400 font-mono">
                        Stock en BD: <strong className="text-white">{modalConvertidor.productoDestino.stock_actual}</strong> @ <span className="text-dark-300">{formatCOP(modalConvertidor.productoDestino.precio_costo)}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCambioEstrategiaModalConvertidor('PROMEDIO_PONDERADO')}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          (modalConvertidor.estrategiaCosto || estrategiaCostoGlobal || 'PROMEDIO_PONDERADO') === 'PROMEDIO_PONDERADO'
                            ? 'bg-primary-900/60 border-primary-500 text-white shadow-sm ring-1 ring-primary-500/50'
                            : 'bg-dark-900 border-dark-700 text-dark-400 hover:text-white'
                        }`}
                      >
                        <span className="text-[10px] font-bold block text-primary-300">⚖️ Promedio Ponderado</span>
                        <span className="text-xs font-mono font-bold text-white">{formatCOP(modalConvertidor.costoPromedioPonderado || modalConvertidor.costoFacturaUnit)}</span>
                        <span className="text-[9px] text-dark-400 block mt-0.5">Equilibrado</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCambioEstrategiaModalConvertidor('COSTO_MAS_ALTO')}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          (modalConvertidor.estrategiaCosto || estrategiaCostoGlobal) === 'COSTO_MAS_ALTO'
                            ? 'bg-amber-900/60 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/50'
                            : 'bg-dark-900 border-dark-700 text-dark-400 hover:text-white'
                        }`}
                      >
                        <span className="text-[10px] font-bold block text-amber-300">🛡️ Costo Más Alto</span>
                        <span className="text-xs font-mono font-bold text-white">{formatCOP(modalConvertidor.costoMasAlto || modalConvertidor.costoFacturaUnit)}</span>
                        <span className="text-[9px] text-dark-400 block mt-0.5">Protege Margen</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCambioEstrategiaModalConvertidor('ULTIMO_COSTO')}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          (modalConvertidor.estrategiaCosto || estrategiaCostoGlobal) === 'ULTIMO_COSTO'
                            ? 'bg-blue-900/60 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50'
                            : 'bg-dark-900 border-dark-700 text-dark-400 hover:text-white'
                        }`}
                      >
                        <span className="text-[10px] font-bold block text-blue-300">🔄 Último Factura</span>
                        <span className="text-xs font-mono font-bold text-white">{formatCOP(modalConvertidor.costoUltimo || modalConvertidor.costoFacturaUnit)}</span>
                        <span className="text-[9px] text-dark-400 block mt-0.5">Factura actual</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  {/* Cantidad */}
                  <div className="bg-dark-800 p-2.5 rounded-xl border border-dark-700">
                    <span className="text-dark-400 text-[11px] block font-medium">📦 Cantidad a ingresar:</span>
                    <p className="text-white font-bold font-mono text-base mt-0.5">
                      {modalConvertidor.modo === 'DESEMPACAR_PACK'
                        ? `${modalConvertidor.linea.cantidad * Math.max(1, parseInt(modalConvertidor.factor) || 1)} unid.`
                        : `${modalConvertidor.linea.cantidad} unid.`}
                    </p>
                    {modalConvertidor.modo === 'DESEMPACAR_PACK' && (
                      <span className="text-[10px] text-indigo-300">
                        {modalConvertidor.linea.cantidad} packs × {modalConvertidor.factor} u
                      </span>
                    )}
                  </div>

                  {/* Costo Unitario */}
                  <div className="bg-dark-800 p-2.5 rounded-xl border border-dark-700">
                    <span className="text-dark-400 text-[11px] block font-medium">💲 Costo Resultante:</span>
                    <p className="text-emerald-400 font-bold font-mono text-base mt-0.5">
                      {formatCOP(modalConvertidor.costoEfectivo || (
                        modalConvertidor.modo === 'OBSEQUIO'
                          ? (modalConvertidor.costoTratamiento === 'CERO' ? 0 : parseFloat(modalConvertidor.productoDestino.precio_costo || 0))
                          : (modalConvertidor.linea.costo_unitario / Math.max(1, parseInt(modalConvertidor.factor) || 1))
                      ))}
                    </p>
                    <span className="text-[10px] text-dark-500">
                      {modalConvertidor.costoPromedioPonderado && modalConvertidor.costoEfectivo === modalConvertidor.costoPromedioPonderado
                        ? '(Promedio Ponderado)'
                        : modalConvertidor.costoMasAlto && modalConvertidor.costoEfectivo === modalConvertidor.costoMasAlto
                        ? '(Costo Techo)'
                        : 'por cada unidad'}
                    </span>
                  </div>

                  {/* % Margen de Ganancia (Editable) */}
                  <div className="bg-dark-800 p-2.5 rounded-xl border border-primary-800/60">
                    <label className="text-primary-300 text-[11px] block font-bold mb-1">
                      % Margen Ganancia:
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        className="input-field w-full py-1 pl-2 pr-6 font-mono text-xs font-bold text-primary-300 bg-dark-900 border-primary-600/50"
                        value={modalConvertidor.margenPersonalizado !== null && modalConvertidor.margenPersonalizado !== undefined ? modalConvertidor.margenPersonalizado : 30}
                        onChange={e => handleCambioMargenModalConvertidor(e.target.value)}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 text-xs font-bold">%</span>
                    </div>
                  </div>

                  {/* Precio de Venta al Público (Editable) */}
                  <div className="bg-dark-800 p-2.5 rounded-xl border border-green-800/60">
                    <label className="text-green-300 text-[11px] block font-bold mb-1">
                      🏷️ Precio Venta Final:
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input-field w-full py-1 px-2 font-mono text-xs font-bold text-green-300 bg-dark-900 border-green-600/50"
                      value={modalConvertidor.precioVentaPersonalizado !== null && modalConvertidor.precioVentaPersonalizado !== undefined ? modalConvertidor.precioVentaPersonalizado : 0}
                      onChange={e => handleCambioPrecioModalConvertidor(e.target.value)}
                    />
                    <span className="text-[10px] text-green-400/80 font-mono block mt-1">
                      Ganancia: +{formatCOP(
                        Math.max(0, (modalConvertidor.precioVentaPersonalizado || 0) - (
                          modalConvertidor.costoEfectivo || (
                            modalConvertidor.modo === 'OBSEQUIO'
                              ? (modalConvertidor.costoTratamiento === 'CERO' ? 0 : parseFloat(modalConvertidor.productoDestino?.precio_costo || 0))
                              : (modalConvertidor.linea.costo_unitario / Math.max(1, parseInt(modalConvertidor.factor) || 1))
                          )
                        ))
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-3 pt-3 border-t border-dark-700">
              <button
                type="button"
                onClick={() => setModalConvertidor(null)}
                className="btn-secondary flex-1 py-2.5 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!modalConvertidor.productoDestino}
                onClick={handleConfirmarConversion}
                className="btn-primary flex-1 py-2.5 text-xs font-bold disabled:opacity-40 disabled:pointer-events-none"
              >
                ✓ Confirmar y Aplicar Conversión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ALERTA DE FACTURA DUPLICADA ───────────────────────────── */}
      {facturaDuplicadaModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-dark-800 border border-red-500/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400 border-b border-dark-700 pb-3">
              <div className="w-12 h-12 rounded-xl bg-red-950/90 border border-red-500/60 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-950/50">
                <ShieldAlert size={26} className="text-red-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Factura ya Registrada Previamente</h3>
                <p className="text-red-300/80 text-xs">Protección de Inventario contra Duplicidad</p>
              </div>
            </div>

            <div className="bg-dark-900 p-4 rounded-xl border border-dark-700 space-y-3 text-xs">
              <p className="text-dark-300">
                La factura <strong className="text-white">N° {facturaDuplicadaModal.numeroFactura}</strong> del proveedor <strong className="text-white">{facturaDuplicadaModal.proveedor}</strong> ya existe en el sistema:
              </p>

              <div className="p-3 bg-dark-800 rounded-lg border border-dark-700/80 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-dark-400 font-sans">Comprobante Interno:</span>
                  <span className="font-bold text-primary-400">{facturaDuplicadaModal.compraPrevia.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400 font-sans">Fecha de Ingreso:</span>
                  <span className="text-white font-medium">{new Date(facturaDuplicadaModal.compraPrevia.fecha).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400 font-sans">Total de la Factura:</span>
                  <span className="font-bold text-green-400">{formatCOP(facturaDuplicadaModal.compraPrevia.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400 font-sans">Ítems Registrados:</span>
                  <span className="text-white font-medium">{facturaDuplicadaModal.compraPrevia.total_items} productos</span>
                </div>
              </div>

              <div className="bg-amber-950/30 border border-amber-800/60 p-2.5 rounded-lg text-amber-300 text-[11px] leading-relaxed">
                ⚠️ <strong>Bloqueo de seguridad:</strong> Para no alterar tus existencias físicas ni duplicar costos en el kardex, el sistema no permite volver a procesar esta factura. Puedes consultar a continuación los productos que ingresaron en ella.
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFacturaDuplicadaModal(null)}
                className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const compId = facturaDuplicadaModal.compraPrevia.id
                  setFacturaDuplicadaModal(null)
                  abrirDetalleCompra(compId)
                }}
                className="btn-primary flex-1 py-2.5 text-xs font-bold bg-primary-600 hover:bg-primary-500 flex items-center justify-center gap-1.5 shadow-lg shadow-primary-900/40"
              >
                <Eye size={15} />
                <span>Revisar Detalle de la Factura</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VISOR DE DETALLE DE FACTURA DE COMPRA ─────────────────── */}
      {compraDetalleModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl max-w-4xl w-full p-5 shadow-2xl space-y-4 my-8 max-h-[92vh] flex flex-col">
            {/* Header del Modal */}
            <div className="flex items-start justify-between border-b border-dark-700 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-950 border border-primary-700/60 text-primary-400 flex items-center justify-center flex-shrink-0">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base flex items-center gap-2">
                    Detalle de Factura de Compra
                    <span className="font-mono text-xs bg-primary-950 text-primary-300 border border-primary-700/60 px-2 py-0.5 rounded">
                      {compraDetalleModal.numero}
                    </span>
                  </h3>
                  <p className="text-dark-400 text-xs">
                    Registro de ingreso a inventario y costos de adquisición
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 text-dark-300 hover:text-white"
                  title="Imprimir comprobante de compra"
                >
                  <Printer size={14} />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCompraDetalleModal(null)}
                  className="text-dark-400 hover:text-white p-1 rounded-lg hover:bg-dark-700 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Ficha de Información de la Compra */}
            <div className="bg-dark-900 p-4 rounded-xl border border-dark-700 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-dark-400 block text-[10px] uppercase font-semibold">Proveedor:</span>
                <p className="text-white font-bold">{compraDetalleModal.proveedor?.razon_social || 'Sin proveedor'}</p>
                {compraDetalleModal.proveedor?.nit && (
                  <span className="text-dark-500 font-mono text-[11px]">NIT: {compraDetalleModal.proveedor.nit}</span>
                )}
              </div>

              <div>
                <span className="text-dark-400 block text-[10px] uppercase font-semibold">N° Factura del Proveedor:</span>
                <p className="text-white font-mono font-bold">{compraDetalleModal.numero_factura_proveedor || 'S/N'}</p>
                <span className="text-dark-500 text-[11px]">Fecha: {new Date(compraDetalleModal.fecha).toLocaleString()}</span>
              </div>

              <div>
                <span className="text-dark-400 block text-[10px] uppercase font-semibold">Usuario Receptor:</span>
                <p className="text-white font-medium">{compraDetalleModal.usuario_nombre}</p>
                <span className="text-emerald-400 font-semibold text-[11px]">✓ Ingresado a Stock</span>
              </div>
            </div>

            {/* Tabla de Productos Ingresados */}
            <div className="flex-1 overflow-y-auto border border-dark-700 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-900 text-dark-400 text-[11px] uppercase tracking-wider font-semibold sticky top-0 border-b border-dark-700">
                  <tr>
                    <th className="px-3 py-2.5">Código</th>
                    <th className="px-3 py-2.5">Producto</th>
                    <th className="px-3 py-2.5 text-center">Cant. Ingresada</th>
                    <th className="px-3 py-2.5 text-right">Costo Unit.</th>
                    <th className="px-3 py-2.5 text-center">IVA %</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/60">
                  {compraDetalleModal.lineas.map(item => (
                    <tr key={item.id} className="hover:bg-dark-700/30">
                      <td className="px-3 py-2 font-mono text-dark-400 whitespace-nowrap">
                        {item.codigo || item.codigo_barras || 'S/C'}
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-white font-semibold">{item.nombre}</p>
                        <div className="flex items-center gap-2 text-[10px] text-dark-400">
                          {item.principio_activo && <span>🧪 {item.principio_activo}</span>}
                          {item.laboratorio && <span>🏭 {item.laboratorio}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-white whitespace-nowrap">
                        {item.cantidad}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-primary-300 whitespace-nowrap">
                        {formatCOP(item.costo_unitario)}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-dark-400 whitespace-nowrap">
                        {item.iva_porcentaje ? `${item.iva_porcentaje}%` : '0%'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-white whitespace-nowrap">
                        {formatCOP(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales y Cierre */}
            <div className="bg-dark-900 p-3.5 rounded-xl border border-dark-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-dark-400">
                <span>Total de artículos ingresados: <strong className="text-white">{compraDetalleModal.lineas.length} productos</strong></span>
              </div>

              <div className="flex items-center gap-6 font-mono">
                <div>
                  <span className="text-dark-500 text-[10px] block">Subtotal:</span>
                  <span className="text-white font-medium">{formatCOP(compraDetalleModal.subtotal)}</span>
                </div>
                {compraDetalleModal.iva_valor > 0 && (
                  <div>
                    <span className="text-dark-500 text-[10px] block">IVA Total:</span>
                    <span className="text-amber-400 font-medium">{formatCOP(compraDetalleModal.iva_valor)}</span>
                  </div>
                )}
                <div>
                  <span className="text-dark-500 text-[10px] block">Total Factura:</span>
                  <span className="text-green-400 font-bold text-base">{formatCOP(compraDetalleModal.total)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setCompraDetalleModal(null)}
                className="btn-secondary py-2 px-6 text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREAR PROVEEDOR RÁPIDO ──────────────────────────────── */}
      {modalNuevoProveedor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-950 border border-primary-700/60 text-primary-400 flex items-center justify-center">
                  <Truck size={22} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Añadir Nuevo Proveedor</h3>
                  <p className="text-dark-400 text-xs">Registra un proveedor y asígnalo de inmediato a esta compra</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoProveedor(null)}
                className="text-dark-400 hover:text-white p-1 rounded-lg hover:bg-dark-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGuardarProveedor} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-dark-300 font-semibold mb-1">
                  Razón Social / Nombre Comercial *
                </label>
                <input
                  type="text"
                  required
                  className="input-field py-2 text-xs font-semibold w-full"
                  placeholder="Ej: COOPIDROGAS, LABORATORIOS MK, DISTRIBUIDORA ANDINA..."
                  value={modalNuevoProveedor.razon_social}
                  onChange={e => setModalNuevoProveedor({ ...modalNuevoProveedor, razon_social: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-dark-400 mb-1">NIT / Cédula / RUT</label>
                  <input
                    type="text"
                    className="input-field py-2 text-xs font-mono w-full"
                    placeholder="Ej: 860.025.123-4"
                    value={modalNuevoProveedor.nit}
                    onChange={e => setModalNuevoProveedor({ ...modalNuevoProveedor, nit: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-dark-400 mb-1">Persona de Contacto / Asesor</label>
                  <input
                    type="text"
                    className="input-field py-2 text-xs w-full"
                    placeholder="Ej: Carlos Gómez"
                    value={modalNuevoProveedor.contacto}
                    onChange={e => setModalNuevoProveedor({ ...modalNuevoProveedor, contacto: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-dark-400 mb-1">Teléfono / Celular</label>
                  <input
                    type="text"
                    className="input-field py-2 text-xs font-mono w-full"
                    placeholder="Ej: 310 1234567"
                    value={modalNuevoProveedor.telefono}
                    onChange={e => setModalNuevoProveedor({ ...modalNuevoProveedor, telefono: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-dark-400 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    className="input-field py-2 text-xs w-full"
                    placeholder="facturacion@proveedor.com"
                    value={modalNuevoProveedor.email}
                    onChange={e => setModalNuevoProveedor({ ...modalNuevoProveedor, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-dark-400 mb-1">Ciudad</label>
                  <input
                    type="text"
                    className="input-field py-2 text-xs w-full"
                    placeholder="Ej: Bogotá, Cali, Medellín..."
                    value={modalNuevoProveedor.ciudad}
                    onChange={e => setModalNuevoProveedor({ ...modalNuevoProveedor, ciudad: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-dark-400 mb-1">Dirección</label>
                  <input
                    type="text"
                    className="input-field py-2 text-xs w-full"
                    placeholder="Ej: Calle 100 # 15-20"
                    value={modalNuevoProveedor.direccion}
                    onChange={e => setModalNuevoProveedor({ ...modalNuevoProveedor, direccion: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-dark-700">
                <button
                  type="button"
                  onClick={() => setModalNuevoProveedor(null)}
                  className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoProveedor}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold"
                >
                  {guardandoProveedor ? 'Guardando...' : '✓ Guardar y Asignar a Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

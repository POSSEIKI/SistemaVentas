import { create } from 'zustand'
import { redondearPrecio } from '../utils/pricing'

export const useVentaStore = create((set, get) => ({
  lineas: [],
  formaPago: 'EFECTIVO',
  valorRecibido: 0,
  esDomicilio: false,
  domicilioValor: 0,
  domicilioDireccion: '',
  domicilioTelefono: '',
  domicilioNotas: '',
  domicilioDistanciaKm: null,
  guardarDireccionCliente: false,
  clienteId: 1,
  clienteNombre: 'CLIENTE MOSTRADOR (CONSUMIDOR FINAL)',
  clienteDireccion: '',
  clienteTelefono: '',
  observaciones: '',

  // Bono / Saldo a favor
  bonoCodigo: null,
  bonoMontoAplicado: 0,
  bonoSaldoDisponible: 0,

  // ─── Validar Stock Disponible ─────────────────────────────────────────────
  validarStockDisponible: (producto, presentacion = 'DIRECTO', cantidadAdicional = 1) => {
    if (!producto.afecta_inventario || producto.es_servicio) {
      return { puedeVender: true, stockActual: 999999, unidadesDisponibles: 999999, factor: 1, maxPresentacion: 999999 }
    }

    let factor = 1
    if (producto.maneja_fracciones) {
      if (presentacion === 'CAJA') factor = parseInt(producto.contenido_caja || 1)
      else if (presentacion === 'BLISTER') {
        const unidsBlister = producto.contenido_blister > 0 
          ? (producto.contenido_caja / producto.contenido_blister) 
          : 1
        factor = parseInt(unidsBlister)
      } else if (presentacion === 'UNIDAD') factor = 1
    }

    const { lineas } = get()
    // Sumar unidades base de este producto ya en carrito que NO sean encargo
    const unidsEnCarrito = lineas
      .filter(l => l.producto_id === producto.id && !l.es_encargo)
      .reduce((acc, l) => acc + (l.cantidad * l.factor_multiplicador), 0)

    const stockActual = parseFloat(producto.stock_actual || 0)
    const stockRestante = stockActual - unidsEnCarrito
    const unidsRequeridas = factor * cantidadAdicional

    const maxPresentacion = factor > 0 ? Math.floor(Math.max(0, stockRestante) / factor) : 0

    return {
      puedeVender: stockRestante >= unidsRequeridas,
      stockActual,
      stockRestante: Math.max(0, stockRestante),
      factor,
      unidsRequeridas,
      maxPresentacion,
    }
  },

  // ─── Agregar producto con soporte de presentación / fracción / encargo ────
  agregarProducto: (producto, presentacion = 'DIRECTO', precioPersonalizado = null, factorPersonalizado = 1, esEncargo = false) => {
    const { lineas } = get()

    const basePrecio = parseFloat(producto.precio_venta || producto.precio_caja || 0)
    let precio = (precioPersonalizado !== null && precioPersonalizado !== undefined && parseFloat(precioPersonalizado) > 0)
      ? parseFloat(precioPersonalizado)
      : basePrecio

    let factor = factorPersonalizado || 1
    let etiqueta = ''

    if (producto.maneja_fracciones) {
      const cajaP = parseFloat(producto.precio_caja || producto.precio_venta || 0)
      const uCaja = parseInt(producto.contenido_caja) || 1
      const uBlister = parseInt(producto.contenido_blister) || 0

      if (presentacion === 'CAJA' || presentacion === 'DIRECTO') {
        precio = (precioPersonalizado !== null && precioPersonalizado !== undefined && parseFloat(precioPersonalizado) > 0)
          ? parseFloat(precioPersonalizado)
          : (cajaP || basePrecio)
        factor = uCaja
        if (presentacion === 'CAJA') etiqueta = ` [Caja x${factor}]`
      } else if (presentacion === 'BLISTER') {
        const rawBlister = parseFloat(producto.precio_blister || 0)
        precio = (precioPersonalizado !== null && precioPersonalizado !== undefined && parseFloat(precioPersonalizado) > 0)
          ? parseFloat(precioPersonalizado)
          : (rawBlister > 0 ? rawBlister : (uCaja > uBlister && uBlister > 1 ? (cajaP / (uCaja / uBlister)) * 1.12 : cajaP))
        factor = uBlister > 0 ? uBlister : 1
        etiqueta = ` [Blister x${factor}]`
      } else if (presentacion === 'UNIDAD') {
        const rawUnidad = parseFloat(producto.precio_unidad || 0)
        precio = (precioPersonalizado !== null && precioPersonalizado !== undefined && parseFloat(precioPersonalizado) > 0)
          ? parseFloat(precioPersonalizado)
          : (rawUnidad > 0 ? rawUnidad : (uCaja > 1 ? (cajaP / uCaja) * 1.25 : cajaP))
        factor = 1
        etiqueta = ` [Unidad]`
      }
    }

    precio = redondearPrecio(precio)
    if (precio <= 0 && basePrecio > 0) {
      precio = redondearPrecio(basePrecio)
    }

    const itemKey = `${producto.id}_${presentacion}_${esEncargo ? 'ENCARGO' : 'NORMAL'}`
    const existente = lineas.find(l => l.key === itemKey)

    if (existente) {
      set({
        lineas: lineas.map(l =>
          l.key === itemKey
            ? { ...l, cantidad: l.cantidad + 1 }
            : l
        )
      })
    } else {
      set({
        lineas: [...lineas, {
          key: itemKey,
          producto_id: producto.id,
          nombre: `${producto.nombre}${etiqueta}${esEncargo ? ' 📦 (Por Encargo)' : ''}`,
          nombre_base: producto.nombre,
          presentacion: presentacion,
          factor_multiplicador: factor,
          precio_unitario: precio,
          iva_porcentaje: parseFloat(producto.iva_porcentaje || 0),
          cantidad: 1,
          descuento_porcentaje: 0,
          es_encargo: esEncargo,
          producto_ref: producto,
        }]
      })
    }
  },

  actualizarCantidad: (itemKey, cantidad) => {
    if (cantidad <= 0) {
      get().quitarLinea(itemKey)
      return
    }
    set({
      lineas: get().lineas.map(l =>
        l.key === itemKey ? { ...l, cantidad } : l
      )
    })
  },

  marcarComoEncargo: (itemKey, esEncargo) => {
    set({
      lineas: get().lineas.map(l => {
        if (l.key === itemKey) {
          const newKey = `${l.producto_id}_${l.presentacion}_${esEncargo ? 'ENCARGO' : 'NORMAL'}`
          const etiquetaPres = l.presentacion !== 'DIRECTO' && l.presentacion !== 'UNIDAD' ? ` [${l.presentacion}]` : ''
          return {
            ...l,
            key: newKey,
            es_encargo: esEncargo,
            nombre: `${l.nombre_base}${etiquetaPres}${esEncargo ? ' 📦 (Por Encargo)' : ''}`
          }
        }
        return l
      })
    })
  },

  aplicarDescuentoLinea: (itemKey, descuento_porcentaje) => {
    set({
      lineas: get().lineas.map(l =>
        l.key === itemKey ? { ...l, descuento_porcentaje } : l
      )
    })
  },

  quitarLinea: (itemKey) => {
    set({ lineas: get().lineas.filter(l => l.key !== itemKey) })
  },

  setFormaPago: (fp) => set({ formaPago: fp }),
  setValorRecibido: (v) => set({ valorRecibido: parseFloat(v) || 0 }),
  setDomicilio: (v) => set({ domicilioValor: parseFloat(v) || 0 }),
  setEsDomicilio: (val) => set(state => ({
    esDomicilio: !!val,
    domicilioValor: !val ? 0 : (state.domicilioValor > 0 ? state.domicilioValor : 4000)
  })),
  setDomicilioDatos: (datos) => set(state => ({ ...state, ...datos })),
  setCliente: (id, nombre, direccion = '', telefono = '') => {
    set(state => ({
      clienteId: id,
      clienteNombre: nombre,
      clienteDireccion: direccion || '',
      clienteTelefono: telefono || '',
      domicilioDireccion: state.esDomicilio ? (direccion || state.domicilioDireccion) : state.domicilioDireccion,
      domicilioTelefono: state.esDomicilio ? (telefono || state.domicilioTelefono) : state.domicilioTelefono,
    }))
  },
  setObservaciones: (obs) => set({ observaciones: obs }),

  // ─── Bonos y Saldo a Favor ────────────────────────────────────────────────
  aplicarBono: (bono) => {
    const totalActual = get().getSubtotal() + get().getIvaTotal() + get().domicilioValor
    const montoAAplicar = Math.min(totalActual, parseFloat(bono.saldo_disponible || 0))
    set({
      bonoCodigo: bono.codigo,
      bonoSaldoDisponible: parseFloat(bono.saldo_disponible || 0),
      bonoMontoAplicado: montoAAplicar,
    })
  },

  quitarBono: () => set({
    bonoCodigo: null,
    bonoSaldoDisponible: 0,
    bonoMontoAplicado: 0,
  }),

  // ─── Getters de totales ────────────────────────────────────────────────────
  getSubtotal: () => {
    return get().lineas.reduce((acc, l) => {
      const base = l.precio_unitario * l.cantidad
      const desc = base * (l.descuento_porcentaje / 100)
      return acc + base - desc
    }, 0)
  },

  getDescuentoTotal: () => {
    return get().lineas.reduce((acc, l) => {
      return acc + (l.precio_unitario * l.cantidad * l.descuento_porcentaje / 100)
    }, 0)
  },

  getIvaTotal: () => {
    return get().lineas.reduce((acc, l) => {
      const base = l.precio_unitario * l.cantidad
      const desc = base * (l.descuento_porcentaje / 100)
      const sub = base - desc
      return acc + sub * (l.iva_porcentaje / 100)
    }, 0)
  },

  getTotalBruto: () => {
    const s = get()
    return s.getSubtotal() + s.getIvaTotal() + s.domicilioValor
  },

  getTotal: () => {
    const s = get()
    const totalBruto = s.getSubtotal() + s.getIvaTotal() + s.domicilioValor
    return Math.max(0, totalBruto - s.bonoMontoAplicado)
  },

  getCambio: () => {
    const s = get()
    return Math.max(0, s.valorRecibido - s.getTotal())
  },

  // ─── Build payload para enviar al backend ─────────────────────────────────
  buildPayload: () => {
    const s = get()
    return {
      cliente_id: s.clienteId,
      forma_pago: s.bonoMontoAplicado >= s.getTotalBruto() ? 'BONO' : s.formaPago,
      valor_recibido: s.valorRecibido,
      domicilio_valor: s.esDomicilio ? s.domicilioValor : 0,
      domicilio_direccion: s.esDomicilio ? (s.domicilioDireccion || null) : null,
      domicilio_telefono: s.esDomicilio ? (s.domicilioTelefono || null) : null,
      domicilio_notas: s.esDomicilio ? (s.domicilioNotas || null) : null,
      domicilio_distancia_km: s.esDomicilio ? s.domicilioDistanciaKm : null,
      guardar_direccion_cliente: s.esDomicilio && s.guardarDireccionCliente,
      observaciones: s.observaciones || null,
      bono_codigo: s.bonoCodigo || null,
      bono_monto_aplicado: s.bonoMontoAplicado || 0,
      lineas: s.lineas.map(l => ({
        producto_id: l.producto_id,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        descuento_porcentaje: l.descuento_porcentaje,
        presentacion: l.presentacion,
        factor_multiplicador: l.factor_multiplicador,
        es_encargo: l.es_encargo || false,
      })),
    }
  },

  limpiar: () => set({
    lineas: [],
    formaPago: 'EFECTIVO',
    valorRecibido: 0,
    domicilioValor: 0,
    esDomicilio: false,
    domicilioDireccion: '',
    domicilioTelefono: '',
    domicilioNotas: '',
    domicilioDistanciaKm: null,
    guardarDireccionCliente: false,
    clienteId: 1,
    clienteNombre: 'CLIENTE MOSTRADOR (CONSUMIDOR FINAL)',
    clienteDireccion: '',
    clienteTelefono: '',
    observaciones: '',
    bonoCodigo: null,
    bonoMontoAplicado: 0,
    bonoSaldoDisponible: 0,
  }),
}))

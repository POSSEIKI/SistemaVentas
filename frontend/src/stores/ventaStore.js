import { create } from 'zustand'

export const useVentaStore = create((set, get) => ({
  lineas: [],
  formaPago: 'EFECTIVO',
  valorRecibido: 0,
  domicilioValor: 0,
  clienteId: null,
  clienteNombre: '',
  observaciones: '',

  // ─── Agregar producto con soporte de presentación / fracción ──────────────
  agregarProducto: (producto, presentacion = 'DIRECTO', precioPersonalizado = null, factorPersonalizado = 1) => {
    const { lineas } = get()

    let precio = precioPersonalizado !== null ? parseFloat(precioPersonalizado) : parseFloat(producto.precio_venta || 0)
    let factor = factorPersonalizado
    let etiqueta = ''

    if (producto.maneja_fracciones) {
      if (presentacion === 'CAJA') {
        precio = parseFloat(producto.precio_caja || producto.precio_venta || 0)
        factor = parseInt(producto.contenido_caja || 1)
        etiqueta = ` [Caja x${factor}]`
      } else if (presentacion === 'BLISTER') {
        precio = parseFloat(producto.precio_blister || 0)
        const unidsBlister = producto.contenido_blister > 0 
          ? (producto.contenido_caja / producto.contenido_blister) 
          : 1
        factor = parseInt(unidsBlister)
        etiqueta = ` [Blister x${factor}]`
      } else if (presentacion === 'UNIDAD') {
        precio = parseFloat(producto.precio_unidad || 0)
        factor = 1
        etiqueta = ` [Unidad]`
      }
    }

    const itemKey = `${producto.id}_${presentacion}`
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
          nombre: `${producto.nombre}${etiqueta}`,
          nombre_base: producto.nombre,
          presentacion: presentacion,
          factor_multiplicador: factor,
          precio_unitario: precio,
          iva_porcentaje: parseFloat(producto.iva_porcentaje || 0),
          cantidad: 1,
          descuento_porcentaje: 0,
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
  setCliente: (id, nombre) => set({ clienteId: id, clienteNombre: nombre }),
  setObservaciones: (obs) => set({ observaciones: obs }),

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

  getTotal: () => {
    const s = get()
    return s.getSubtotal() + s.getIvaTotal() + s.domicilioValor
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
      forma_pago: s.formaPago,
      valor_recibido: s.valorRecibido,
      domicilio_valor: s.domicilioValor,
      observaciones: s.observaciones || null,
      lineas: s.lineas.map(l => ({
        producto_id: l.producto_id,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        descuento_porcentaje: l.descuento_porcentaje,
        presentacion: l.presentacion,
        factor_multiplicador: l.factor_multiplicador,
      })),
    }
  },

  limpiar: () => set({
    lineas: [],
    formaPago: 'EFECTIVO',
    valorRecibido: 0,
    domicilioValor: 0,
    clienteId: null,
    clienteNombre: '',
    observaciones: '',
  }),
}))

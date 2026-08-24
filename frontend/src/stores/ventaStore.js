import { create } from 'zustand'

export const useVentaStore = create((set, get) => ({
  lineas: [],
  formaPago: 'EFECTIVO',
  valorRecibido: 0,
  domicilioValor: 0,
  clienteId: null,
  clienteNombre: '',
  observaciones: '',

  // ─── Agregar o incrementar producto ────────────────────────────────────────
  agregarProducto: (producto) => {
    const { lineas } = get()
    const existente = lineas.find(l => l.producto_id === producto.id)
    if (existente) {
      set({
        lineas: lineas.map(l =>
          l.producto_id === producto.id
            ? { ...l, cantidad: l.cantidad + 1 }
            : l
        )
      })
    } else {
      set({
        lineas: [...lineas, {
          producto_id: producto.id,
          nombre: producto.nombre,
          precio_unitario: parseFloat(producto.precio_venta),
          iva_porcentaje: parseFloat(producto.iva_porcentaje),
          cantidad: 1,
          descuento_porcentaje: 0,
        }]
      })
    }
  },

  actualizarCantidad: (producto_id, cantidad) => {
    if (cantidad <= 0) {
      get().quitarLinea(producto_id)
      return
    }
    set({
      lineas: get().lineas.map(l =>
        l.producto_id === producto_id ? { ...l, cantidad } : l
      )
    })
  },

  aplicarDescuentoLinea: (producto_id, descuento_porcentaje) => {
    set({
      lineas: get().lineas.map(l =>
        l.producto_id === producto_id ? { ...l, descuento_porcentaje } : l
      )
    })
  },

  quitarLinea: (producto_id) => {
    set({ lineas: get().lineas.filter(l => l.producto_id !== producto_id) })
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

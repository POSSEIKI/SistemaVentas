import api from './client'

export const authApi = {
  checkSetup: () => api.get('/auth/setup-requerido').then(r => r.data),
  setup: (datos) => api.post('/auth/setup', datos).then(r => r.data),
  login: (username, codigo) => api.post('/auth/login', { username, codigo }).then(r => r.data),
}

export const productosApi = {
  buscar: (q, params = {}) => api.get('/productos/buscar', { params: { q, ...params } }).then(r => r.data),
  porCodigo: (codigo) => api.get(`/productos/por-codigo/${encodeURIComponent(codigo)}`).then(r => r.data),
  listar: (params) => api.get('/productos', { params }).then(r => r.data),
  crear: (datos) => api.post('/productos', datos).then(r => r.data),
  actualizar: (id, datos) => api.patch(`/productos/${id}`, datos).then(r => r.data),
  eliminar: (id) => api.delete(`/productos/${id}`).then(r => r.data),
  categorias: () => api.get('/productos/categorias/lista').then(r => r.data),
  crearCategoria: (nombre) => api.post('/productos/categorias', { nombre }).then(r => r.data),
  unidades: () => api.get('/productos/unidades/lista').then(r => r.data),
  descargarPlantillaUrl: () => `${api.defaults.baseURL}/productos/plantilla-excel`,
  exportarInventarioFisicoUrl: (params = {}) => {
    const sp = new URLSearchParams(params).toString()
    return `${api.defaults.baseURL}/productos/exportar-inventario-fisico${sp ? `?${sp}` : ''}`
  },
  importarExcel: (formData) => api.post('/productos/importar-excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000,
  }).then(r => r.data),
  ajustarInventarioFisico: (formData) => api.post('/productos/ajustar-inventario-fisico', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000,
  }).then(r => r.data),
  aplicarRedondeoGlobal: () => api.post('/productos/aplicar-redondeo-global').then(r => r.data),
}

export const clientesApi = {
  listar: (q) => api.get('/clientes', { params: q ? { q } : {} }).then(r => r.data),
  obtener: (id) => api.get(`/clientes/${id}`).then(r => r.data),
  buscarPorNit: (nit) => api.get(`/clientes/buscar-nit/${nit}`).then(r => r.data),
  crear: (datos) => api.post('/clientes', datos).then(r => r.data),
  actualizar: (id, datos) => api.patch(`/clientes/${id}`, datos).then(r => r.data),
  eliminar: (id) => api.delete(`/clientes/${id}`).then(r => r.data),
  crearOEncontrar: (datos) => api.post('/clientes/crear-o-encontrar', datos).then(r => r.data),
}

export const facturasApi = {
  crear: (datos) => api.post('/facturas', datos).then(r => r.data),
  listar: (params) => api.get('/facturas', { params }).then(r => r.data),
  get: (id) => api.get(`/facturas/${id}`).then(r => r.data),
  anular: (id, motivo) => api.post(`/facturas/${id}/anular`, { motivo }).then(r => r.data),
  devolucion: (id, datos) => api.post(`/facturas/${id}/devolucion`, datos).then(r => r.data),
  resumenDia: (fecha) => api.get('/reportes/resumen-dia', { params: fecha ? { fecha } : {} }).then(r => r.data),
  emitirDian: (id) => api.post(`/facturas/${id}/emitir-dian`).then(r => r.data),
  calcularDomicilio: (datos) => api.post('/domicilios/calcular-tarifa', datos).then(r => r.data),
}

export const domiciliosApi = {
  calcularTarifa: (datos) => api.post('/domicilios/calcular-tarifa', datos).then(r => r.data),
}

export const bonosApi = {
  porCliente: (clienteId) => api.get(`/bonos/cliente/${clienteId}`).then(r => r.data),
  verificar: (codigo) => api.get(`/bonos/verificar/${codigo}`).then(r => r.data),
}

export const proveedoresApi = {
  listar: (q) => api.get('/proveedores', { params: q ? { q } : {} }).then(r => r.data),
  obtener: (id) => api.get(`/proveedores/${id}`).then(r => r.data),
  crear: (datos) => api.post('/proveedores', datos).then(r => r.data),
  actualizar: (id, datos) => api.patch(`/proveedores/${id}`, datos).then(r => r.data),
  eliminar: (id) => api.delete(`/proveedores/${id}`).then(r => r.data),
}

export const inventarioApi = {
  registrarCompra: (datos) => api.post('/compras', datos).then(r => r.data),
  listarCompras: (params) => api.get('/compras', { params }).then(r => r.data),
  obtenerCompra: (id) => api.get(`/compras/${id}`).then(r => r.data),
  analizarFacturaExcel: (formData) => api.post('/compras/analizar-factura-excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000,
  }).then(r => r.data),
  movimientos: (pid) => api.get('/inventario/movimientos', { params: pid ? { producto_id: pid } : {} }).then(r => r.data),
  stockBajo: () => api.get('/inventario/stock-bajo').then(r => r.data),
  proveedores: () => api.get('/proveedores').then(r => r.data),
}

export const configApi = {
  get: () => api.get('/configuracion/empresa').then(r => r.data),
  update: (datos) => api.patch('/configuracion/empresa', datos).then(r => r.data),
  probarFactus: (datos) => api.post('/configuracion/factus/probar-conexion', datos).then(r => r.data),
  rangosFactus: (datos) => api.post('/configuracion/factus/rangos-numeracion', datos).then(r => r.data),
}

export const resolucionesApi = {
  listar: (params) => api.get('/resoluciones', { params }).then(r => r.data),
  activa: (tipo) => api.get('/resoluciones/activa', { params: tipo ? { tipo } : {} }).then(r => r.data),
  crear: (datos) => api.post('/resoluciones', datos).then(r => r.data),
  actualizar: (id, datos) => api.patch(`/resoluciones/${id}`, datos).then(r => r.data),
  activar: (id) => api.post(`/resoluciones/${id}/activar`).then(r => r.data),
  eliminar: (id) => api.delete(`/resoluciones/${id}`).then(r => r.data),
}

export const suscripcionesApi = {
  planesPublicos: () => api.get('/suscripciones/planes/publicos').then(r => r.data),
  registroEmpresa: (datos) => api.post('/suscripciones/registro-empresa', datos).then(r => r.data),
  miSuscripcion: () => api.get('/suscripciones/mi-suscripcion').then(r => r.data),
}

export const superadminApi = {
  metricas: () => api.get('/superadmin/metricas').then(r => r.data),
  empresas: (params) => api.get('/superadmin/empresas', { params }).then(r => r.data),
  extenderPrueba: (id, dias) => api.post(`/superadmin/empresas/${id}/extender-prueba`, { dias }).then(r => r.data),
  cambiarPlan: (id, datos) => api.post(`/superadmin/empresas/${id}/cambiar-plan`, datos).then(r => r.data),
  toggleActivo: (id) => api.post(`/superadmin/empresas/${id}/toggle-activo`).then(r => r.data),
  logsFallos: (limite = 50) => api.get('/superadmin/logs-fallos', { params: { limite } }).then(r => r.data),
}


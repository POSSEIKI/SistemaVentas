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
  importarExcel: (formData) => api.post('/productos/importar-excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data),
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
  resumenDia: (fecha) => api.get('/reportes/resumen-dia', { params: fecha ? { fecha } : {} }).then(r => r.data),
}

export const inventarioApi = {
  registrarCompra: (datos) => api.post('/compras', datos).then(r => r.data),
  movimientos: (pid) => api.get('/inventario/movimientos', { params: pid ? { producto_id: pid } : {} }).then(r => r.data),
  stockBajo: () => api.get('/inventario/stock-bajo').then(r => r.data),
  proveedores: () => api.get('/proveedores').then(r => r.data),
}

export const configApi = {
  get: () => api.get('/configuracion/empresa').then(r => r.data),
  update: (datos) => api.patch('/configuracion/empresa', datos).then(r => r.data),
}

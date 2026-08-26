import { useState, useEffect } from 'react'
import { proveedoresApi } from '../../api/services'
import {
  Truck, Search, Plus, Phone, Mail, MapPin, Edit,
  Trash2, X, MessageCircle, Building2, CheckCircle, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const FORM_VACIO = {
  id: null,
  razon_social: '',
  nit: '',
  contacto: '',
  telefono: '',
  email: '',
  ciudad: '',
  direccion: '',
}

export default function ParametrosProveedores() {
  const [proveedores, setProveedores] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  const cargar = async (q = '') => {
    setCargando(true)
    try {
      const res = await proveedoresApi.listar(q)
      setProveedores(res)
    } catch {
      toast.error('Error al cargar la lista de proveedores')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const buscar = (q) => {
    setBusqueda(q)
    clearTimeout(window._pt)
    window._pt = setTimeout(() => cargar(q), 250)
  }

  const abrirCrear = () => {
    setForm(FORM_VACIO)
    setModal(true)
  }

  const abrirEditar = (p) => {
    setForm({
      id: p.id,
      razon_social: p.razon_social || '',
      nit: p.nit || '',
      contacto: p.contacto || '',
      telefono: p.telefono || '',
      email: p.email || '',
      ciudad: p.ciudad || '',
      direccion: p.direccion || '',
    })
    setModal(true)
  }

  const guardar = async (e) => {
    e?.preventDefault()
    if (!form.razon_social.trim()) { toast.error('La Razón Social o Nombre es obligatoria'); return }

    setGuardando(true)
    try {
      if (form.id) {
        await proveedoresApi.actualizar(form.id, form)
        toast.success(`Proveedor "${form.razon_social}" actualizado correctamente`)
      } else {
        await proveedoresApi.crear(form)
        toast.success(`Proveedor "${form.razon_social}" creado exitosamente`)
      }
      setModal(false)
      setForm(FORM_VACIO)
      cargar(busqueda)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al guardar proveedor')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de desactivar al proveedor "${nombre}"?`)) return
    try {
      await proveedoresApi.eliminar(id)
      toast.success('Proveedor desactivado')
      cargar(busqueda)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al desactivar proveedor')
    }
  }

  const formatWhatsApp = (tel) => {
    if (!tel) return ''
    const clean = tel.replace(/\D/g, '')
    if (clean.length === 10) return `57${clean}`
    return clean
  }

  return (
    <div className="space-y-4">
      {/* ── Barra Superior y Acciones ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-dark-700">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Truck size={20} className="text-primary-500" />
            Parametrización de Proveedores
          </h2>
          <p className="text-dark-400 text-xs mt-0.5">
            Registro de distribuidores, laboratorios, NITs y contactos de abastecimiento
          </p>
        </div>

        <button
          onClick={abrirCrear}
          className="btn-primary flex items-center gap-2 py-2 px-4 font-bold text-xs shadow-lg self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Nuevo Proveedor</span>
        </button>
      </div>

      {/* ── Buscador y Contador ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            className="input-field pl-10 pr-10 py-2 text-xs"
            value={busqueda}
            onChange={e => buscar(e.target.value)}
            placeholder="Buscar por Razón Social, NIT / RUT, Contacto o Ciudad..."
          />
          {busqueda && (
            <button
              onClick={() => { setBusqueda(''); cargar('') }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-dark-400 font-medium">
          <span className="bg-dark-800 px-3 py-1.5 rounded-xl border border-dark-700">
            Total Proveedores: <strong className="text-white ml-1">{proveedores.length}</strong>
          </span>
        </div>
      </div>

      {/* ── Lista de Proveedores ───────────────────────────────── */}
      {cargando ? (
        <div className="text-center py-12 space-y-2">
          <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-dark-500 text-xs">Cargando proveedores...</p>
        </div>
      ) : proveedores.length === 0 ? (
        <div className="card text-center py-12 space-y-3 border-dashed border-dark-700">
          <Truck size={36} className="mx-auto text-dark-600" />
          <h3 className="text-white font-semibold text-sm">No se encontraron proveedores</h3>
          <p className="text-dark-500 text-xs max-w-sm mx-auto">
            {busqueda
              ? `No hay resultados para "${busqueda}".`
              : 'Registra tus proveedores y distribuidores para enlazarlos en las facturas de compras.'}
          </p>
          <button onClick={abrirCrear} className="btn-secondary text-xs px-4 py-2 mt-1">
            + Crear primer proveedor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {proveedores.map(p => {
            const waNumber = formatWhatsApp(p.telefono)

            return (
              <div
                key={p.id}
                className="card p-4 flex flex-col justify-between gap-3 border border-dark-700/80 hover:border-dark-600 transition-all bg-dark-800/80"
              >
                {/* Cabecera */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-dark-900 text-primary-400 border border-dark-700">
                      NIT: {p.nit || 'S/N'}
                    </span>
                    <span className="text-[10px] bg-green-950/60 text-green-400 font-bold px-2 py-0.5 rounded-full border border-green-800/60">
                      Activo
                    </span>
                  </div>

                  <h3 className="text-white font-bold text-sm leading-snug line-clamp-1 mt-1" title={p.razon_social}>
                    {p.razon_social}
                  </h3>

                  {p.contacto && (
                    <p className="text-dark-400 text-xs flex items-center gap-1.5">
                      <Building2 size={12} className="text-dark-500" />
                      <span>Contacto: <strong className="text-dark-200">{p.contacto}</strong></span>
                    </p>
                  )}
                </div>

                {/* Contactos y Ubicación */}
                <div className="space-y-1.5 text-xs text-dark-400 pt-2 border-t border-dark-700/60">
                  {p.telefono ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-dark-300">
                        <Phone size={12} className="text-primary-400" />
                        <span className="font-mono text-[11px]">{p.telefono}</span>
                      </div>
                      {waNumber && (
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[10px] bg-green-950/60 text-green-400 hover:bg-green-900 px-2 py-0.5 rounded border border-green-800 transition-colors"
                          title="Contactar por WhatsApp"
                        >
                          <MessageCircle size={11} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-dark-600 text-[11px] italic">Sin teléfono registrado</p>
                  )}

                  {p.email && (
                    <div className="flex items-center gap-1.5 text-dark-300 truncate">
                      <Mail size={12} className="text-primary-400 flex-shrink-0" />
                      <a href={`mailto:${p.email}`} className="hover:text-primary-400 truncate text-[11px]">
                        {p.email}
                      </a>
                    </div>
                  )}

                  {(p.direccion || p.ciudad) && (
                    <div className="flex items-center gap-1.5 text-dark-400 text-[11px]">
                      <MapPin size={12} className="text-primary-400 flex-shrink-0" />
                      <span className="truncate">
                        {[p.direccion, p.ciudad].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-700/60">
                  <button
                    onClick={() => abrirEditar(p)}
                    className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                  >
                    <Edit size={13} />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => eliminar(p.id, p.razon_social)}
                    className="p-1.5 rounded-lg text-dark-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                    title="Desactivar proveedor"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal de Crear / Editar Proveedor ──────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModal(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-lg border border-dark-600 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-dark-700 flex justify-between items-center bg-dark-900/50">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Truck size={18} className="text-primary-400" />
                  {form.id ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
                </h3>
                <p className="text-dark-400 text-xs mt-0.5">
                  Información comercial y de contacto para órdenes de compra
                </p>
              </div>
              <button onClick={() => setModal(false)} className="text-dark-500 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={guardar} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-dark-300 mb-1">
                    Razón Social / Nombre Comercial *
                  </label>
                  <input
                    className="input-field py-1.5 text-xs font-semibold"
                    placeholder="Ej: Distribuidora Farmacéutica del Norte SAS"
                    value={form.razon_social}
                    onChange={e => setForm({ ...form, razon_social: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1">
                    NIT / RUT
                  </label>
                  <input
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="Ej: 901.234.567-8"
                    value={form.nit}
                    onChange={e => setForm({ ...form, nit: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1">
                    Persona de Contacto
                  </label>
                  <input
                    className="input-field py-1.5 text-xs"
                    placeholder="Ej: Carlos Gómez (Asesor)"
                    value={form.contacto}
                    onChange={e => setForm({ ...form, contacto: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="tel"
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="Ej: 3101234567"
                    value={form.telefono}
                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    className="input-field py-1.5 text-xs"
                    placeholder="pedidos@distribuidora.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1">
                    Ciudad
                  </label>
                  <input
                    className="input-field py-1.5 text-xs"
                    placeholder="Ej: Medellín, Bogotá..."
                    value={form.ciudad}
                    onChange={e => setForm({ ...form, ciudad: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1">
                    Dirección
                  </label>
                  <input
                    className="input-field py-1.5 text-xs"
                    placeholder="Ej: Cra 45 # 12-34 Bodega 5"
                    value={form.direccion}
                    onChange={e => setForm({ ...form, direccion: e.target.value })}
                  />
                </div>
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
                  {guardando ? 'Guardando...' : form.id ? '✓ Guardar Cambios' : '✓ Registrar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
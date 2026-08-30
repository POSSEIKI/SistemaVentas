import { useState, useEffect } from 'react'
import { clientesApi } from '../../api/services'
import {
  Search, Plus, Users, Phone, Mail, MapPin, Edit,
  Trash2, X, MessageCircle, AlertCircle, CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const FORM_VACIO = {
  id: null,
  nombre: '',
  nit: '',
  tipo_doc: 'CC',
  telefono: '',
  email: '',
  ciudad: '',
  direccion: '',
  notas: '',
}

export default function ParametrosClientes() {
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  const cargar = async (q = '') => {
    setCargando(true)
    try {
      const res = await clientesApi.listar(q)
      setClientes(res)
    } catch {
      toast.error('Error al cargar la lista de clientes')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const buscar = (q) => {
    setBusqueda(q)
    clearTimeout(window._ct)
    window._ct = setTimeout(() => cargar(q), 250)
  }

  const abrirCrear = () => {
    setForm(FORM_VACIO)
    setModal(true)
  }

  const abrirEditar = (c) => {
    setForm({
      id: c.id,
      nombre: c.nombre || '',
      nit: c.nit || '',
      tipo_doc: c.tipo_doc || 'CC',
      telefono: c.telefono || '',
      email: c.email || '',
      ciudad: c.ciudad || '',
      direccion: c.direccion || '',
      notas: c.notas || '',
    })
    setModal(true)
  }

  const guardar = async (e) => {
    e?.preventDefault()
    if (!form.nombre.trim()) { toast.error('El nombre completo es obligatorio'); return }
    if (!form.nit.trim()) { toast.error('El número de documento (Cédula/NIT) es obligatorio'); return }

    setGuardando(true)
    try {
      if (form.id) {
        await clientesApi.actualizar(form.id, form)
        toast.success(`Cliente "${form.nombre}" actualizado correctamente`)
      } else {
        await clientesApi.crear(form)
        toast.success(`Cliente "${form.nombre}" creado exitosamente`)
      }
      setModal(false)
      setForm(FORM_VACIO)
      cargar(busqueda)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al guardar cliente')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id, nombre, nit) => {
    if (id === 1 || nit === '222222222222' || nombre?.toUpperCase().includes('MOSTRADOR')) {
      toast.error('El "CLIENTE MOSTRADOR (CONSUMIDOR FINAL - 222222222222)" es obligatorio por ley en Colombia y no se puede eliminar.')
      return
    }
    if (!window.confirm(`¿Estás seguro de desactivar al cliente "${nombre}"?`)) return

    try {
      await clientesApi.eliminar(id)
      toast.success('Cliente desactivado')
      cargar(busqueda)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al desactivar cliente')
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
            <Users size={20} className="text-primary-500" />
            Parametrización de Clientes
          </h2>
          <p className="text-dark-400 text-xs mt-0.5">
            Administración de datos legales de facturación electrónica, teléfonos y domicilios
          </p>
        </div>

        <button
          onClick={abrirCrear}
          className="btn-primary flex items-center gap-2 py-2 px-4 font-bold text-xs shadow-lg self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Nuevo Cliente</span>
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
            placeholder="Buscar por Nombre, Cédula / NIT, Teléfono, Ciudad o Dirección..."
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
            Total Clientes: <strong className="text-white ml-1">{clientes.length}</strong>
          </span>
        </div>
      </div>

      {/* ── Lista / Grilla de Clientes ─────────────────────────── */}
      {cargando ? (
        <div className="text-center py-12 space-y-2">
          <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-dark-500 text-xs">Cargando clientes...</p>
        </div>
      ) : clientes.length === 0 ? (
        <div className="card text-center py-12 space-y-3 border-dashed border-dark-700">
          <Users size={36} className="mx-auto text-dark-600" />
          <h3 className="text-white font-semibold text-sm">No se encontraron clientes</h3>
          <p className="text-dark-500 text-xs max-w-sm mx-auto">
            {busqueda
              ? `No hay coincidencias para "${busqueda}".`
              : 'Registra los clientes de tu negocio para asociarlos a facturas y despachos.'}
          </p>
          <button onClick={abrirCrear} className="btn-secondary text-xs px-4 py-2 mt-1">
            + Crear primer cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {clientes.map(c => {
            const esMostrador = c.id === 1 || c.nit === '222222222222' || c.nombre?.toUpperCase().includes('MOSTRADOR')
            const waNumber = formatWhatsApp(c.telefono)

            return (
              <div
                key={c.id}
                className={`card p-4 flex flex-col justify-between gap-3 border transition-all ${
                  esMostrador
                    ? 'bg-primary-950/20 border-primary-800/40 ring-1 ring-primary-500/20'
                    : 'bg-dark-800/80 border-dark-700/80 hover:border-dark-600'
                }`}
              >
                {/* Cabecera */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-dark-900 text-primary-400 border border-dark-700">
                      {c.tipo_doc || 'CC'}
                    </span>
                    {esMostrador && (
                      <span className="text-[10px] bg-primary-900/60 text-primary-300 font-bold px-2 py-0.5 rounded-full border border-primary-700">
                        ⚡ Venta Rápida / Obligatorio DIAN
                      </span>
                    )}
                  </div>

                  <h3 className="text-white font-bold text-sm leading-snug line-clamp-1 mt-1" title={c.nombre}>
                    {c.nombre}
                  </h3>

                  <p className="text-dark-400 font-mono text-xs">
                    Doc: <strong className="text-white">{c.nit || '—'}</strong>
                  </p>
                </div>

                {/* Contacto y Ubicación */}
                <div className="space-y-1.5 text-xs text-dark-400 pt-2 border-t border-dark-700/60">
                  {c.telefono ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-dark-300">
                        <Phone size={12} className="text-primary-400" />
                        <span className="font-mono text-[11px]">{c.telefono}</span>
                      </div>
                      {waNumber && (
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[10px] bg-green-950/60 text-green-400 hover:bg-green-900 px-2 py-0.5 rounded border border-green-800 transition-colors"
                          title="Enviar WhatsApp"
                        >
                          <MessageCircle size={11} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-dark-600 text-[11px] italic">Sin teléfono registrado</p>
                  )}

                  {c.email && (
                    <div className="flex items-center gap-1.5 text-dark-300 truncate">
                      <Mail size={12} className="text-primary-400 flex-shrink-0" />
                      <span className="truncate text-[11px]">{c.email}</span>
                    </div>
                  )}

                  {(c.direccion || c.ciudad) && (
                    <div className="flex items-center gap-1.5 text-dark-400 text-[11px]">
                      <MapPin size={12} className="text-primary-400 flex-shrink-0" />
                      <span className="truncate">
                        {[c.direccion, c.ciudad].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-700/60">
                  <button
                    onClick={() => abrirEditar(c)}
                    className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                  >
                    <Edit size={13} />
                    <span>Editar</span>
                  </button>
                  {!esMostrador && (
                    <button
                      onClick={() => eliminar(c.id, c.nombre, c.nit)}
                      className="p-1.5 rounded-lg text-dark-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                      title="Desactivar cliente"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal de Crear / Editar Cliente ────────────────────── */}
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
                  <Users size={18} className="text-primary-400" />
                  {form.id ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
                </h3>
                <p className="text-dark-400 text-xs mt-0.5">
                  Datos legales y de despacho para facturación
                </p>
              </div>
              <button onClick={() => setModal(false)} className="text-dark-500 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={guardar} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1">Tipo Doc *</label>
                  <select
                    className="input-field py-1.5 text-xs"
                    value={form.tipo_doc}
                    onChange={e => setForm({ ...form, tipo_doc: e.target.value })}
                  >
                    <option value="CC">Cédula (CC)</option>
                    <option value="NIT">NIT / RUT</option>
                    <option value="CE">Cédula Extr. (CE)</option>
                    <option value="PAS">Pasaporte</option>
                    <option value="TI">Tarjeta Identidad</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-dark-300 mb-1">Número de Documento *</label>
                  <input
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="Ej: 1020304050"
                    value={form.nit}
                    onChange={e => setForm({ ...form, nit: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 mb-1">Nombre Completo o Razón Social *</label>
                <input
                  className="input-field py-1.5 text-xs font-semibold"
                  placeholder="Ej: Juan Pérez o Droguería San Juan SAS"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="tel"
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="Ej: 3001234567"
                    value={form.telefono}
                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    className="input-field py-1.5 text-xs"
                    placeholder="cliente@ejemplo.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1">Ciudad / Municipio</label>
                  <input
                    className="input-field py-1.5 text-xs"
                    placeholder="Ej: Medellín, Envigado..."
                    value={form.ciudad}
                    onChange={e => setForm({ ...form, ciudad: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1">Dirección de Entrega</label>
                  <input
                    className="input-field py-1.5 text-xs"
                    placeholder="Ej: Calle 10 # 43A - 12 Apto 302"
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
                  {guardando ? 'Guardando...' : form.id ? '✓ Guardar Cambios' : '✓ Registrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
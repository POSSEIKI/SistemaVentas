import { useState, useEffect } from 'react'
import { clientesApi } from '../api/services'
import {
  Search, Plus, Users, Phone, Mail, MapPin, Edit,
  Trash2, X, CheckCircle, MessageCircle, FileText, AlertCircle
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

export default function ClientesPage() {
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
      toast.error('Error cargando la lista de clientes')
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
    window._ct = setTimeout(() => cargar(q), 300)
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
      toast.error(err.message || 'Error al guardar cliente')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id, nombre) => {
    if (id === 1) {
      toast.error('No se puede eliminar el Cliente Mostrador por defecto')
      return
    }
    if (!window.confirm(`¿Estás seguro de desactivar al cliente "${nombre}"?`)) return

    try {
      await clientesApi.eliminar(id)
      toast.success('Cliente desactivado')
      cargar(busqueda)
    } catch (err) {
      toast.error(err.message || 'Error al eliminar')
    }
  }

  // Limpiar número telefónico para enlace directo de WhatsApp
  const formatWhatsApp = (tel) => {
    if (!tel) return ''
    const clean = tel.replace(/\D/g, '')
    if (clean.length === 10) return `57${clean}`
    return clean
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">

      {/* ── Encabezado y Acciones ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Users size={26} className="text-primary-500" />
            Gestión de Clientes
          </h1>
          <p className="text-dark-500 text-sm mt-0.5">
            Administra los datos legales de facturación, contactos y direcciones de entrega
          </p>
        </div>

        <button
          onClick={abrirCrear}
          className="btn-primary flex items-center gap-2 py-2.5 px-5 font-bold text-sm shadow-lg self-start sm:self-auto"
        >
          <Plus size={18} />
          Nuevo Cliente
        </button>
      </div>

      {/* ── Barra de Búsqueda y Resumen ──────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            className="input-field pl-10 pr-10 py-2.5 text-sm"
            value={busqueda}
            onChange={e => buscar(e.target.value)}
            placeholder="Buscar por Nombre, Cédula / NIT, Teléfono, Ciudad o Dirección..."
          />
          {busqueda && (
            <button
              onClick={() => { setBusqueda(''); cargar('') }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto text-xs text-dark-400 font-medium">
          <span className="bg-dark-800 px-3 py-2 rounded-xl border border-dark-700">
            Total Clientes: <strong className="text-white ml-1">{clientes.length}</strong>
          </span>
        </div>
      </div>

      {/* ── Lista / Grilla de Clientes ──────────────────────── */}
      {cargando ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-dark-500 text-sm">Cargando base de datos de clientes...</p>
        </div>
      ) : clientes.length === 0 ? (
        <div className="card text-center py-16 space-y-3 border border-dashed border-dark-700">
          <Users size={40} className="mx-auto text-dark-600" />
          <h3 className="text-white font-semibold text-base">No se encontraron clientes</h3>
          <p className="text-dark-500 text-xs max-w-sm mx-auto">
            {busqueda
              ? `No hay coincidencias para "${busqueda}". Intenta con otro término.`
              : 'Empieza registrando los clientes frecuentes de tu negocio para facturación y domicilios.'}
          </p>
          <button onClick={abrirCrear} className="btn-secondary text-xs px-4 py-2 mt-2">
            + Crear primer cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientes.map(c => {
            const esMostrador = c.id === 1 || c.nit === '222222222222'
            const waNumber = formatWhatsApp(c.telefono)

            return (
              <div
                key={c.id}
                className={`card p-4 flex flex-col justify-between gap-3 border transition-all ${
                  esMostrador
                    ? 'bg-primary-950/20 border-primary-800/40 ring-1 ring-primary-500/20'
                    : 'hover:border-dark-600'
                }`}
              >
                {/* Cabecera de la tarjeta */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-dark-700 text-primary-400 border border-dark-600">
                      {c.tipo_doc || 'CC'}
                    </span>
                    {esMostrador && (
                      <span className="text-[10px] bg-primary-900/60 text-primary-300 font-bold px-2 py-0.5 rounded-full border border-primary-700">
                        ⚡ Venta Rápida
                      </span>
                    )}
                  </div>

                  <h3 className="text-white font-bold text-base leading-snug line-clamp-1" title={c.nombre}>
                    {c.nombre}
                  </h3>

                  <p className="text-dark-400 font-mono text-xs">
                    Doc: <strong className="text-white">{c.nit || '—'}</strong>
                  </p>
                </div>

                {/* Datos de contacto y ubicación */}
                <div className="space-y-1.5 text-xs text-dark-400 pt-2 border-t border-dark-700/60">
                  {c.telefono ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-dark-300">
                        <Phone size={13} className="text-primary-400" />
                        <span className="font-mono">{c.telefono}</span>
                      </div>
                      {waNumber && (
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] bg-green-950/60 text-green-400 hover:bg-green-900 px-2 py-0.5 rounded border border-green-800 transition-colors"
                          title="Enviar mensaje por WhatsApp"
                        >
                          <MessageCircle size={12} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-dark-600 text-[11px] italic">Sin teléfono registrado</p>
                  )}

                  {c.direccion ? (
                    <div className="flex items-start gap-1.5 text-dark-400">
                      <MapPin size={13} className="text-primary-400 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">
                        {c.direccion} {c.ciudad && `(${c.ciudad})`}
                      </span>
                    </div>
                  ) : null}

                  {c.email ? (
                    <div className="flex items-center gap-1.5 text-dark-400 truncate">
                      <Mail size={13} className="text-primary-400 flex-shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  ) : null}
                </div>

                {/* Botones de acción */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-700/60">
                  <button
                    onClick={() => abrirEditar(c)}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 hover:border-primary-500 hover:text-primary-400 transition-colors"
                  >
                    <Edit size={13} />
                    <span>Editar</span>
                  </button>

                  {!esMostrador && (
                    <button
                      onClick={() => eliminar(c.id, c.nombre)}
                      className="text-dark-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-950/30 transition-colors"
                      title="Desactivar cliente"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── MODAL: CREAR / EDITAR CLIENTE ────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModal(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-lg border border-dark-700 shadow-2xl p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-dark-700 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users size={20} className="text-primary-500" />
                  {form.id ? 'Editar Datos del Cliente' : 'Registrar Nuevo Cliente'}
                </h3>
                <p className="text-dark-500 text-xs mt-0.5">
                  Información para facturas electrónicas, despachos y control de cartera
                </p>
              </div>
              <button
                onClick={() => setModal(false)}
                className="text-dark-500 hover:text-white p-1 rounded-lg hover:bg-dark-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={guardar} className="space-y-4">
              
              {/* Sección 1: Datos Legales */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-primary-400 uppercase tracking-wider block">
                  1. Información Legal de Facturación
                </span>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs text-dark-400 mb-1 font-medium">Tipo Doc *</label>
                    <select
                      className="input-field text-xs py-2"
                      value={form.tipo_doc}
                      onChange={e => setForm({ ...form, tipo_doc: e.target.value })}
                    >
                      <option value="CC">Cédula (CC)</option>
                      <option value="NIT">NIT (Empresa)</option>
                      <option value="CE">Cédula Extranjería (CE)</option>
                      <option value="TI">Tarjeta Identidad (TI)</option>
                      <option value="PAS">Pasaporte</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs text-dark-400 mb-1 font-medium">
                      Número de Documento / Cédula / NIT *
                    </label>
                    <input
                      className="input-field text-xs py-2 font-mono"
                      placeholder="Ej: 1020304050 o 900123456-1"
                      value={form.nit}
                      onChange={e => setForm({ ...form, nit: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-dark-400 mb-1 font-medium">
                    Nombre Completo o Razón Social *
                  </label>
                  <input
                    className="input-field text-xs py-2 font-medium"
                    placeholder="Ej: Laura Camila Gómez o Comercializadora Los Andes SAS"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Sección 2: Contacto y Domicilios */}
              <div className="space-y-3 pt-3 border-t border-dark-700">
                <span className="text-xs font-bold text-primary-400 uppercase tracking-wider block">
                  2. Contacto y Logística de Domicilio (Opcionales)
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs text-dark-400 mb-1 font-medium">Celular / WhatsApp</label>
                    <input
                      type="tel"
                      className="input-field text-xs py-2"
                      placeholder="3101234567"
                      value={form.telefono}
                      onChange={e => setForm({ ...form, telefono: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-dark-400 mb-1 font-medium">Ciudad / Municipio</label>
                    <input
                      className="input-field text-xs py-2"
                      placeholder="Medellín / Bogotá"
                      value={form.ciudad}
                      onChange={e => setForm({ ...form, ciudad: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-dark-400 mb-1 font-medium">Dirección de Entrega / Domicilio</label>
                  <input
                    className="input-field text-xs py-2"
                    placeholder="Cra 50 # 12-34 Apto 401, Barrio Laureles"
                    value={form.direccion}
                    onChange={e => setForm({ ...form, direccion: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs text-dark-400 mb-1 font-medium">Correo Electrónico (Factura Digital)</label>
                  <input
                    type="email"
                    className="input-field text-xs py-2"
                    placeholder="cliente@ejemplo.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs text-dark-400 mb-1 font-medium">Notas / Referencias de Domicilio</label>
                  <textarea
                    rows={2}
                    className="input-field text-xs py-2 resize-none"
                    placeholder="Ej: Tocar timbre en la reja verde, horario de entrega de 2 a 6 pm..."
                    value={form.notas}
                    onChange={e => setForm({ ...form, notas: e.target.value })}
                  />
                </div>
              </div>

              {/* Botones */}
              <div className="flex items-center gap-3 pt-3 border-t border-dark-700">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold shadow-lg"
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

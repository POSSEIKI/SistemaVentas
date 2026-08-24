import { useState, useEffect } from 'react'
import { clientesApi } from '../api/services'
import { Search, Plus, Users, Phone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

const FORM_VACIO = { nombre: '', nit: '', tipo_doc: 'CC', telefono: '', email: '', ciudad: '', direccion: '' }

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
    } finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  const buscar = (q) => {
    setBusqueda(q)
    clearTimeout(window._ct)
    window._ct = setTimeout(() => cargar(q), 400)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    setGuardando(true)
    try {
      await clientesApi.crear(form)
      toast.success('Cliente creado')
      setModal(false)
      setForm(FORM_VACIO)
      cargar(busqueda)
    } catch (err) {
      toast.error(err.message || 'Error al crear cliente')
    } finally { setGuardando(false) }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Users size={22} className="text-primary-500" />
          Clientes
        </h1>
        <button className="btn-primary flex items-center gap-2 py-2 px-4" onClick={() => setModal(true)}>
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
        <input className="input-field pl-9" value={busqueda}
          onChange={e => buscar(e.target.value)} placeholder="Buscar por nombre, documento o teléfono..." />
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {cargando ? (
          <p className="text-dark-500 text-center py-8">Cargando...</p>
        ) : clientes.length === 0 ? (
          <p className="text-dark-500 text-center py-8">No hay clientes</p>
        ) : clientes.map(c => (
          <div key={c.id} className="card flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium">{c.nombre}</p>
              <p className="text-dark-500 text-xs">{c.tipo_doc}: {c.nit || '—'}</p>
            </div>
            <div className="hidden md:flex items-center gap-4 text-sm text-dark-500">
              {c.telefono && <span className="flex items-center gap-1"><Phone size={14} />{c.telefono}</span>}
              {c.email && <span className="flex items-center gap-1"><Mail size={14} />{c.email}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Modal nuevo cliente */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setModal(false)}>
          <div className="bg-dark-800 rounded-2xl w-full max-w-md"
            onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-dark-700 flex justify-between items-center">
              <h3 className="text-white font-semibold">Nuevo cliente</h3>
              <button className="text-dark-500 hover:text-white" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              {[
                ['nombre', 'Nombre completo *', 'text', 'María López'],
                ['nit', 'Documento (CC/NIT)', 'text', '12345678'],
                ['telefono', 'Teléfono', 'tel', '3101234567'],
                ['email', 'Email', 'email', 'maria@ejemplo.com'],
                ['ciudad', 'Ciudad', 'text', 'Medellín'],
                ['direccion', 'Dirección', 'text', 'Cra 10 # 20-30'],
              ].map(([campo, label, tipo, ph]) => (
                <div key={campo}>
                  <label className="block text-sm text-dark-500 mb-1">{label}</label>
                  <input type={tipo} className="input-field" placeholder={ph}
                    value={form[campo]} onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))} />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={guardar} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { configApi } from '../api/services'
import { Settings, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ParametrosPage() {
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    configApi.get().then(data => {
      setConfig(data)
      setForm(data)
    })
  }, [])

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  const guardar = async () => {
    setGuardando(true)
    try {
      await configApi.update(form)
      toast.success('Configuración guardada')
    } catch (err) {
      toast.error(err.message || 'Error al guardar')
    } finally { setGuardando(false) }
  }

  if (!config) return <div className="p-8 text-center text-dark-500">Cargando...</div>

  const campos = [
    { grupo: 'Información de la empresa', campos: [
      ['nombre', 'Nombre de la empresa', 'text'],
      ['nit', 'NIT / RUT', 'text'],
      ['telefono', 'Teléfono', 'tel'],
      ['email', 'Email', 'email'],
      ['ciudad', 'Ciudad', 'text'],
      ['direccion', 'Dirección', 'text'],
    ]},
    { grupo: 'Configuración de facturas', campos: [
      ['factura_prefijo', 'Prefijo de factura', 'text'],
      ['mensaje_factura', 'Mensaje en factura', 'text'],
      ['moneda_simbolo', 'Símbolo moneda', 'text'],
    ]},
    { grupo: 'Tarifas de domicilio', campos: [
      ['domicilio_corta', 'Zona corta ($)', 'number'],
      ['domicilio_media', 'Zona media ($)', 'number'],
      ['domicilio_larga', 'Zona larga ($)', 'number'],
    ]},
  ]

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-white flex items-center gap-2">
        <Settings size={22} className="text-primary-500" />
        Parámetros del sistema
      </h1>

      {campos.map(({ grupo, campos: cs }) => (
        <div key={grupo} className="card space-y-4">
          <h2 className="text-white font-semibold border-b border-dark-700 pb-2">{grupo}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cs.map(([campo, label, tipo]) => (
              <div key={campo}>
                <label className="block text-sm text-dark-500 mb-1">{label}</label>
                <input
                  type={tipo}
                  className="input-field"
                  value={form[campo] ?? ''}
                  onChange={e => set(campo, tipo === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button className="btn-primary flex items-center gap-2 px-8" onClick={guardar} disabled={guardando}>
        <Save size={18} />
        {guardando ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  )
}

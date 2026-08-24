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

  const RUBROS = [
    { id: 'FARMACIA',      nombre: 'Droguería / Farmacia',    desc: 'Habilita fraccionamiento (Cajas/Blisters) y búsqueda por principio activo.', icon: '💊' },
    { id: 'FERRETERIA',   nombre: 'Ferretería / Materiales', desc: 'Búsqueda por nombre comercial, referencias, marcas y bodega.', icon: '🔨' },
    { id: 'SUPERMERCADO', nombre: 'Supermercado / Víveres',  desc: 'Optimizado para códigos de barra, pesajes y venta rápida.', icon: '🛒' },
    { id: 'GENERAL',      nombre: 'Comercio General',        desc: 'Para tiendas de ropa, calzado, tecnología y servicios.', icon: '🏬' },
  ]

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-white flex items-center gap-2">
        <Settings size={22} className="text-primary-500" />
        Parámetros del Sistema
      </h1>

      {/* Selector de Rubro / Tipo de Negocio */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-white font-semibold">Tipo de Negocio / Rubro</h2>
          <p className="text-dark-500 text-xs mt-0.5">
            Configura el comportamiento del POS, la búsqueda y las opciones de inventario
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RUBROS.map(r => {
            const activo = (form.rubro || 'FARMACIA') === r.id
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => set('rubro', r.id)}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  activo
                    ? 'bg-primary-950/40 border-primary-500 ring-2 ring-primary-500/20'
                    : 'bg-dark-700/50 border-dark-700 hover:border-dark-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{r.icon}</span>
                  <span className={`text-sm font-bold ${activo ? 'text-primary-400' : 'text-white'}`}>
                    {r.nombre}
                  </span>
                </div>
                <p className="text-dark-400 text-xs leading-relaxed">{r.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

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

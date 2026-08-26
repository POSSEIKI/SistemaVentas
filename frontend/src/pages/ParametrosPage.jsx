import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Package, Users, Truck, Settings, Sliders
} from 'lucide-react'
import ParametrosProductos from './parametros/ParametrosProductos'
import ParametrosClientes from './parametros/ParametrosClientes'
import ParametrosProveedores from './parametros/ParametrosProveedores'
import ParametrosEmpresa from './parametros/ParametrosEmpresa'

const TABS = [
  { id: 'productos',   label: 'Productos',   icon: Package, desc: 'Catálogo, códigos de barra y fraccionamiento' },
  { id: 'clientes',    label: 'Clientes',    icon: Users,   desc: 'Cédulas / NITs, teléfonos y domicilios' },
  { id: 'proveedores', label: 'Proveedores', icon: Truck,   desc: 'Distribuidores, laboratorios y contactos' },
  { id: 'empresa',     label: 'Empresa',     icon: Settings, desc: 'Datos fiscales, márgenes y reglas' },
]

export default function ParametrosPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabQuery = searchParams.get('tab')
  const [tabActiva, setTabActiva] = useState(
    TABS.some(t => t.id === tabQuery) ? tabQuery : 'productos'
  )

  useEffect(() => {
    if (tabQuery && TABS.some(t => t.id === tabQuery)) {
      setTabActiva(tabQuery)
    }
  }, [tabQuery])

  const cambiarTab = (id) => {
    setTabActiva(id)
    setSearchParams({ tab: id })
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* ── Encabezado Principal del Módulo ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sliders size={22} className="text-primary-500" />
            Centro de Parametrización
          </h1>
          <p className="text-dark-400 text-xs mt-0.5">
            Configuración integral de maestros: Productos, Clientes, Proveedores y Parámetros del Sistema
          </p>
        </div>
      </div>

      {/* ── Pestañas de Navegación del Módulo ───────────────────── */}
      <div className="flex items-center gap-2 border-b border-dark-700 pb-1 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          const activo = tabActiva === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => cambiarTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all whitespace-nowrap ${
                activo
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/30'
                  : 'text-dark-400 hover:text-white hover:bg-dark-800'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Contenido de la Pestaña Activa ──────────────────────── */}
      <div className="pt-2">
        {tabActiva === 'productos' && <ParametrosProductos />}
        {tabActiva === 'clientes' && <ParametrosClientes />}
        {tabActiva === 'proveedores' && <ParametrosProveedores />}
        {tabActiva === 'empresa' && <ParametrosEmpresa />}
      </div>
    </div>
  )
}

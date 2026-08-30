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
    <div className="p-2.5 sm:p-4 w-full max-w-6xl mx-auto space-y-3 sm:space-y-4 min-w-0 overflow-x-hidden">
      {/* ── Encabezado Principal del Módulo ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Sliders size={20} className="text-primary-500 flex-shrink-0" />
            <span>Centro de Parametrización</span>
          </h1>
          <p className="text-dark-400 text-[11px] sm:text-xs mt-0.5 leading-snug">
            Configuración de Productos, Clientes, Proveedores y Parámetros del Sistema
          </p>
        </div>
      </div>

      {/* ── Pestañas de Navegación del Módulo ───────────────────── */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-dark-700 pb-1.5 overflow-x-auto no-scrollbar w-full max-w-full touch-scroll-x touch-pan-x flex-nowrap">
        {TABS.map(tab => {
          const Icon = tab.icon
          const activo = tabActiva === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => cambiarTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-semibold text-xs transition-all whitespace-nowrap flex-shrink-0 ${
                activo
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-900/30'
                  : 'text-dark-400 hover:text-white hover:bg-dark-800'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Contenido de la Pestaña Activa ──────────────────────── */}
      <div className="pt-1 w-full max-w-full min-w-0">
        {tabActiva === 'productos' && <ParametrosProductos />}
        {tabActiva === 'clientes' && <ParametrosClientes />}
        {tabActiva === 'proveedores' && <ParametrosProveedores />}
        {tabActiva === 'empresa' && <ParametrosEmpresa />}
      </div>
    </div>
  )
}

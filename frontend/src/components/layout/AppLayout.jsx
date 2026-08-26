import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { suscripcionesApi } from '../../api/services'
import {
  ShoppingCart, Package, BarChart2,
  Sliders, FileText, LogOut, Menu, Sparkles
} from 'lucide-react'
import { useState, useEffect } from 'react'

import VentasPage from '../../pages/VentasPage'
import ComprasPage from '../../pages/ComprasPage'
import InventarioPage from '../../pages/InventarioPage'
import ReportesPage from '../../pages/ReportesPage'
import ParametrosPage from '../../pages/ParametrosPage'

const NAV_ITEMS = [
  { to: '/ventas',     icon: ShoppingCart, label: 'Ventas' },
  { to: '/compras',    icon: Package,      label: 'Compras' },
  { to: '/inventario', icon: FileText,     label: 'Inventario' },
  { to: '/reportes',   icon: BarChart2,    label: 'Reportes' },
  { to: '/parametros', icon: Sliders,     label: 'Parametrización' },
]

export default function AppLayout() {
  const { usuario, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [hora, setHora] = useState(new Date())
  const [suscripcion, setSuscripcion] = useState(null)

  useEffect(() => {
    suscripcionesApi.miSuscripcion()
      .then(setSuscripcion)
      .catch(() => {})
  }, [])

  const getActiveTab = (pathname) => {
    if (pathname.startsWith('/compras')) return '/compras'
    if (pathname.startsWith('/inventario')) return '/inventario'
    if (pathname.startsWith('/reportes')) return '/reportes'
    if (pathname.startsWith('/parametros')) return '/parametros'
    return '/ventas'
  }

  const activeTab = getActiveTab(location.pathname)
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([activeTab]))

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const horaStr = hora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  const fechaStr = hora.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* ── Header Desktop ────────────────────────────────────── */}
      <header className="hidden md:flex items-center justify-between
                         bg-dark-800 border-b border-dark-700 px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-md shadow-primary-900/30">
            <ShoppingCart size={18} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">FACTUR-AAP</span>
          
          {/* Subscription Badge */}
          {suscripcion && (
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Sparkles size={13} />
              <span>
                {suscripcion.plan_nombre} {suscripcion.es_prueba ? `(${suscripcion.dias_restantes}d prueba)` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Nav desktop */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all
                ${isActive
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-900/40 font-semibold'
                  : 'text-dark-400 hover:text-white hover:bg-dark-700/80'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white text-sm font-medium">{usuario?.nombre}</p>
            <p className="text-dark-500 text-xs">{horaStr} · {fechaStr}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-dark-500 hover:text-red-400 transition-colors p-2 rounded-xl hover:bg-dark-700"
            title="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* ── Header Móvil ──────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between
                         bg-dark-800 border-b border-dark-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
            <ShoppingCart size={14} className="text-white" />
          </div>
          <span className="font-bold text-white">FACTUR-AAP</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-dark-500 text-sm">{horaStr}</span>
          <button
            onClick={handleLogout}
            className="text-dark-500 hover:text-red-400 p-1"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ── Contenido Principal con Persistencia de Vistas (Keep-Alive) ─── */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0 relative flex flex-col">
        {visitedTabs.has('/ventas') && (
          <div className={activeTab === '/ventas' ? 'flex-1 flex flex-col' : 'hidden'}>
            <VentasPage />
          </div>
        )}
        {visitedTabs.has('/compras') && (
          <div className={activeTab === '/compras' ? 'flex-1 flex flex-col' : 'hidden'}>
            <ComprasPage />
          </div>
        )}
        {visitedTabs.has('/inventario') && (
          <div className={activeTab === '/inventario' ? 'flex-1 flex flex-col' : 'hidden'}>
            <InventarioPage />
          </div>
        )}
        {visitedTabs.has('/reportes') && (
          <div className={activeTab === '/reportes' ? 'flex-1 flex flex-col' : 'hidden'}>
            <ReportesPage />
          </div>
        )}
        {visitedTabs.has('/parametros') && (
          <div className={activeTab === '/parametros' ? 'flex-1 flex flex-col' : 'hidden'}>
            <ParametrosPage />
          </div>
        )}
      </main>

      {/* ── Bottom Nav Móvil ──────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0
                      bg-dark-800 border-t border-dark-700
                      flex items-center justify-around px-2 py-2 z-50">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors min-w-0
              ${isActive ? 'text-primary-400 font-semibold' : 'text-dark-500'}`
            }
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

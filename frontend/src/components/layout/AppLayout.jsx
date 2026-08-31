import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { suscripcionesApi } from '../../api/services'
import {
  ShoppingCart, Package, BarChart2,
  Sliders, FileText, LogOut, Menu, Sparkles, Crown, RefreshCw, UserCheck
} from 'lucide-react'
import { useState, useEffect } from 'react'

import VentasPage from '../../pages/VentasPage'
import ComprasPage from '../../pages/ComprasPage'
import InventarioPage from '../../pages/InventarioPage'
import ReportesPage from '../../pages/ReportesPage'
import ParametrosPage from '../../pages/ParametrosPage'
import SuperAdminPage from '../../pages/SuperAdminPage'
import ModalCambioCajero from './ModalCambioCajero'

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
  const [modalCambioCajeroAbierto, setModalCambioCajeroAbierto] = useState(false)

  const esSuperAdmin = usuario?.rol === 'SUPER_ADMIN' || usuario?.rol?.nombre === 'SUPER_ADMIN' || usuario?.permisos?.super_admin || usuario?.username === 'superadmin'
  const esAdmin = esSuperAdmin || usuario?.rol === 'ADMINISTRADOR' || usuario?.rol_nombre === 'ADMINISTRADOR' || usuario?.permisos?.administrador_total || usuario?.id === 1 || usuario?.id === 3

  const navItemsPermitidos = NAV_ITEMS.filter(item => {
    if (esAdmin) return true
    const permisos = usuario?.permisos || {}
    if (item.to === '/ventas') return permisos.ver_ventas !== false
    if (item.to === '/inventario') return permisos.ver_inventario !== false
    if (item.to === '/compras') return permisos.ver_compras === true
    if (item.to === '/reportes') return permisos.ver_reportes === true
    if (item.to === '/parametros') return permisos.parametrizacion === true
    return true
  })

  useEffect(() => {
    suscripcionesApi.miSuscripcion()
      .then(setSuscripcion)
      .catch(() => {})
  }, [])

  const getActiveTab = (pathname) => {
    if (pathname.startsWith('/super-admin')) return esSuperAdmin ? '/super-admin' : '/ventas'
    if (pathname.startsWith('/compras')) return (esAdmin || usuario?.permisos?.ver_compras) ? '/compras' : '/ventas'
    if (pathname.startsWith('/inventario')) return (esAdmin || usuario?.permisos?.ver_inventario !== false) ? '/inventario' : '/ventas'
    if (pathname.startsWith('/reportes')) return (esAdmin || usuario?.permisos?.ver_reportes) ? '/reportes' : '/ventas'
    if (pathname.startsWith('/parametros')) return (esAdmin || usuario?.permisos?.parametrizacion) ? '/parametros' : '/ventas'
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
    <div className="h-screen max-h-screen h-[100dvh] overflow-hidden bg-dark-900 flex flex-col">
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
          {navItemsPermitidos.map(({ to, icon: Icon, label }) => (
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

          {/* Exclusivo para el Fundador / Super Admin (Oculto para el resto) */}
          {esSuperAdmin && (
            <NavLink
              to="/super-admin"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 ml-2 rounded-xl text-xs font-bold transition-all border ${
                  isActive
                    ? 'bg-amber-600 border-amber-400 text-white shadow-md shadow-amber-950/50'
                    : 'bg-amber-950/60 border-amber-500/60 text-amber-300 hover:bg-amber-900/80'
                }`
              }
            >
              <Crown size={14} className="text-amber-400" />
              <span>👑 Super Admin</span>
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {/* Botón Cambio Rápido de Cajero / Turno */}
          <button
            type="button"
            onClick={() => setModalCambioCajeroAbierto(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-dark-900 border border-dark-700 hover:border-primary-500/60 transition-all text-left group cursor-pointer"
            title="Cambiar cajero en turno"
          >
            <div className="w-8 h-8 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center font-bold text-primary-400 text-xs flex-shrink-0 group-hover:bg-primary-600 group-hover:text-white transition-colors">
              {(usuario?.nombre || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 pr-1">
              <p className="text-white text-xs font-bold truncate max-w-[130px] flex items-center gap-1">
                <span>{usuario?.nombre}</span>
              </p>
              <p className="text-primary-400 text-[10px] font-semibold flex items-center gap-1">
                <RefreshCw size={10} className="group-hover:rotate-180 transition-transform text-amber-400" />
                <span>Cambiar ({usuario?.rol || 'Cajero'})</span>
              </p>
            </div>
          </button>

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

          {esSuperAdmin && (
            <NavLink
              to="/super-admin"
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-950 border border-amber-500 text-amber-300 text-[10px] font-bold ml-1"
            >
              <Crown size={11} />
              <span>Admin</span>
            </NavLink>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalCambioCajeroAbierto(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-dark-900 border border-dark-700 text-xs text-white font-bold"
          >
            <RefreshCw size={12} className="text-primary-400" />
            <span className="truncate max-w-[90px]">{(usuario?.nombre || '').split(' ')[0]}</span>
          </button>
          <button
            onClick={handleLogout}
            className="text-dark-500 hover:text-red-400 p-1"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Modal Cambio Rápido de Cajero */}
      <ModalCambioCajero
        abierto={modalCambioCajeroAbierto}
        alCerrar={() => setModalCambioCajeroAbierto(false)}
      />

      {/* ── Contenido Principal con Persistencia de Vistas (Keep-Alive) ─── */}
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full max-w-full pb-24 md:pb-8 relative flex flex-col min-w-0">
        {visitedTabs.has('/ventas') && (
          <div className={activeTab === '/ventas' ? 'h-full flex-1 flex flex-col w-full max-w-full min-w-0 overflow-hidden' : 'hidden'}>
            <VentasPage />
          </div>
        )}
        {visitedTabs.has('/compras') && (
          <div className={activeTab === '/compras' ? 'w-full max-w-full min-w-0 flex flex-col' : 'hidden'}>
            <ComprasPage />
          </div>
        )}
        {visitedTabs.has('/inventario') && (
          <div className={activeTab === '/inventario' ? 'w-full max-w-full min-w-0 flex flex-col' : 'hidden'}>
            <InventarioPage />
          </div>
        )}
        {visitedTabs.has('/reportes') && (
          <div className={activeTab === '/reportes' ? 'w-full max-w-full min-w-0 flex flex-col' : 'hidden'}>
            <ReportesPage />
          </div>
        )}
        {visitedTabs.has('/parametros') && (
          <div className={activeTab === '/parametros' ? 'w-full max-w-full min-w-0 flex flex-col' : 'hidden'}>
            <ParametrosPage />
          </div>
        )}
        {visitedTabs.has('/super-admin') && (
          <div className={activeTab === '/super-admin' ? 'w-full max-w-full min-w-0 flex flex-col' : 'hidden'}>
            <SuperAdminPage />
          </div>
        )}
      </main>

      {/* ── Bottom Nav Móvil ──────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0
                      bg-dark-800 border-t border-dark-700
                      flex items-center justify-around px-2 py-2 z-50">
        {navItemsPermitidos.map(({ to, icon: Icon, label }) => (
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

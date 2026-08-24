import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import {
  ShoppingCart, Package, BarChart2, Users,
  Settings, FileText, LogOut, Menu
} from 'lucide-react'
import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { to: '/ventas',     icon: ShoppingCart, label: 'Ventas' },
  { to: '/compras',    icon: Package,       label: 'Compras' },
  { to: '/inventario', icon: FileText,      label: 'Inventario' },
  { to: '/clientes',   icon: Users,         label: 'Clientes' },
  { to: '/reportes',   icon: BarChart2,     label: 'Reportes' },
  { to: '/parametros', icon: Settings,      label: 'Config' },
]

export default function AppLayout() {
  const { usuario, logout } = useAuthStore()
  const navigate = useNavigate()
  const [hora, setHora] = useState(new Date())

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
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <ShoppingCart size={18} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg">SistemaVentas</span>
        </div>

        {/* Nav desktop */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-dark-500 hover:text-white hover:bg-dark-700'
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
            className="text-dark-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-dark-700"
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
          <span className="font-bold text-white">SistemaVentas</span>
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

      {/* ── Contenido principal ───────────────────────────────── */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <Outlet />
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
              ${isActive ? 'text-primary-400' : 'text-dark-500'}`
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

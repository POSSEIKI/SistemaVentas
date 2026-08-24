import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useAuthStore } from './stores/authStore'
import { authApi } from './api/services'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import VentasPage from './pages/VentasPage'
import ComprasPage from './pages/ComprasPage'
import InventarioPage from './pages/InventarioPage'
import ClientesPage from './pages/ClientesPage'
import ReportesPage from './pages/ReportesPage'
import ParametrosPage from './pages/ParametrosPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function RequireAuth({ children }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const [checking, setChecking] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const token = useAuthStore(s => s.token)

  useEffect(() => {
    authApi.checkSetup()
      .then(data => setNeedsSetup(data.setup_requerido))
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-primary-500 text-lg animate-pulse">Cargando...</div>
      </div>
    )
  }

  if (needsSetup) {
    return (
      <Routes>
        <Route path="*" element={<SetupPage onSetupComplete={() => setNeedsSetup(false)} />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Navigate to="/ventas" replace />} />
        <Route path="ventas" element={<VentasPage />} />
        <Route path="compras" element={<ComprasPage />} />
        <Route path="inventario" element={<InventarioPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="parametros" element={<ParametrosPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' },
            success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

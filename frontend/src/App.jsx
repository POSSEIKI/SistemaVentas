import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import api from './api/client'

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
  const token = useAuthStore(s => s.token)

  return (
    <Routes>
      {/* ─── RUTAS PÚBLICAS ─── */}
      <Route path="/" element={token ? <Navigate to="/ventas" replace /> : <LandingPage />} />
      <Route path="/inicio" element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={token ? <Navigate to="/ventas" replace /> : <LoginPage />} />
      <Route path="/registro" element={token ? <Navigate to="/ventas" replace /> : <SignUpPage />} />

      {/* ─── SISTEMA POS PROTEGIDO ─── */}
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/ventas" element={null} />
        <Route path="/compras" element={null} />
        <Route path="/inventario" element={null} />
        <Route path="/clientes" element={<Navigate to="/parametros?tab=clientes" replace />} />
        <Route path="/reportes" element={null} />
        <Route path="/parametros" element={null} />
        <Route path="/super-admin" element={null} />
      </Route>

      {/* ─── CUALQUIER OTRA RUTA ─── */}
      <Route path="*" element={<Navigate to={token ? "/ventas" : "/"} replace />} />
    </Routes>
  )
}

export default function App() {
  useEffect(() => {
    // Keep-alive heartbeat cada 3 minutos para mantener el backend activo y sin demoras
    const pingServer = () => {
      api.get('/health').catch(() => {})
    }
    pingServer()
    const interval = setInterval(pingServer, 180000)
    return () => clearInterval(interval)
  }, [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-center"
            toastOptions={{
              style: { background: '#0f172a', color: '#fff', border: '1px solid #334155' },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

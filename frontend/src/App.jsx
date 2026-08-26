import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useAuthStore } from './stores/authStore'
import { authApi } from './api/services'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import SetupPage from './pages/SetupPage'

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-emerald-400 text-lg font-semibold animate-pulse">Cargando FACTUR-AAP...</div>
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
      </Route>

      {/* ─── CUALQUIER OTRA RUTA ─── */}
      <Route path="*" element={<Navigate to={token ? "/ventas" : "/"} replace />} />
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
            style: { background: '#0f172a', color: '#fff', border: '1px solid #334155' },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

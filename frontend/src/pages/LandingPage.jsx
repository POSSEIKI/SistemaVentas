import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, Package, FileText, CheckCircle, Zap,
  ShieldCheck, Smartphone, Printer, Search, ArrowRight,
  ChevronDown, ChevronUp, Star, Sparkles, TrendingUp,
  Users, HelpCircle, Layers, Activity, Check, LogIn, UserPlus,
  Clock, Shield, BarChart3, Pill, Wrench, Store, RefreshCw
} from 'lucide-react'
import { suscripcionesApi } from '../api/services'
import { useAuthStore } from '../stores/authStore'

const DEFAULT_PLANES = [
  {
    id: 1,
    codigo: 'BASICO',
    nombre: 'Plan Emprendedor',
    descripcion: 'Ideal para pequeños negocios y tiendas que inician con punto de venta.',
    precio_mensual: 35000,
    precio_anual: 350000,
    destacado: false,
    caracteristicas: JSON.stringify([
      'Hasta 500 productos en catálogo',
      '1 usuario cajero / admin',
      'Facturación e impresión tirilla 58/80mm',
      'Control básico de inventario y caja'
    ])
  },
  {
    id: 2,
    codigo: 'PRO',
    nombre: 'Plan Pro Negocios',
    descripcion: 'Control total de inventario, productos ilimitados, facturación DIAN e importación de facturas para todo tipo de negocio.',
    precio_mensual: 65000,
    precio_anual: 650000,
    destacado: true,
    caracteristicas: JSON.stringify([
      'Productos y ventas ilimitadas',
      'Venta por unidades, cajas o fracciones',
      'Facturación Electrónica DIAN y POS',
      'Importador automático PDF y Excel',
      'Control de lotes y fechas de vencimiento',
      'Tirilla WhatsApp y Correo para clientes'
    ])
  },
  {
    id: 3,
    codigo: 'ENTERPRISE',
    nombre: 'Plan Empresarial & Multi-Sede',
    descripcion: 'Para empresas con múltiples sucursales, alta rotación y necesidades corporativas.',
    precio_mensual: 120000,
    precio_anual: 1200000,
    destacado: false,
    caracteristicas: JSON.stringify([
      'Todo lo del Plan Pro Negocios',
      'Soporte Multi-Sucursal y bodegas centrales',
      'Usuarios y cajeros ilimitados',
      'Auditoría y reportes gerenciales',
      'Soporte prioritario 24/7 y backups dedicados'
    ])
  }
]

export default function LandingPage() {
  const navigate = useNavigate()
  const token = useAuthStore(s => s.token)
  const usuario = useAuthStore(s => s.usuario)

  const [periodoAnual, setPeriodoAnual] = useState(false)
  const [planes, setPlanes] = useState(DEFAULT_PLANES)
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const [faqAbierta, setFaqAbierta] = useState(null)
  const [rubroActivo, setRubroActivo] = useState('FARMACIA')

  useEffect(() => {
    suscripcionesApi.planesPublicos()
      .then(data => {
        if (data && data.length > 0) setPlanes(data)
      })
      .catch(err => console.error('Error cargando planes:', err))
  }, [])

  const faqs = [
    {
      q: '¿Cómo funciona la prueba gratuita de 14 días?',
      a: 'Al registrarte obtienes acceso inmediato e ilimitado al Plan Pro sin necesidad de ingresar tarjeta de crédito ni datos bancarios. Puedes probar todas las funciones, cargar tus productos y facturar desde el primer minuto.'
    },
    {
      q: '¿Puedo usar el sistema en mi celular o tablet además del computador?',
      a: 'Sí, 100%. El sistema está optimizado para funcionar de manera fluida en cualquier navegador en PC, computadores portátiles, tablets Android/iPad y celulares, con interfaz táctil y teclado numérico adaptado.'
    },
    {
      q: '¿Cómo funciona la importación de facturas PDF y Coopidrogas .DAT?',
      a: 'Solo debes arrastrar el archivo PDF de la distribuidora (LOINPRO, Libellum, Copservir, Audifarma, DIAN) o el archivo .DAT oficial. Nuestro motor inteligente extrae automáticamente los medicamentos, precios de compra, lotes, fechas de vencimiento y contenido de caja.'
    },
    {
      q: '¿Qué impresoras térmicas de tirilla son compatibles?',
      a: 'Cualquier impresora térmica estándar de 58mm o 80mm conectada por USB, Bluetooth o Red, además de formatos estándar en papel carta. También puedes enviar la tirilla directamente a los clientes por WhatsApp o Correo.'
    },
    {
      q: '¿Mis datos e inventario están seguros en la nube?',
      a: 'Toda tu información está protegida con cifrado SSL de extremo a extremo, en bases de datos PostgreSQL con copias de seguridad continuas y alta disponibilidad.'
    }
  ]

  const formatCOP = (num) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(num || 0)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white font-sans antialiased">
      {/* ─── NAVBAR SUPERIOR ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
              <ShoppingCart size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                  FACTUR-AAP
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Cloud POS
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Farmacias & Comercios en la Nube</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#beneficios" className="hover:text-emerald-400 transition-colors">Beneficios</a>
            <a href="#especialidades" className="hover:text-emerald-400 transition-colors">Farmacias & Ferreterías</a>
            <a href="#planes" className="hover:text-emerald-400 transition-colors">Planes y Precios</a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">Preguntas Frecuentes</a>
          </nav>

          <div className="flex items-center gap-3">
            {token ? (
              <Link
                to="/ventas"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/40 transition-all"
              >
                <span>Ir al Sistema POS</span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium text-sm transition-all"
                >
                  <LogIn size={16} />
                  <span>Ingresar</span>
                </Link>
                <Link
                  to="/registro"
                  className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.02] transition-all"
                >
                  <UserPlus size={16} />
                  <span>Probar Gratis</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
        {/* Glow ambient effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-semibold mb-6 animate-pulse">
            <Sparkles size={16} />
            <span>El POS & ERP en la Nube más rápido para Colombia y Latam</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
            Ventas rápidas, inventario inteligente y control{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              sin límites en la web
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Diseñado especialmente para droguerías, farmacias, ferreterías y comercios. 
            Fraccionamiento de medicamentos, búsqueda por sustancia genérica, importación masiva de facturas PDF y tirilla térmica 58/80mm.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/registro"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all"
            >
              <span>Comenzar Prueba Gratis (14 Días)</span>
              <ArrowRight size={18} />
            </Link>

            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white font-semibold text-base transition-all"
            >
              <LogIn size={18} className="text-emerald-400" />
              <span>Ya tengo una cuenta</span>
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs sm:text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={16} className="text-emerald-400" />
              <span>Sin tarjeta de crédito</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle size={16} className="text-emerald-400" />
              <span>Activación en 30 segundos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle size={16} className="text-emerald-400" />
              <span>Cancela cuando quieras</span>
            </div>
          </div>

          {/* Interactive Live POS Showcase Card */}
          <div className="mt-14 max-w-5xl mx-auto rounded-3xl p-3 bg-gradient-to-b from-slate-800/80 to-slate-900/60 border border-slate-700/80 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl">
            <div className="rounded-2xl bg-slate-950 border border-slate-800/90 p-4 sm:p-8 text-left">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="text-xs text-slate-400 font-mono">app.factur-aap.cloud / demo-pos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/70 border border-emerald-800/60 text-emerald-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    En Vivo & Conectado
                  </span>
                </div>
              </div>

              {/* Grid Demo Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between hover:border-emerald-500/40 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                      <Pill size={16} />
                      <span>Farmacias & Droguerías</span>
                    </div>
                    <h4 className="text-white font-bold text-sm">IBUPROFENO 800MG X 300 TAB</h4>
                    <p className="text-xs text-slate-400 mt-1">Sustancia: Ibuprofeno • Lab: LOINPRO</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">Caja • Blíster • Unidad</span>
                    <span className="text-white font-bold">$77.350</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between hover:border-teal-500/40 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-wider mb-2">
                      <FileText size={16} />
                      <span>Importador PDF & DAT</span>
                    </div>
                    <h4 className="text-white font-bold text-sm">Factura LOINPRO LIP 104583</h4>
                    <p className="text-xs text-slate-400 mt-1">8 ítems detectados • Lotes y Vencimientos</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 font-medium">100% Automático</span>
                    <span className="text-emerald-400 font-bold">Carga Instantánea</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between hover:border-cyan-500/40 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                      <Printer size={16} />
                      <span>Tirilla POS & Envíos</span>
                    </div>
                    <h4 className="text-white font-bold text-sm">Tirilla 58mm / 80mm / Carta</h4>
                    <p className="text-xs text-slate-400 mt-1">Envío a WhatsApp y Email del cliente</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-medium">PC & Móvil</span>
                    <span className="text-white font-bold">Térmica USB/BT</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CARACTERÍSTICAS / BENEFICIOS CLAVE ───────────────────────────── */}
      <section id="beneficios" className="py-20 bg-slate-900/50 border-t border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">
              Todo lo que tu negocio necesita en un solo lugar
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Potencia tus ventas y olvídate de los cuadres manuales
            </p>
            <p className="text-slate-400 mt-4 text-base">
              Construido con tecnología moderna para responder al instante, sin caídas y disponible en cualquier dispositivo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                <Zap size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Ventas en menos de 3 segundos</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Escaneo instantáneo con lector de código de barras, atajos de teclado F2-F10 para cobrar y cálculo automático de cambio.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-teal-500 group-hover:text-slate-950 transition-all">
                <Pill size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Venta Fraccionada Caja / Blíster / Unidad</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Si no quieres vender por unidad, pon 0 y el sistema oculta la casilla en la caja. Precios automáticos por presentación.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-all">
                <Search size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Búsqueda por Sustancia Genérica</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Encuentra alternativas médicas al instante buscando por Principio Activo (ej: Ibuprofeno, Acetaminofén, Amoxicilina).
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                <FileText size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Importador Facturas PDF & Coopidrogas</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Carga facturas PDF de distribuidoras y archivos .DAT de Coopidrogas. Extrae cantidades, costos, lotes y vencimientos sin digitar a mano.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-slate-950 transition-all">
                <Printer size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Tirilla POS Térmica 58mm / 80mm</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Impresión directa en cualquier impresora térmica y formatos carta, con envío digital a WhatsApp y correo para clientes móviles.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-purple-500 group-hover:text-slate-950 transition-all">
                <Smartphone size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">100% en la Nube / Multi-Dispositivo</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                No gasta memoria ni procesador de tu PC. Accede desde tu computador de caja, tablet o celular desde cualquier lugar del mundo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TABLA DE PLANES Y PRECIOS ────────────────────────────────────── */}
      <section id="planes" className="py-20 lg:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">
              Precios Claros y Transparentes
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Elige el plan ideal para tu negocio
            </p>
            <p className="text-slate-400 mt-4 text-base">
              Todos los planes incluyen 14 días de prueba gratuita. Sin contratos de permanencia ni cobros ocultos.
            </p>

            {/* Toggle Mensual / Anual */}
            <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => setPeriodoAnual(false)}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                  !periodoAnual
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setPeriodoAnual(true)}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  periodoAnual
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Anual</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 text-[10px] font-extrabold border border-emerald-700/50">
                  2 MESES GRATIS (-20%)
                </span>
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {(Array.isArray(planes) && planes.length > 0 ? planes : DEFAULT_PLANES).map((plan) => {
              const precio = periodoAnual ? Number(plan.precio_anual || 0) / 12 : Number(plan.precio_mensual || 0)
              let itemsCaract = []
              try {
                if (Array.isArray(plan.caracteristicas)) {
                  itemsCaract = plan.caracteristicas
                } else if (typeof plan.caracteristicas === 'string') {
                  const parsed = JSON.parse(plan.caracteristicas || '[]')
                  itemsCaract = Array.isArray(parsed) ? parsed : []
                }
              } catch (e) {
                itemsCaract = []
              }
              if (!Array.isArray(itemsCaract)) itemsCaract = []

              return (
                <div
                  key={plan.id}
                  className={`rounded-3xl p-8 flex flex-col justify-between relative transition-all duration-300 ${
                    plan.destacado
                      ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500 shadow-2xl shadow-emerald-950/60 lg:-translate-y-2'
                      : 'bg-slate-900/60 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {plan.destacado && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg">
                      MÁS POPULAR / RECOMENDADO
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{plan.nombre}</h3>
                    <p className="text-xs text-slate-400 min-h-[36px]">{plan.descripcion}</p>

                    <div className="mt-6 mb-8 pb-6 border-b border-slate-800">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-white">
                          {formatCOP(precio)}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">/ mes</span>
                      </div>
                      {periodoAnual ? (
                        <p className="text-xs text-emerald-400 font-semibold mt-1.5">
                          Facturado anualmente {formatCOP(plan.precio_anual)} / año
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-1.5">Facturado mes a mes</p>
                      )}
                    </div>

                    <ul className="space-y-3 text-sm text-slate-300">
                      {(Array.isArray(itemsCaract) ? itemsCaract : []).map((c, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <Check size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 pt-6">
                    <Link
                      to={`/registro?plan=${plan.codigo}&periodo=${periodoAnual ? 'ANUAL' : 'MENSUAL'}`}
                      className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        plan.destacado
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                      }`}
                    >
                      <span>Probar 14 Días Gratis</span>
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── PREGUNTAS FRECUENTES (FAQ) ──────────────────────────────────── */}
      <section id="faq" className="py-20 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">
              Resolvemos tus dudas
            </h2>
            <p className="text-3xl font-extrabold text-white">Preguntas Frecuentes</p>
          </div>

          <div className="space-y-4">
            {(Array.isArray(faqs) ? faqs : []).map((f, i) => {
              const isOpen = faqAbierta === i
              return (
                <div
                  key={i}
                  className="rounded-2xl bg-slate-950/80 border border-slate-800 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setFaqAbierta(isOpen ? null : i)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 font-semibold text-white hover:text-emerald-400 transition-colors"
                  >
                    <span>{f.q}</span>
                    {isOpen ? <ChevronUp size={20} className="text-emerald-400" /> : <ChevronDown size={20} className="text-slate-500" />}
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-slate-300 border-t border-slate-800/50 pt-4 leading-relaxed">
                      {f.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── BANNER FINAL CTA ─────────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="rounded-3xl p-10 sm:p-14 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border border-emerald-800/60 shadow-2xl text-center">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              ¿Listo para modernizar tu negocio hoy?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
              Únete a las droguerías y comercios que ya ahorran horas de trabajo al día con FACTUR-AAP Cloud.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/registro"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/30 hover:scale-[1.02] transition-all"
              >
                Comenzar Prueba Gratis (14 Días)
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 border border-slate-700 text-white font-semibold text-base hover:bg-slate-800 transition-all"
              >
                Ingresar a mi Cuenta
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-400" />
            <span className="text-white font-bold text-sm">FACTUR-AAP Cloud</span>
            <span>© {new Date().getFullYear()} Todos los derechos reservados.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-emerald-400 transition-colors">Iniciar Sesión</Link>
            <Link to="/registro" className="hover:text-emerald-400 transition-colors">Crear Cuenta</Link>
            <a href="#planes" className="hover:text-emerald-400 transition-colors">Planes</a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

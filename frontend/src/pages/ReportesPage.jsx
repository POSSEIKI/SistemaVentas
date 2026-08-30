import { useState, useEffect } from 'react'
import { facturasApi, configApi } from '../api/services'
import ModalTicketFactura from '../components/ticket/ModalTicketFactura'
import { BarChart2, TrendingUp, FileText, DollarSign, RotateCcw, Ticket, Banknote, X, CheckCircle2, AlertTriangle, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatearFechaHora, obtenerFechaHoyLocal } from '../utils/fechas'

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0)
}

export default function ReportesPage() {
  const [resumen, setResumen] = useState(null)
  const [facturas, setFacturas] = useState([])
  const [fecha, setFecha] = useState(() => obtenerFechaHoyLocal())
  const [cargando, setCargando] = useState(true)
  const [zonaHoraria, setZonaHoraria] = useState('America/Bogota')

  // Modal Devolución / Bono
  const [modalDevolucion, setModalDevolucion] = useState(null) // factura seleccionada
  const [motivoDevolucion, setMotivoDevolucion] = useState('')
  const [tipoReembolso, setTipoReembolso] = useState('BONO') // 'BONO' | 'EFECTIVO' | 'TRANSFERENCIA'
  const [pinAutorizacion, setPinAutorizacion] = useState('')
  const [procesandoDev, setProcesandoDev] = useState(false)
  const [resultadoDevolucion, setResultadoDevolucion] = useState(null)
  const [facturaTicket, setFacturaTicket] = useState(null) // Comprobante para visor/impresión/reimpresión

  const cargar = async (f) => {
    setCargando(true)
    try {
      const [res, facts] = await Promise.all([
        facturasApi.resumenDia(f),
        facturasApi.listar({ fecha_inicio: f, fecha_fin: f }),
      ])
      setResumen(res)
      setFacturas(facts)
    } finally { setCargando(false) }
  }

  useEffect(() => {
    configApi.get().then(cfg => {
      if (cfg?.zona_horaria) {
        setZonaHoraria(cfg.zona_horaria)
        setFecha(obtenerFechaHoyLocal(cfg.zona_horaria))
      }
    }).catch(() => {})
  }, [])

  useEffect(() => { cargar(fecha) }, [fecha])

  const handleProcesarDevolucion = async (e) => {
    e.preventDefault()
    if (!motivoDevolucion.trim()) {
      toast.error('Por favor especifique el motivo de la devolución')
      return
    }

    setProcesandoDev(true)
    try {
      const res = await facturasApi.devolucion(modalDevolucion.id, {
        motivo: motivoDevolucion.trim(),
        tipo_reembolso: tipoReembolso,
        pin_autorizacion: pinAutorizacion.trim() || undefined,
      })
      toast.success(res.mensaje || 'Devolución procesada exitosamente')
      setResultadoDevolucion(res)
      setModalDevolucion(null)
      setPinAutorizacion('')
      cargar(fecha)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error procesando devolución')
    } finally {
      setProcesandoDev(false)
    }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart2 size={22} className="text-primary-500" />
          Reportes y Devoluciones
        </h1>
        <input type="date" className="input-field w-auto py-2 font-mono text-sm" value={fecha}
          onChange={e => setFecha(e.target.value)} />
      </div>

      {/* Tarjetas resumen */}
      {resumen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Ventas del día', valor: formatCOP(resumen.total_ventas), icon: TrendingUp, color: 'text-primary-400' },
            { label: 'Facturas emitidas', valor: resumen.total_facturas, icon: FileText, color: 'text-blue-400' },
            { label: 'IVA generado', valor: formatCOP(resumen.total_iva), icon: DollarSign, color: 'text-yellow-400' },
          ].map(({ label, valor, icon: Icon, color }) => (
            <div key={label} className="card p-3 sm:p-4">
              <Icon size={20} className={`${color} mb-2`} />
              <p className="text-dark-500 text-xs">{label}</p>
              <p className={`text-xl sm:text-2xl font-bold font-mono ${color}`}>{valor}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabla de facturas */}
      <div className="card p-0 shadow-lg border border-dark-700 w-full max-w-full overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-700 flex justify-between items-center bg-dark-800/90">
          <h2 className="text-white font-semibold text-sm">Facturas del día</h2>
          <span className="text-dark-500 text-xs font-mono">{facturas.length} comprobantes</span>
        </div>
        <div className="overflow-x-auto w-full max-w-full touch-scroll-x table-responsive-container">
          <table className="w-full min-w-[740px] text-sm">
            <thead className="border-b border-dark-700 bg-dark-900/40">
              <tr className="text-dark-500 text-left text-xs uppercase tracking-wider">
                <th className="px-4 py-3">N° Factura</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Forma pago</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-dark-700/60">
            {cargando ? (
              <tr><td colSpan={7} className="text-center py-6 text-dark-500">Cargando facturas...</td></tr>
            ) : facturas.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-6 text-dark-500">No hay ventas registradas en esta fecha</td></tr>
            ) : facturas.map(f => {
              const estaAnulada = f.estado === 'ANULADA' || f.estado === 'DEVUELTA'
              return (
                <tr key={f.id} className="hover:bg-dark-700/40 transition-colors">
                  <td className="px-4 py-3 text-white font-mono font-bold">{f.numero}</td>
                  <td className="px-4 py-3 text-dark-400 font-mono text-xs">
                    {f.fecha ? formatearFechaHora(f.fecha, zonaHoraria, { hour: '2-digit', minute: '2-digit', year: undefined, month: undefined, day: undefined, second: undefined }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-dark-300 font-medium truncate max-w-xs">
                    {f.cliente_nombre || 'Cliente Mostrador'}
                  </td>
                  <td className="px-4 py-3 text-dark-400 text-xs">
                    <span className="bg-dark-900 px-2 py-0.5 rounded border border-dark-700 font-mono">
                      {f.forma_pago}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        f.estado === 'EMITIDA'
                          ? 'bg-green-500/10 text-green-400 border-green-500/30'
                          : f.estado === 'DEVUELTA'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}>
                        {f.estado}
                      </span>
                      {f.dian_estado === 'VALIDADA' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700 font-mono" title="Factura validada y aceptada por la DIAN">
                          ⚡ DIAN
                        </span>
                      )}
                      {f.dian_estado === 'RECHAZADA' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-950/80 text-red-300 border border-red-700 font-mono" title="Rechazada por la DIAN">
                          ⚠️ DIAN
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-primary-400 font-bold font-mono">
                    {formatCOP(f.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const full = await facturasApi.get(f.id)
                            setFacturaTicket(full)
                          } catch {
                            toast.error('Error al cargar datos del comprobante')
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-dark-700 hover:bg-primary-600/20 hover:text-primary-300 hover:border-primary-500/50 border border-dark-600 text-xs text-dark-300 font-semibold transition-all flex items-center gap-1"
                        title="Ver comprobante, imprimir en 80mm/58mm/Carta o enviar por WhatsApp"
                      >
                        <Printer size={13} />
                        <span>Ticket</span>
                      </button>

                      {!estaAnulada ? (
                        <button
                          type="button"
                          onClick={() => {
                            setModalDevolucion(f)
                            setMotivoDevolucion('')
                            setTipoReembolso('BONO')
                          }}
                          className="px-2.5 py-1 rounded-lg bg-dark-700 hover:bg-amber-600/20 hover:text-amber-300 hover:border-amber-500/50 border border-dark-600 text-xs text-dark-300 font-semibold transition-all flex items-center gap-1"
                          title="Procesar devolución de dinero o generar Bono"
                        >
                          <RotateCcw size={13} />
                          <span>Devolución</span>
                        </button>
                      ) : (
                        <span className="text-dark-500 text-[11px] font-mono italic px-1.5">Anulada</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* ── MODAL: PROCESAR DEVOLUCIÓN (EFECTIVO O BONO) ──────────── */}
      {modalDevolucion && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setModalDevolucion(null)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-lg p-6 border border-dark-700 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-dark-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <RotateCcw size={18} className="text-amber-400" />
                  Devolución de Factura {modalDevolucion.numero}
                </h3>
                <p className="text-dark-400 text-xs mt-0.5">
                  Cliente: <strong className="text-white">{modalDevolucion.cliente_nombre || 'Cliente Mostrador'}</strong> · Total: <strong className="text-primary-400 font-mono">{formatCOP(modalDevolucion.total)}</strong>
                </p>
              </div>
              <button
                onClick={() => setModalDevolucion(null)}
                className="text-dark-500 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleProcesarDevolucion} className="space-y-4">
              <div>
                <label className="block text-xs text-dark-400 font-semibold mb-1.5 uppercase tracking-wide">
                  Motivo de la Devolución *
                </label>
                <input
                  className="input-field text-sm"
                  placeholder="Ej: Medicamento fuera del mercado / Agotado / Solicitud del cliente"
                  value={motivoDevolucion}
                  onChange={e => setMotivoDevolucion(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-dark-400 font-semibold mb-2 uppercase tracking-wide">
                  Método de Reembolso al Cliente *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoReembolso('BONO')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      tipoReembolso === 'BONO'
                        ? 'bg-blue-950/60 border-blue-500 text-white shadow-lg shadow-blue-950/50'
                        : 'bg-dark-700/60 border-dark-600 text-dark-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-sm mb-1">
                      <Ticket size={18} />
                      <span>Generar Bono</span>
                    </div>
                    <p className="text-[11px] text-dark-400 leading-tight">
                      Crea un código de bono a favor del cliente para redimir en compras futuras.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoReembolso('EFECTIVO')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      tipoReembolso === 'EFECTIVO'
                        ? 'bg-green-950/60 border-green-500 text-white shadow-lg shadow-green-950/50'
                        : 'bg-dark-700/60 border-dark-600 text-dark-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-green-400 font-bold text-sm mb-1">
                      <Banknote size={18} />
                      <span>Reembolso Efectivo</span>
                    </div>
                    <p className="text-[11px] text-dark-400 leading-tight">
                      Reintegra los <strong className="text-white font-mono">{formatCOP(modalDevolucion.total)}</strong> de la caja registradora.
                    </p>
                  </button>
                </div>
              </div>

              {/* Autorización de Administrador */}
              <div className="space-y-1.5 bg-dark-900/60 p-3 rounded-xl border border-dark-700">
                <div className="flex justify-between items-center">
                  <label className="block text-xs text-dark-300 font-semibold uppercase tracking-wide">
                    🔒 PIN / Clave de Administrador {tipoReembolso === 'EFECTIVO' ? '*' : '(Opcional)'}
                  </label>
                  {tipoReembolso === 'EFECTIVO' && (
                    <span className="text-[10px] bg-red-950 text-red-300 px-2 py-0.5 rounded font-bold border border-red-800">
                      Obligatorio para Efectivo
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  className="input-field text-sm font-mono tracking-widest"
                  placeholder="Ingresa PIN o contraseña de Administrador"
                  value={pinAutorizacion}
                  onChange={e => setPinAutorizacion(e.target.value)}
                  required={tipoReembolso === 'EFECTIVO'}
                />
                <p className="text-[11px] text-dark-400">
                  {tipoReembolso === 'EFECTIVO'
                    ? 'Por seguridad de caja y prevención de fraudes, la salida de efectivo requiere autorización de un Administrador.'
                    : 'Si el usuario activo es Cajero, ingrese el PIN para autorizar la devolución.'}
                </p>
              </div>

              <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 text-xs text-amber-300/90 flex gap-2.5">
                <AlertTriangle size={18} className="flex-shrink-0 text-amber-400" />
                <p>
                  Al procesar la devolución, los productos retornarán automáticamente al inventario físico con registro de auditoría y la factura quedará marcada como DEVUELTA.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalDevolucion(null)}
                  className="btn-secondary flex-1 py-2.5 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoDev}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold"
                >
                  {procesandoDev ? 'Procesando...' : '✓ Confirmar Devolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRMACIÓN Y BONO GENERADO ──────────────────── */}
      {resultadoDevolucion && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setResultadoDevolucion(null)}
        >
          <div
            className="bg-dark-800 rounded-2xl w-full max-w-md p-6 border border-primary-600 shadow-2xl space-y-4 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-green-600/20 text-green-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>

            <h3 className="text-lg font-bold text-white">¡Devolución Procesada con Éxito!</h3>
            <p className="text-dark-400 text-xs">
              {resultadoDevolucion.mensaje}
            </p>

            {resultadoDevolucion.bono && (
              <div className="bg-gradient-to-br from-blue-950/80 to-dark-900 border-2 border-dashed border-blue-500/60 rounded-2xl p-5 space-y-2.5 text-left my-3 shadow-inner">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Ticket size={15} /> Bono de Compra Oficial
                  </span>
                  <span className="text-xs text-green-400 font-bold bg-green-950/60 px-2 py-0.5 rounded border border-green-800 font-mono">
                    ACTIVO
                  </span>
                </div>
                <div className="text-center py-2">
                  <p className="text-xs text-dark-400">Código para redimir en el POS:</p>
                  <p className="text-2xl font-mono font-extrabold text-white tracking-widest bg-dark-950/80 py-2 px-3 rounded-lg border border-dark-700 select-all my-1">
                    {resultadoDevolucion.bono.codigo}
                  </p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-dark-700 text-xs">
                  <span className="text-dark-400">Saldo a Favor:</span>
                  <strong className="text-green-400 text-base font-mono">
                    {formatCOP(resultadoDevolucion.bono.saldo_disponible)}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-dark-400">Titular (C.C. / NIT):</span>
                  <strong className="text-white truncate max-w-[200px]">
                    {resultadoDevolucion.bono.cliente_nombre} ({resultadoDevolucion.bono.cliente_nit || ''})
                  </strong>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resultadoDevolucion.bono.codigo)
                      toast.success('📋 Código del bono copiado al portapapeles')
                    }}
                    className="btn-secondary flex-1 py-1.5 text-xs flex items-center justify-center gap-1"
                  >
                    <span>📋 Copiar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const msg = encodeURIComponent(`🧾 *FACTUR-AAP - BONO DE COMPRA*\n\nHola! Se ha emitido un Bono a tu favor por devolución:\n\n🎟️ *Código:* ${resultadoDevolucion.bono.codigo}\n💰 *Saldo a favor:* ${formatCOP(resultadoDevolucion.bono.saldo_disponible)}\n👤 *Titular:* ${resultadoDevolucion.bono.cliente_nombre} (${resultadoDevolucion.bono.cliente_nit || ''})\n\nPuedes presentarlo en tu próxima compra para redimirlo en caja.`)
                      window.open(`https://wa.me/?text=${msg}`, '_blank')
                    }}
                    className="btn-primary flex-1 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 border-emerald-500 flex items-center justify-center gap-1 font-bold shadow-md"
                  >
                    <span>📱 Enviar WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setResultadoDevolucion(null)}
              className="btn-primary w-full py-2.5 text-xs font-bold"
            >
              Aceptar y Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de Visualización, Impresión y Envío de Comprobante / Ticket ── */}
      {facturaTicket && (
        <ModalTicketFactura
          factura={facturaTicket}
          onCerrar={() => setFacturaTicket(null)}
        />
      )}

    </div>
  )
}

import { useState, useEffect } from 'react'
import { facturasApi } from '../api/services'
import { BarChart2, TrendingUp, FileText, DollarSign } from 'lucide-react'

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}

export default function ReportesPage() {
  const [resumen, setResumen] = useState(null)
  const [facturas, setFacturas] = useState([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [cargando, setCargando] = useState(true)

  const cargar = async (f) => {
    setCargando(true)
    try {
      const [res, facts] = await Promise.all([
        facturasApi.resumenDia(f),
        facturasApi.listar({ fecha_inicio: f, fecha_fin: f, estado: 'EMITIDA' }),
      ])
      setResumen(res)
      setFacturas(facts)
    } finally { setCargando(false) }
  }

  useEffect(() => { cargar(fecha) }, [fecha])

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart2 size={22} className="text-primary-500" />
          Reportes
        </h1>
        <input type="date" className="input-field w-auto py-2" value={fecha}
          onChange={e => setFecha(e.target.value)} />
      </div>

      {/* Tarjetas resumen */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Ventas del día', valor: formatCOP(resumen.total_ventas), icon: TrendingUp, color: 'text-primary-400' },
            { label: 'Facturas emitidas', valor: resumen.total_facturas, icon: FileText, color: 'text-blue-400' },
            { label: 'IVA generado', valor: formatCOP(resumen.total_iva), icon: DollarSign, color: 'text-yellow-400' },
          ].map(({ label, valor, icon: Icon, color }) => (
            <div key={label} className="card">
              <Icon size={20} className={`${color} mb-2`} />
              <p className="text-dark-500 text-xs">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{valor}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabla de facturas */}
      <div className="card p-0 overflow-x-auto">
        <div className="px-4 py-3 border-b border-dark-700">
          <h2 className="text-white font-semibold text-sm">Facturas del día</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-dark-700">
            <tr className="text-dark-500 text-left">
              <th className="px-4 py-3">N°</th>
              <th className="px-4 py-3">Hora</th>
              <th className="px-4 py-3">Forma pago</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={4} className="text-center py-6 text-dark-500">Cargando...</td></tr>
            ) : facturas.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-6 text-dark-500">No hay ventas este día</td></tr>
            ) : facturas.map(f => (
              <tr key={f.id} className="border-b border-dark-700 last:border-0">
                <td className="px-4 py-3 text-white font-mono font-medium">{f.numero}</td>
                <td className="px-4 py-3 text-dark-500">
                  {f.fecha ? new Date(f.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="px-4 py-3 text-dark-500">{f.forma_pago}</td>
                <td className="px-4 py-3 text-right text-primary-400 font-semibold">{formatCOP(f.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

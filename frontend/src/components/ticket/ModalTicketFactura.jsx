import { useState, useRef, useEffect } from 'react'
import {
  Printer, Share2, Mail, MessageSquare, X, Check,
  FileText, Copy, Smartphone, Monitor, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCOP } from '../../utils/pricing'

export default function ModalTicketFactura({ factura, onCerrar, formatoInicial = '80MM' }) {
  const [formato, setFormato] = useState(formatoInicial || factura?.empresa?.formato_impresion || '80MM')
  const [whatsappModal, setWhatsappModal] = useState(false)
  const [telefonoWhatsapp, setTelefonoWhatsapp] = useState(factura?.cliente?.telefono || '')
  const [copiado, setCopiado] = useState(false)

  const ticketRef = useRef(null)

  useEffect(() => {
    if (factura?.empresa?.formato_impresion) {
      setFormato(factura.empresa.formato_impresion)
    }
  }, [factura])

  if (!factura) return null

  const { empresa = {}, cliente = {}, cajero = {}, lineas = [] } = factura || {}

  // ─── Generación de Texto para WhatsApp / Portapapeles ───────────────────────
  const generarTextoResumen = () => {
    let t = `🧾 *COMPROBANTE DE PAGO*\n`
    t += `🏪 *${empresa?.nombre || 'SISTEMA POS'}*\n`
    if (empresa?.nit) t += `NIT: ${empresa.nit}\n`
    if (empresa?.direccion) t += `Dir: ${empresa.direccion} - ${empresa.ciudad || ''}\n`
    if (empresa?.telefono) t += `Tel: ${empresa.telefono}\n`
    t += `----------------------------------------\n`
    t += `📄 *Factura N°:* ${factura.numero}\n`
    t += `📅 *Fecha:* ${factura.fecha_formateada || new Date(factura.fecha).toLocaleString('es-CO')}\n`
    t += `👤 *Cliente:* ${cliente?.nombre || 'Consumidor Final'} (${cliente?.nit || ''})\n`
    if (cajero?.nombre) t += `👨‍💼 *Atendido por:* ${cajero.nombre}\n`
    t += `----------------------------------------\n`
    t += `*PRODUCTOS:*\n`

    ;(lineas || []).forEach(l => {
      const pres = l.presentacion && l.presentacion !== 'DIRECTO' ? ` (${l.presentacion})` : ''
      t += `• ${l.cantidad}x ${l.nombre}${pres} → *${formatCOP(l.total_linea)}*\n`
    })

    t += `----------------------------------------\n`
    t += `*Subtotal:* ${formatCOP(factura.subtotal)}\n`
    if (factura.descuento_valor > 0) t += `*Descuento:* -${formatCOP(factura.descuento_valor)}\n`
    if (factura.iva_valor > 0) t += `*IVA:* ${formatCOP(factura.iva_valor)}\n`
    if (factura.domicilio_valor > 0) t += `*Domicilio:* ${formatCOP(factura.domicilio_valor)}\n`
    t += `💰 *TOTAL PAGADO:* ${formatCOP(factura.total)}\n`
    t += `💳 *Medio de Pago:* ${factura.forma_pago}\n`
    if (factura.valor_recibido > 0) t += `Recibido: ${formatCOP(factura.valor_recibido)} | Cambio: ${formatCOP(factura.cambio)}\n`
    t += `----------------------------------------\n`
    if (empresa?.mensaje_factura) t += `_${empresa.mensaje_factura}_\n`
    if (empresa?.resolucion_dian) t += `_${empresa.resolucion_dian}_\n`
    return t
  }

  const handleCopiarTexto = () => {
    navigator.clipboard.writeText(generarTextoResumen())
    setCopiado(true)
    toast.success('Texto del comprobante copiado al portapapeles')
    setTimeout(() => setCopiado(false), 3000)
  }

  const handleEnviarWhatsapp = (e) => {
    e?.preventDefault()
    const telLimpio = (telefonoWhatsapp || cliente?.telefono || '').replace(/\D/g, '')
    if (!telLimpio || telLimpio.length < 7) {
      toast.error('Ingresa un número de teléfono celular válido')
      return
    }
    const telInternacional = telLimpio.length === 10 ? `57${telLimpio}` : telLimpio
    const texto = encodeURIComponent(generarTextoResumen())
    window.open(`https://wa.me/${telInternacional}?text=${texto}`, '_blank')
    setWhatsappModal(false)
  }

  const handleEnviarEmail = () => {
    const correo = cliente?.email || ''
    const asunto = encodeURIComponent(`Comprobante de Pago ${factura.numero} - ${empresa?.nombre || ''}`)
    const cuerpo = encodeURIComponent(generarTextoResumen().replace(/[*_]/g, ''))
    window.open(`mailto:${correo}?subject=${asunto}&body=${cuerpo}`, '_self')
  }

  const handleImprimir = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[90] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      
      {/* ── CSS Exclusivo para Impresión Limpia sin marcos ─────────────────── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #ticket-print-container, #ticket-print-container * {
            visibility: visible !important;
          }
          #ticket-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${formato === '58MM' ? '54mm' : formato === '80MM' ? '76mm' : '100%'} !important;
            margin: 0 !important;
            padding: ${formato === 'CARTA' ? '15mm' : '2mm'} !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: ${formato === '58MM' ? '58mm auto' : formato === '80MM' ? '80mm auto' : 'letter portrait'};
            margin: ${formato === 'CARTA' ? '10mm' : '0mm'};
          }
        }
      `}</style>

      <div className="bg-dark-900 border border-dark-750 rounded-2xl max-w-4xl w-full flex flex-col max-h-[92vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* ── Header del Modal ────────────────────────────────────────── */}
        <div className="px-4 sm:px-5 py-3.5 bg-dark-800 border-b border-dark-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-950 border border-green-700/60 text-green-400 flex items-center justify-center flex-shrink-0">
              <Check size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-sm sm:text-base">Venta Registrada Exitosamente</h3>
                <span className="bg-green-500/20 text-green-400 border border-green-500/40 text-xs font-mono font-bold px-2 py-0.5 rounded-full">
                  {factura.numero}
                </span>
              </div>
              <p className="text-dark-400 text-xs">Total: <strong className="text-green-400 font-mono text-sm">{formatCOP(factura.total)}</strong> · Forma: {factura.forma_pago}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de Formato de Medida */}
            <div className="flex items-center bg-dark-900 p-1 rounded-xl border border-dark-700 text-xs">
              <button
                type="button"
                onClick={() => setFormato('80MM')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  formato === '80MM'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setFormato('58MM')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  formato === '58MM'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setFormato('CARTA')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  formato === 'CARTA'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                Carta
              </button>
            </div>

            {/* Botón Cerrar Superior */}
            <button
              type="button"
              onClick={onCerrar}
              className="w-8 h-8 rounded-full bg-dark-700 text-dark-300 hover:text-white flex items-center justify-center"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Cuerpo: Previsualización ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-dark-950 flex justify-center items-start">
          
          <div
            id="ticket-print-container"
            ref={ticketRef}
            className={`bg-white text-black transition-all shadow-2xl rounded-sm ${
              formato === '58MM'
                ? 'w-[260px] p-3 text-[11px] font-mono leading-tight'
                : formato === '80MM'
                ? 'w-[330px] p-4 text-xs font-mono leading-snug'
                : 'w-full max-w-2xl p-8 text-xs font-sans leading-normal rounded-xl'
            }`}
          >
            {/* ═══════════ FORMATO CARTA / OFICINA ═══════════ */}
            {formato === 'CARTA' ? (
              <div className="space-y-5 text-gray-800">
                {/* Cabecera Carta */}
                <div className="flex justify-between items-start border-b border-gray-300 pb-4">
                  <div>
                    <h1 className="text-xl font-black text-gray-900 tracking-tight">{empresa?.nombre || 'SISTEMA POS'}</h1>
                    <p className="text-xs text-gray-600 font-semibold">{empresa?.regimen || 'RÉGIMEN SIMPLIFICADO'}</p>
                    <p className="text-xs text-gray-600">NIT: {empresa?.nit || 'N/A'}</p>
                    <p className="text-xs text-gray-600">{empresa?.direccion} - {empresa?.ciudad}</p>
                    <p className="text-xs text-gray-600">Tel: {empresa?.telefono} · {empresa?.email}</p>
                  </div>
                  <div className="text-right">
                    <div className="bg-gray-100 border border-gray-300 p-2.5 rounded-lg inline-block text-right">
                      <span className="text-[10px] text-gray-500 uppercase font-bold block">Factura de Venta</span>
                      <span className="text-lg font-black text-primary-700 font-mono block">{factura.numero}</span>
                      <span className="text-[11px] text-gray-600 font-mono block">
                        {factura.fecha_formateada || new Date(factura.fecha).toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Datos Cliente Carta */}
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Datos del Cliente:</span>
                    <p className="font-bold text-gray-900 text-sm">{cliente?.nombre || 'CONSUMIDOR FINAL'}</p>
                    <p className="text-gray-600">C.C. / NIT: <strong className="text-gray-800">{cliente?.nit || '222222222222'}</strong></p>
                    {cliente?.telefono && <p className="text-gray-600">Tel: {cliente.telefono}</p>}
                    {cliente?.direccion && <p className="text-gray-600">Dir: {cliente.direccion} ({cliente.ciudad || ''})</p>}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Detalles de Venta:</span>
                    <p className="text-gray-700">Forma de Pago: <strong className="text-gray-900">{factura.forma_pago}</strong></p>
                    <p className="text-gray-700">Cajero / Vendedor: <strong className="text-gray-900">{cajero?.nombre || 'Principal'}</strong></p>
                    {factura.observaciones && <p className="text-gray-500 italic mt-1">{factura.observaciones}</p>}
                  </div>
                </div>

                {/* Tabla de Productos Carta */}
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-800 text-white font-bold text-left">
                      <th className="p-2 rounded-l">Código</th>
                      <th className="p-2">Descripción</th>
                      <th className="p-2 text-center">Pres.</th>
                      <th className="p-2 text-center">Cant.</th>
                      <th className="p-2 text-right">V. Unitario</th>
                      {factura.descuento_valor > 0 && <th className="p-2 text-right">Desc.</th>}
                      <th className="p-2 text-right rounded-r">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lineas.map((l, idx) => (
                      <tr key={l.id || idx} className="hover:bg-gray-50">
                        <td className="p-2 font-mono text-[11px] text-gray-600">{l.codigo || l.codigo_barras || 'S/C'}</td>
                        <td className="p-2 font-medium text-gray-900">
                          {l.nombre}
                          {l.principio_activo && <span className="text-[10px] text-gray-500 block">🧪 {l.principio_activo}</span>}
                        </td>
                        <td className="p-2 text-center font-semibold text-[11px] text-gray-700">{l.presentacion}</td>
                        <td className="p-2 text-center font-bold font-mono">{l.cantidad}</td>
                        <td className="p-2 text-right font-mono">{formatCOP(l.precio_unitario)}</td>
                        {factura.descuento_valor > 0 && (
                          <td className="p-2 text-right font-mono text-red-600">
                            {l.descuento_valor > 0 ? `-${formatCOP(l.descuento_valor)}` : '-'}
                          </td>
                        )}
                        <td className="p-2 text-right font-bold font-mono text-gray-900">{formatCOP(l.total_linea)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totales Carta */}
                <div className="flex justify-end pt-3 border-t-2 border-gray-800">
                  <div className="w-64 space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal:</span>
                      <span className="font-mono font-medium">{formatCOP(factura.subtotal)}</span>
                    </div>
                    {factura.descuento_valor > 0 && (
                      <div className="flex justify-between text-red-600 font-medium">
                        <span>Descuento:</span>
                        <span className="font-mono">-{formatCOP(factura.descuento_valor)}</span>
                      </div>
                    )}
                    {factura.iva_valor > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>IVA discriminado:</span>
                        <span className="font-mono font-medium">{formatCOP(factura.iva_valor)}</span>
                      </div>
                    )}
                    {factura.domicilio_valor > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Servicio Domicilio:</span>
                        <span className="font-mono font-medium">{formatCOP(factura.domicilio_valor)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-300">
                      <span>TOTAL A PAGAR:</span>
                      <span className="font-mono text-primary-700">{formatCOP(factura.total)}</span>
                    </div>
                    {factura.valor_recibido > 0 && (
                      <div className="flex justify-between text-[11px] text-gray-600 pt-1">
                        <span>Recibido: {formatCOP(factura.valor_recibido)}</span>
                        <span>Cambio: <strong className="text-gray-900">{formatCOP(factura.cambio)}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pie Carta */}
                <div className="text-center pt-6 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                  <p className="font-bold text-gray-700">{empresa?.mensaje_factura || '¡Gracias por su compra!'}</p>
                  {empresa?.resolucion_dian && (
                    <p className="text-[10px] text-gray-400 font-mono">{empresa.resolucion_dian}</p>
                  )}
                  <p className="text-[10px] text-gray-400">Software SistemaVentas POS</p>
                </div>
              </div>
            ) : (
              /* ═══════════ FORMATO TIRILLA TÉRMICA (80MM / 58MM) ═══════════ */
              <div className="space-y-2 text-center">
                {/* Cabecera Térmica */}
                <div className="border-b border-dashed border-gray-400 pb-2 space-y-0.5">
                  <h2 className="font-black text-sm uppercase tracking-tight">{empresa?.nombre || 'SISTEMA POS'}</h2>
                  <p className="text-[10px] uppercase font-bold">{empresa?.regimen || 'RÉGIMEN SIMPLIFICADO'}</p>
                  {empresa?.nit && <p className="text-[10px]">NIT: {empresa.nit}</p>}
                  {empresa?.direccion && <p className="text-[10px]">{empresa.direccion} - {empresa.ciudad}</p>}
                  {empresa?.telefono && <p className="text-[10px]">Tel: {empresa.telefono}</p>}
                </div>

                {/* Datos Factura */}
                <div className="text-left text-[10px] border-b border-dashed border-gray-400 pb-1.5 space-y-0.5">
                  <div className="flex justify-between font-bold">
                    <span>FACTURA:</span>
                    <span className="font-mono text-xs">{factura.numero}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>FECHA:</span>
                    <span>{factura.fecha_formateada || new Date(factura.fecha).toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CLIENTE:</span>
                    <span className="truncate max-w-[170px] font-semibold">{cliente?.nombre || 'CONSUMIDOR FINAL'}</span>
                  </div>
                  {cliente?.nit && (
                    <div className="flex justify-between">
                      <span>DOC / NIT:</span>
                      <span>{cliente.nit}</span>
                    </div>
                  )}
                  {cajero?.nombre && (
                    <div className="flex justify-between">
                      <span>CAJERO:</span>
                      <span>{cajero.nombre}</span>
                    </div>
                  )}
                </div>

                {/* Tabla de Productos Térmica */}
                <div className="text-left py-1">
                  <div className="flex justify-between font-bold border-b border-gray-300 pb-0.5 text-[9px]">
                    <span className="w-8">CANT</span>
                    <span className="flex-1 px-1">DESCRIPCIÓN</span>
                    <span className="text-right">TOTAL</span>
                  </div>
                  <div className="divide-y divide-gray-100 pt-1 space-y-1">
                    {lineas.map((l, idx) => (
                      <div key={l.id || idx} className="text-[10px] pt-1 leading-tight">
                        <div className="flex justify-between items-start font-medium">
                          <span className="w-6 font-bold font-mono">{l.cantidad}</span>
                          <span className="flex-1 px-1 font-semibold break-words">
                            {l.nombre}
                            {l.presentacion && l.presentacion !== 'DIRECTO' && (
                              <span className="text-[9px] text-gray-600 block">[{l.presentacion}]</span>
                            )}
                          </span>
                          <span className="font-mono font-bold text-right ml-1">{formatCOP(l.total_linea)}</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-500 pl-6">
                          <span>x {formatCOP(l.precio_unitario)}</span>
                          {l.descuento_valor > 0 && <span className="text-red-600">Desc: -{formatCOP(l.descuento_valor)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resumen Totales Térmico */}
                <div className="border-t border-dashed border-gray-400 pt-1.5 text-left text-[10px] space-y-0.5 font-mono">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCOP(factura.subtotal)}</span>
                  </div>
                  {factura.descuento_valor > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Descuento:</span>
                      <span>-{formatCOP(factura.descuento_valor)}</span>
                    </div>
                  )}
                  {factura.iva_valor > 0 && (
                    <div className="flex justify-between">
                      <span>IVA:</span>
                      <span>{formatCOP(factura.iva_valor)}</span>
                    </div>
                  )}
                  {factura.domicilio_valor > 0 && (
                    <div className="flex justify-between">
                      <span>Domicilio:</span>
                      <span>{formatCOP(factura.domicilio_valor)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-800">
                    <span>TOTAL:</span>
                    <span>{formatCOP(factura.total)}</span>
                  </div>
                  <div className="flex justify-between pt-0.5 text-[9px] text-gray-600">
                    <span>FORMA PAGO:</span>
                    <span className="font-bold text-gray-900">{factura.forma_pago}</span>
                  </div>
                  {factura.valor_recibido > 0 && (
                    <>
                      <div className="flex justify-between text-[9px]">
                        <span>RECIBIDO:</span>
                        <span>{formatCOP(factura.valor_recibido)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold">
                        <span>CAMBIO:</span>
                        <span>{formatCOP(factura.cambio)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Pie Térmico */}
                <div className="border-t border-dashed border-gray-400 pt-2 text-center text-[9px] space-y-1 text-gray-600">
                  <p className="font-bold text-gray-800">{empresa?.mensaje_factura || '¡GRACIAS POR SU COMPRA!'}</p>
                  {empresa?.resolucion_dian && (
                    <p className="text-[8px] leading-tight font-mono text-gray-500">{empresa.resolucion_dian}</p>
                  )}
                  <p className="text-[8px] text-gray-400">*** Software SistemaVentas POS ***</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer con Botones de Acción ────────────────────────────── */}
        <div className="px-5 py-3.5 bg-dark-800 border-t border-dark-700 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Imprimir */}
            <button
              type="button"
              onClick={handleImprimir}
              className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
              title="Lanza la impresión a tu impresora térmica o predeterminada"
            >
              <Printer size={16} />
              <span>🖨️ Imprimir Ticket</span>
            </button>

            {/* Enviar WhatsApp */}
            <button
              type="button"
              onClick={() => setWhatsappModal(true)}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
              title="Enviar comprobante detallado por WhatsApp al cliente"
            >
              <MessageSquare size={15} />
              <span>📱 WhatsApp</span>
            </button>

            {/* Enviar Correo */}
            <button
              type="button"
              onClick={handleEnviarEmail}
              className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
              title="Abrir correo con el comprobante adjunto"
            >
              <Mail size={15} />
              <span>✉️ Correo</span>
            </button>

            {/* Copiar Texto */}
            <button
              type="button"
              onClick={handleCopiarTexto}
              className="py-2 px-3 rounded-xl bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Copiar texto del comprobante para pegar en chat o notas"
            >
              {copiado ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              <span>{copiado ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            className="btn-secondary py-2 px-6 text-xs font-bold bg-dark-700 hover:bg-primary-600 hover:text-white border-dark-600 transition-colors"
          >
            ➕ Siguiente Venta (Listo)
          </button>
        </div>

        {/* ── Submodal WhatsApp Rápido ─────────────────────────────────── */}
        {whatsappModal && (
          <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
            <div className="bg-dark-800 border border-dark-600 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-dark-700 pb-2">
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  <MessageSquare size={16} className="text-emerald-400" />
                  Enviar Factura por WhatsApp
                </h4>
                <button
                  type="button"
                  onClick={() => setWhatsappModal(false)}
                  className="text-dark-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleEnviarWhatsapp} className="space-y-3 text-xs">
                <div>
                  <label className="block text-dark-300 mb-1 font-semibold">Número de Celular del Cliente:</label>
                  <input
                    type="tel"
                    required
                    autoFocus
                    className="input-field py-2 font-mono text-sm w-full"
                    placeholder="Ej: 310 1234567"
                    value={telefonoWhatsapp}
                    onChange={e => setTelefonoWhatsapp(e.target.value)}
                  />
                  <span className="text-[10px] text-dark-400 mt-1 block">Se abrirá WhatsApp Web o App con la factura formateada.</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setWhatsappModal(false)}
                    className="btn-secondary flex-1 py-2 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 border-emerald-500"
                  >
                    Enviar Mensaje
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

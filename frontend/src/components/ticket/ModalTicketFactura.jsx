import { useState, useRef, useEffect } from 'react'
import {
  Printer, Mail, MessageSquare, X, Check,
  FileText, Copy, Download, Image as ImageIcon, Send,
  Zap, QrCode, ShieldCheck, ExternalLink, RefreshCw,
  Truck, MapPin, Navigation
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCOP } from '../../utils/pricing'
import { formatearFechaHora } from '../../utils/fechas'
import { clientesApi, facturasApi } from '../../api/services'
import {
  copiarTicketComoImagen,
  generarTicketPDFFile,
  descargarTicketComoPDF
} from '../../utils/ticketExporter'

export default function ModalTicketFactura({ factura, onCerrar, formatoInicial = '80MM' }) {
  const [facturaActual, setFacturaActual] = useState(factura)
  const [formato, setFormato] = useState(formatoInicial || factura?.empresa?.formato_impresion || '80MM')
  
  // Modales secundarios
  const [whatsappModal, setWhatsappModal] = useState(false)
  const [telefonoWhatsapp, setTelefonoWhatsapp] = useState(factura?.cliente?.telefono || '')

  const [repartidorModal, setRepartidorModal] = useState(false)
  const [telefonoRepartidor, setTelefonoRepartidor] = useState('')
  
  const [emailModal, setEmailModal] = useState(false)
  const [emailDestino, setEmailDestino] = useState(factura?.cliente?.email || '')
  const [guardandoEmail, setGuardandoEmail] = useState(false)

  // Estados de carga
  const [copiandoImagen, setCopiandoImagen] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false)
  const [emitiendoDian, setEmitiendoDian] = useState(false)

  const ticketRef = useRef(null)

  useEffect(() => {
    setFacturaActual(factura)
    if (factura?.empresa?.formato_impresion) {
      setFormato(factura.empresa.formato_impresion)
    }
  }, [factura])

  if (!facturaActual) return null

  const handleEmitirDian = async () => {
    setEmitiendoDian(true)
    try {
      const res = await facturasApi.emitirDian(facturaActual.id)
      if (res.resultado?.exito) {
        toast.success(res.resultado.mensaje || '✓ Factura validada por la DIAN exitosamente')
        if (res.factura) {
          setFacturaActual(res.factura)
        }
      } else {
        toast.error(res.resultado?.mensaje || 'La DIAN no aceptó el documento')
      }
    } catch (err) {
      toast.error('Error de comunicación con el servicio DIAN')
    } finally {
      setEmitiendoDian(false)
    }
  }

  const { empresa = {}, cliente = {}, cajero = {}, lineas = [] } = facturaActual || {}

  // ─── Generación de Texto para WhatsApp / Correo ─────────────────────────────
  const generarTextoResumen = () => {
    let t = `🧾 *FACTURA DE VENTA - ${factura.numero}*\n`
    t += `🏪 *${empresa?.nombre || 'FACTUR-AAP'}*\n`
    if (empresa?.nit) t += `NIT: ${empresa.nit}\n`
    if (empresa?.direccion) t += `Dir: ${empresa.direccion} - ${empresa.ciudad || ''}\n`
    if (empresa?.telefono) t += `Tel: ${empresa.telefono}\n`
    t += `----------------------------------------\n`
    t += `📅 *Fecha:* ${factura.fecha_formateada || formatearFechaHora(factura.fecha, empresa?.zona_horaria || 'America/Bogota')}\n`
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

  // ─── Generación de Guía de Despacho Domicilio con Google Maps ──────────────
  const generarTextoDespachoDomicilio = () => {
    const dirEntrega = facturaActual?.domicilio_direccion || cliente?.direccion || 'Dirección de mostrador'
    const telCliente = facturaActual?.domicilio_telefono || cliente?.telefono || 'Sin teléfono'
    const notasEntrega = facturaActual?.domicilio_notas || ''
    const ciudad = empresa?.ciudad || 'Colombia'
    const mapsQuery = encodeURIComponent(`${dirEntrega}, ${ciudad}, Colombia`)

    let t = `🛵 *GUÍA DE DESPACHO A DOMICILIO*\n`
    t += `🏪 *Establecimiento:* ${empresa?.nombre || 'FACTUR-AAP'}\n`
    t += `📄 *Factura:* ${facturaActual.numero}\n`
    t += `----------------------------------------\n`
    t += `👤 *Cliente:* ${cliente?.nombre || 'Consumidor Final'}\n`
    t += `📞 *Teléfono Cliente:* ${telCliente}\n`
    t += `📍 *Dirección de Entrega:* ${dirEntrega}\n`
    if (notasEntrega) t += `📝 *Indicaciones:* ${notasEntrega}\n`
    t += `🗺️ *Navegar en Google Maps:* https://www.google.com/maps/search/?api=1&query=${mapsQuery}\n`
    t += `----------------------------------------\n`
    t += `*PRODUCTOS A ENTREGAR:*\n`
    ;(lineas || []).forEach(l => {
      const pres = l.presentacion && l.presentacion !== 'DIRECTO' ? ` (${l.presentacion})` : ''
      t += `• ${l.cantidad}x ${l.nombre}${pres}\n`
    })
    t += `----------------------------------------\n`
    t += `💰 *TOTAL A COBRAR:* ${formatCOP(facturaActual.total)}\n`
    t += `💳 *Forma de Pago:* ${facturaActual.forma_pago}\n`
    if (facturaActual.forma_pago === 'EFECTIVO' && facturaActual.valor_recibido > facturaActual.total) {
      t += `💵 *Cliente paga con:* ${formatCOP(facturaActual.valor_recibido)} (Llevar cambio de ${formatCOP(facturaActual.cambio)})\n`
    }
    t += `----------------------------------------\n`
    t += `¡Conduce con precaución! 🛵💨`
    return t
  }

  const handleEnviarRepartidorWhatsapp = (e) => {
    e?.preventDefault()
    const telLimpio = (telefonoRepartidor || '').replace(/\D/g, '')
    const texto = encodeURIComponent(generarTextoDespachoDomicilio())
    if (telLimpio && telLimpio.length >= 7) {
      const telInternacional = telLimpio.length === 10 ? `57${telLimpio}` : telLimpio
      window.open(`https://wa.me/${telInternacional}?text=${texto}`, '_blank')
    } else {
      window.open(`https://wa.me/?text=${texto}`, '_blank')
    }
    toast.success('🛵 Guía de despacho enviada a WhatsApp con enlace GPS')
    setRepartidorModal(false)
  }

  // ─── 1. IMPRIMIR TICKET (Acción Principal Predeterminada) ───────────────────
  const handleImprimir = () => {
    window.print()
  }

  // ─── 2. WHATSAPP (Genera Factura PDF automáticamente para adjuntar) ────────
  const handleAbrirModalWhatsapp = () => {
    setTelefonoWhatsapp(cliente?.telefono || '')
    setWhatsappModal(true)
  }

  const handleEnviarWhatsapp = async (e) => {
    e?.preventDefault()
    const telLimpio = (telefonoWhatsapp || '').replace(/\D/g, '')
    if (!telLimpio || telLimpio.length < 7) {
      toast.error('Ingresa un número de celular válido para enviar la factura')
      return
    }

    setEnviandoWhatsapp(true)
    try {
      // Generar archivo PDF oficial
      const { file, filename } = await generarTicketPDFFile(ticketRef.current, factura.numero, formato)

      // Si el navegador soporta compartir archivos directamente (móviles/tablets/apps)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Factura ${factura.numero}`,
          text: `Factura de compra N° ${factura.numero} - ${empresa?.nombre || 'FACTUR-AAP'}`,
        })
        toast.success('📄 Factura PDF enviada a WhatsApp')
        setWhatsappModal(false)
        return
      }

      // En PC / WhatsApp Web: auto-descargar el PDF y abrir el chat
      await descargarTicketComoPDF(ticketRef.current, factura.numero, formato)
      const telInternacional = telLimpio.length === 10 ? `57${telLimpio}` : telLimpio
      const texto = encodeURIComponent(generarTextoResumen())

      // Auto-copiar también la imagen PNG por si el usuario prefiere pegar directo
      try {
        await copiarTicketComoImagen(ticketRef.current, factura.numero)
      } catch (ignore) {}

      toast.success('📄 Factura PDF generada y lista para adjuntar en WhatsApp (Imagen copiada al portapapeles)', { duration: 6000 })
      window.open(`https://wa.me/${telInternacional}?text=${texto}`, '_blank')
      setWhatsappModal(false)
    } catch (err) {
      toast.error('Error al preparar Factura PDF: ' + err.message)
    } finally {
      setEnviandoWhatsapp(false)
    }
  }

  // ─── 3. CORREO ELECTRÓNICO (Con solicitud de email y auto-actualización) ──
  const handleAbrirModalEmail = () => {
    const emailExistente = cliente?.email || ''
    setEmailDestino(emailExistente)
    setEmailModal(true)
  }

  const handleEnviarEmailConfirmado = async (e) => {
    e?.preventDefault()
    const emailLimpio = (emailDestino || '').trim().toLowerCase()
    if (!emailLimpio || !emailLimpio.includes('@') || !emailLimpio.includes('.')) {
      toast.error('Por favor ingresa un correo electrónico válido')
      return
    }

    setGuardandoEmail(true)
    try {
      // Si es un cliente registrado en la base de datos (id > 1) y no tenía este correo, actualizarlo
      if (cliente?.id && cliente.id > 1 && cliente.email !== emailLimpio) {
        try {
          await clientesApi.actualizar(cliente.id, { email: emailLimpio })
          toast.success(`Datos actualizados: correo ${emailLimpio} guardado para el cliente`)
        } catch (ignore) {}
      }

      // Generar y descargar Factura PDF para adjuntar
      await descargarTicketComoPDF(ticketRef.current, factura.numero, formato)

      const asunto = encodeURIComponent(`Factura de Venta ${factura.numero} - ${empresa?.nombre || 'FACTUR-AAP'}`)
      const cuerpo = encodeURIComponent(
        `Estimado(a) ${cliente?.nombre || 'Cliente'},\n\n` +
        `Adjunto encontrará el comprobante oficial en formato PDF de su compra N° ${factura.numero}.\n\n` +
        `Resumen de la Factura:\n` +
        `• Total Pagado: ${formatCOP(factura.total)}\n` +
        `• Medio de Pago: ${factura.forma_pago}\n` +
        `• Fecha: ${factura.fecha_formateada || new Date(factura.fecha).toLocaleString('es-CO')}\n\n` +
        `¡Gracias por su compra!\n${empresa?.nombre || 'FACTUR-AAP'}`
      )

      window.open(`mailto:${emailLimpio}?subject=${asunto}&body=${cuerpo}`, '_self')
      toast.success(`📄 Factura ${factura.numero}.pdf lista para adjuntar en tu correo`)
      setEmailModal(false)
    } catch (err) {
      toast.error('Error al procesar envío por correo: ' + err.message)
    } finally {
      setGuardandoEmail(false)
    }
  }

  // ─── 4. COPIAR (.PNG Imagen al Portapapeles) ────────────────────────────────
  const handleCopiarImagen = async () => {
    setCopiandoImagen(true)
    try {
      const res = await copiarTicketComoImagen(ticketRef.current, factura.numero)
      if (res.metodo === 'PORTAPAPELES') {
        toast.success('📋 ¡Imagen (.PNG) copiada al portapapeles! Pégala con Ctrl + V en WhatsApp o notas.', { duration: 5000 })
      } else {
        toast.success('📋 Imagen (.PNG) descargada exitosamente.')
      }
    } catch (err) {
      toast.error('Error al capturar imagen: ' + err.message)
    } finally {
      setCopiandoImagen(false)
    }
  }

  // ─── 5. DESCARGAR PDF (Última opción secundaria) ───────────────────────────
  const handleDescargarPDF = async () => {
    setGenerandoPdf(true)
    try {
      await descargarTicketComoPDF(ticketRef.current, factura.numero, formato)
      toast.success(`📄 Factura ${factura.numero}.pdf descargada exitosamente`)
    } catch (err) {
      toast.error('Error al generar PDF: ' + err.message)
    } finally {
      setGenerandoPdf(false)
    }
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
        <div className="flex-1 overflow-y-auto overflow-x-auto touch-scroll-x p-2 sm:p-6 bg-dark-950 flex justify-center items-start w-full">
          
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
                        {factura.fecha_formateada || formatearFechaHora(factura.fecha, empresa?.zona_horaria || 'America/Bogota')}
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
                    {(facturaActual?.domicilio_direccion || facturaActual?.domicilio_valor > 0) && (
                      <div className="mt-2 p-2 bg-emerald-50 border border-emerald-300 rounded text-emerald-950">
                        <p className="font-bold flex items-center gap-1 text-[11px]">🛵 Entrega a Domicilio:</p>
                        {facturaActual.domicilio_direccion && <p><strong>Dirección:</strong> {facturaActual.domicilio_direccion}</p>}
                        {facturaActual.domicilio_telefono && <p><strong>Tel. Contacto:</strong> {facturaActual.domicilio_telefono}</p>}
                        {facturaActual.domicilio_notas && <p><strong>Indicaciones:</strong> {facturaActual.domicilio_notas}</p>}
                        {facturaActual.domicilio_distancia_km && <p><strong>Distancia aprox:</strong> {facturaActual.domicilio_distancia_km} km</p>}
                      </div>
                    )}
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
                      <span className="font-mono text-primary-700">{formatCOP(facturaActual.total)}</span>
                    </div>
                    {facturaActual.valor_recibido > 0 && (
                      <div className="flex justify-between text-[11px] text-gray-600 pt-1">
                        <span>Recibido: {formatCOP(facturaActual.valor_recibido)}</span>
                        <span>Cambio: <strong className="text-gray-900">{formatCOP(facturaActual.cambio)}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sección Oficial DIAN / CUFE Carta */}
                {(facturaActual.cufe || facturaActual.qr_cadena || facturaActual.qr_imagen_base64) && (
                  <div className="my-3 p-3 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-between gap-4">
                    <div className="space-y-1 text-left flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        <span>DOCUMENTO ELECTRÓNICO VALIDADO POR LA DIAN</span>
                      </div>
                      <p className="text-[10px] text-gray-600 font-mono break-all leading-tight">
                        <strong>CUFE:</strong> {facturaActual.cufe}
                      </p>
                      {facturaActual.dian_numero_oficial && (
                        <p className="text-[10px] text-gray-600">
                          <strong>N° Oficial DIAN:</strong> {facturaActual.dian_numero_oficial}
                        </p>
                      )}
                      <p className="text-[9px] text-gray-500">
                        Consulte la validez de este documento escaneando el código QR oficial.
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-center">
                      {facturaActual.qr_imagen_base64 ? (
                        <img src={facturaActual.qr_imagen_base64} alt="QR DIAN" className="w-20 h-20 border border-gray-300 rounded p-0.5 bg-white mx-auto" />
                      ) : facturaActual.qr_cadena ? (
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(facturaActual.qr_cadena)}`}
                          alt="QR DIAN"
                          className="w-20 h-20 border border-gray-300 rounded p-0.5 bg-white mx-auto"
                        />
                      ) : null}
                      <span className="text-[8px] text-gray-500 font-bold block mt-0.5">QR OFICIAL DIAN</span>
                    </div>
                  </div>
                )}

                {/* Pie Carta */}
                <div className="text-center pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                  <p className="font-bold text-gray-700">{empresa?.mensaje_factura || '¡Gracias por su compra!'}</p>
                  {empresa?.resolucion_dian && (
                    <p className="text-[10px] text-gray-400 font-mono">{empresa.resolucion_dian}</p>
                  )}
                  <p className="text-[10px] text-gray-400">Software FACTUR-AAP POS</p>
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
                    <span>{factura.fecha_formateada || formatearFechaHora(factura.fecha, empresa?.zona_horaria || 'America/Bogota')}</span>
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
                  {(facturaActual?.domicilio_direccion || facturaActual?.domicilio_valor > 0) && (
                    <div className="bg-gray-100 p-1.5 rounded my-1 text-[9px] border border-gray-300 space-y-0.5">
                      <p className="font-bold flex items-center gap-1 text-black">🛵 DOMICILIO / ENTREGA:</p>
                      {facturaActual.domicilio_direccion && <p className="font-semibold text-black">📍 {facturaActual.domicilio_direccion}</p>}
                      {facturaActual.domicilio_telefono && <p>📞 Tel: {facturaActual.domicilio_telefono}</p>}
                      {facturaActual.domicilio_notas && <p className="italic text-gray-700">📝 {facturaActual.domicilio_notas}</p>}
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
                  {facturaActual.valor_recibido > 0 && (
                    <>
                      <div className="flex justify-between text-[9px]">
                        <span>RECIBIDO:</span>
                        <span>{formatCOP(facturaActual.valor_recibido)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold">
                        <span>CAMBIO:</span>
                        <span>{formatCOP(facturaActual.cambio)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Sección Oficial DIAN / CUFE Térmica */}
                {(facturaActual.cufe || facturaActual.qr_cadena || facturaActual.qr_imagen_base64) && (
                  <div className="border-t border-dashed border-gray-400 pt-2 space-y-1.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-gray-900">
                      <span>⚡</span>
                      <span>DOCUMENTO ELECTRÓNICO DIAN</span>
                    </div>
                    {facturaActual.qr_imagen_base64 ? (
                      <img src={facturaActual.qr_imagen_base64} alt="QR DIAN" className="w-24 h-24 mx-auto border border-gray-300 rounded p-0.5 bg-white" />
                    ) : facturaActual.qr_cadena ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(facturaActual.qr_cadena)}`}
                        alt="QR DIAN"
                        className="w-24 h-24 mx-auto border border-gray-300 rounded p-0.5 bg-white"
                      />
                    ) : null}
                    {facturaActual.cufe && (
                      <p className="text-[8px] font-mono text-gray-600 break-all leading-none px-1">
                        CUFE: {facturaActual.cufe}
                      </p>
                    )}
                  </div>
                )}

                {/* Pie Térmico */}
                <div className="border-t border-dashed border-gray-400 pt-2 text-center text-[9px] space-y-1 text-gray-600">
                  <p className="font-bold text-gray-800">{empresa?.mensaje_factura || '¡GRACIAS POR SU COMPRA!'}</p>
                  {empresa?.resolucion_dian && (
                    <p className="text-[8px] leading-tight font-mono text-gray-500">{empresa.resolucion_dian}</p>
                  )}
                  <p className="text-[8px] text-gray-400">*** FACTUR-AAP POS ***</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer con las Acciones Priorizadas por Relevancia ──────────────── */}
        <div className="px-5 py-3.5 bg-dark-800 border-t border-dark-700 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. IMPRIMIR - Botón Principal Predeterminado */}
            <button
              type="button"
              onClick={handleImprimir}
              className="btn-primary py-2.5 px-4 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-primary-950/60 hover:scale-105 transition-all"
              title="1. Imprimir comprobante físico inmediatamente"
            >
              <Printer size={16} />
              <span>🖨️ Imprimir</span>
            </button>

            {/* 2. WHATSAPP - Factura PDF como adjunto */}
            <button
              type="button"
              onClick={handleAbrirModalWhatsapp}
              disabled={enviandoWhatsapp}
              className="py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all disabled:opacity-50"
              title="2. Enviar comprobante PDF por WhatsApp al cliente"
            >
              <MessageSquare size={15} />
              <span>{enviandoWhatsapp ? 'Generando PDF...' : '📱 WhatsApp'}</span>
            </button>

            {/* 2.1 DESPACHO DOMICILIO - Enviar Guía a Repartidor con Google Maps */}
            {(facturaActual?.domicilio_direccion || facturaActual?.domicilio_valor > 0) && (
              <button
                type="button"
                onClick={() => setRepartidorModal(true)}
                className="py-2.5 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-950/40 transition-all"
                title="Enviar guía de despacho a WhatsApp del repartidor con enlace de Google Maps"
              >
                <Truck size={15} />
                <span>🛵 Repartidor</span>
              </button>
            )}

            {/* 3. CORREO - Factura PDF al correo del cliente */}
            <button
              type="button"
              onClick={handleAbrirModalEmail}
              disabled={guardandoEmail}
              className="py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-950/40 transition-all disabled:opacity-50"
              title="3. Enviar comprobante PDF al correo electrónico"
            >
              <Mail size={15} />
              <span>✉️ Correo</span>
            </button>

            {/* 4. COPIAR - Copia imagen .PNG al portapapeles */}
            <button
              type="button"
              onClick={handleCopiarImagen}
              disabled={copiandoImagen}
              className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-950/40 transition-all disabled:opacity-50"
              title="4. Copia la imagen .PNG al portapapeles para pegar con Ctrl + V"
            >
              <Copy size={15} />
              <span>{copiandoImagen ? 'Copiando...' : '📋 Copiar (.PNG)'}</span>
            </button>

            {/* 5. DESCARGAR PDF - Última opción / discreto */}
            <button
              type="button"
              onClick={handleDescargarPDF}
              disabled={generandoPdf}
              className="py-2 px-3 rounded-xl bg-dark-700 hover:bg-dark-600 border border-dark-600 text-dark-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="5. Descargar archivo PDF local en el equipo"
            >
              <Download size={14} />
              <span>{generandoPdf ? 'Descargando...' : '📄 Descargar PDF'}</span>
            </button>

            {/* 6. EMISIÓN DIAN / FACTUS */}
            {facturaActual.dian_estado === 'VALIDADA' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-600/50 text-emerald-300 text-xs font-bold">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>DIAN Validada</span>
                {facturaActual.dian_pdf_url && (
                  <a
                    href={facturaActual.dian_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 text-primary-400 hover:underline flex items-center gap-0.5 text-[11px]"
                  >
                    <span>PDF Factus</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleEmitirDian}
                disabled={emitiendoDian}
                className="py-2 px-3 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-600/60 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                title="Emitir esta factura a la DIAN mediante Factus API"
              >
                {emitiendoDian ? <RefreshCw size={13} className="animate-spin text-amber-400" /> : <Zap size={13} className="text-amber-400" />}
                <span>{emitiendoDian ? 'Emitiendo a DIAN...' : '⚡ Emitir DIAN'}</span>
              </button>
            )}
          </div>

          {/* Siguiente Venta */}
          <button
            type="button"
            onClick={onCerrar}
            className="btn-secondary py-2.5 px-5 text-xs font-bold bg-dark-700 hover:bg-primary-600 hover:text-white border-dark-600 transition-colors"
          >
            ➕ Siguiente Venta
          </button>
        </div>

        {/* ── Submodal: Enviar por WhatsApp con PDF ────────────────────────── */}
        {whatsappModal && (
          <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
            <div className="bg-dark-800 border border-dark-600 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-dark-700 pb-2.5">
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  <MessageSquare size={17} className="text-emerald-400" />
                  Enviar Factura PDF por WhatsApp
                </h4>
                <button
                  type="button"
                  onClick={() => setWhatsappModal(false)}
                  className="text-dark-400 hover:text-white p-1"
                >
                  <X size={17} />
                </button>
              </div>

              <form onSubmit={handleEnviarWhatsapp} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-dark-300 mb-1 font-semibold uppercase tracking-wide">
                    Número de Celular / WhatsApp del Cliente:
                  </label>
                  <input
                    type="tel"
                    required
                    autoFocus
                    className="input-field py-2.5 font-mono text-sm w-full"
                    placeholder="Ej: 3101234567"
                    value={telefonoWhatsapp}
                    onChange={e => setTelefonoWhatsapp(e.target.value)}
                  />
                  <p className="text-[11px] text-dark-400 mt-1.5 leading-relaxed">
                    Al confirmar, el sistema genera la <strong>Factura oficial en formato PDF</strong> para enviarla adjunta al chat de WhatsApp del cliente.
                  </p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-dark-700">
                  <button
                    type="button"
                    onClick={() => setWhatsappModal(false)}
                    className="btn-secondary flex-1 py-2.5 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviandoWhatsapp}
                    className="btn-primary flex-1 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Send size={14} />
                    <span>{enviandoWhatsapp ? 'Generando PDF...' : 'Enviar por WhatsApp'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Submodal: Enviar por Correo con PDF y Actualización de Cliente ─ */}
        {emailModal && (
          <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
            <div className="bg-dark-800 border border-dark-600 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-dark-700 pb-2.5">
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  <Mail size={17} className="text-blue-400" />
                  Enviar Factura PDF por Correo
                </h4>
                <button
                  type="button"
                  onClick={() => setEmailModal(false)}
                  className="text-dark-400 hover:text-white p-1"
                >
                  <X size={17} />
                </button>
              </div>

              <form onSubmit={handleEnviarEmailConfirmado} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-dark-300 mb-1 font-semibold uppercase tracking-wide">
                    Correo Electrónico de Destino:
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    className="input-field py-2.5 font-medium text-sm w-full"
                    placeholder="cliente@ejemplo.com"
                    value={emailDestino}
                    onChange={e => setEmailDestino(e.target.value)}
                  />
                  <div className="mt-2 bg-dark-900/60 p-2.5 rounded-xl border border-dark-700 text-[11px] text-dark-400 space-y-1">
                    {cliente?.id && cliente.id > 1 ? (
                      <p className="text-blue-300">
                        💾 <strong>Cliente Registrado:</strong> El correo se guardará automáticamente en su ficha para futuras facturas.
                      </p>
                    ) : (
                      <p className="text-dark-300">
                        ⚡ <strong>Cliente Mostrador:</strong> Se enviará la factura a este correo sin necesidad de crear un registro de cliente.
                      </p>
                    )}
                    <p className="text-dark-400">
                      Se generará y adjuntará el archivo <strong>Factura_{factura.numero}.pdf</strong> listo en tu cliente de correo.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-dark-700">
                  <button
                    type="button"
                    onClick={() => setEmailModal(false)}
                    className="btn-secondary flex-1 py-2.5 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoEmail}
                    className="btn-primary flex-1 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 border-blue-500 shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Send size={14} />
                    <span>{guardandoEmail ? 'Procesando...' : 'Enviar Correo con PDF'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Submodal: Despacho a Repartidor por WhatsApp con Enlace GPS ─ */}
        {repartidorModal && (
          <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
            <div className="bg-dark-800 border border-dark-600 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-dark-700 pb-2.5">
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  <Truck size={17} className="text-teal-400" />
                  Guía de Despacho para Repartidor
                </h4>
                <button
                  type="button"
                  onClick={() => setRepartidorModal(false)}
                  className="text-dark-400 hover:text-white p-1"
                >
                  <X size={17} />
                </button>
              </div>

              <form onSubmit={handleEnviarRepartidorWhatsapp} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-dark-300 mb-1 font-semibold uppercase tracking-wide">
                    Número de WhatsApp del Repartidor (Opcional):
                  </label>
                  <input
                    type="tel"
                    autoFocus
                    className="input-field py-2.5 font-mono text-sm w-full"
                    placeholder="Ej: 3101234567 (o dejar vacío para elegir contacto)"
                    value={telefonoRepartidor}
                    onChange={e => setTelefonoRepartidor(e.target.value)}
                  />
                  <div className="mt-2.5 bg-dark-900/60 p-2.5 rounded-xl border border-dark-700 text-[11px] text-dark-300 space-y-1.5">
                    <p className="font-bold text-teal-300 flex items-center gap-1">
                      <span>📍 Destino:</span>
                      <span className="text-white font-normal">{facturaActual?.domicilio_direccion || cliente?.direccion || 'Mostrador'}</span>
                    </p>
                    {facturaActual?.domicilio_notas && (
                      <p className="text-dark-400 italic">📝 {facturaActual.domicilio_notas}</p>
                    )}
                    <p className="text-emerald-400 font-bold">
                      💰 Cobrar al cliente: {formatCOP(facturaActual?.total)} ({facturaActual?.forma_pago})
                    </p>
                    <p className="text-[10px] text-dark-400 pt-1 border-t border-dark-700">
                      Incluye automáticamente el <strong>enlace de navegación de Google Maps</strong> directo a la puerta del cliente.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-dark-700">
                  <button
                    type="button"
                    onClick={() => setRepartidorModal(false)}
                    className="btn-secondary flex-1 py-2.5 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1 py-2.5 text-xs font-bold bg-teal-600 hover:bg-teal-500 border-teal-500 shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Send size={14} />
                    <span>Enviar a Repartidor</span>
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

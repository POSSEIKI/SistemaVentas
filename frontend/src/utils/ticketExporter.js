/**
 * Utilidad Universal de Exportación de Facturas y Tiquetes POS
 * Soporta:
 * 1. Imprimir
 * 2. Enviar Factura PDF por WhatsApp (como documento adjunto / File)
 * 3. Enviar Factura PDF por Correo Electrónico
 * 4. Copiar Factura como Imagen (.PNG) al portapapeles
 * 5. Descargar Factura como PDF (.PDF)
 */

// Cargador asíncrono dinámico de librerías vía CDN de alta velocidad
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      if (window.html2canvas || window.jspdf) return resolve()
      existing.addEventListener('load', resolve)
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`No se pudo cargar la librería desde ${src}`))
    document.head.appendChild(script)
  })
}

async function getHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
  return window.html2canvas
}

async function getJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  return window.jspdf.jsPDF
}

/**
 * Genera el documento PDF como un objeto File / Blob utilizable para adjuntar
 */
export async function generarTicketPDFFile(elemento, numeroFactura = 'POS', formatoPapel = '80MM') {
  if (!elemento) throw new Error('No se encontró el elemento del comprobante.')

  const html2canvas = await getHtml2Canvas()
  const jsPDF = await getJsPDF()

  const canvas = await html2canvas(elemento, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const imgWidth = canvas.width
  const imgHeight = canvas.height

  let pdf
  if (formatoPapel === 'CARTA') {
    pdf = new jsPDF('p', 'mm', 'letter')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
  } else {
    const mmWidth = formatoPapel === '58MM' ? 58 : 80
    const mmHeight = Math.max(80, Math.round((imgHeight * mmWidth) / imgWidth))
    pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [mmWidth, mmHeight],
    })
    pdf.addImage(imgData, 'PNG', 0, 0, mmWidth, mmHeight)
  }

  const blob = pdf.output('blob')
  const filename = `Factura_${numeroFactura}.pdf`
  const file = new File([blob], filename, { type: 'application/pdf' })

  return { blob, file, filename, pdf }
}

/**
 * Copia el elemento del ticket como imagen PNG al portapapeles
 */
export async function copiarTicketComoImagen(elemento, numeroFactura = 'POS') {
  if (!elemento) throw new Error('No se encontró el elemento del comprobante para capturar.')

  const html2canvas = await getHtml2Canvas()
  const canvas = await html2canvas(elemento, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('No se pudo generar la imagen del comprobante.'))
        return
      }

      try {
        if (navigator.clipboard && window.ClipboardItem) {
          const item = new ClipboardItem({ 'image/png': blob })
          await navigator.clipboard.write([item])
          resolve({ exito: true, metodo: 'PORTAPAPELES' })
        } else {
          descargarBlob(blob, `Factura_${numeroFactura}.png`)
          resolve({ exito: true, metodo: 'DESCARGA' })
        }
      } catch (err) {
        descargarBlob(blob, `Factura_${numeroFactura}.png`)
        resolve({ exito: true, metodo: 'DESCARGA' })
      }
    }, 'image/png')
  })
}

/**
 * Descarga el elemento del ticket como archivo PDF
 */
export async function descargarTicketComoPDF(elemento, numeroFactura = 'POS', formatoPapel = '80MM') {
  const { pdf, filename } = await generarTicketPDFFile(elemento, numeroFactura, formatoPapel)
  pdf.save(filename)
  return true
}

function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

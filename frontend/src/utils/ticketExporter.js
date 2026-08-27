/**
 * Utilidad Universal de Exportación de Facturas y Tiquetes POS
 * Soporta:
 * 1. Copiar Factura como Imagen (.PNG) directamente al portapapeles (para pegar con Ctrl + V en WhatsApp)
 * 2. Descargar Factura como Imagen (.PNG / .JPG)
 * 3. Descargar Factura como PDF (.PDF) en medidas exactas (58mm, 80mm o Carta)
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
 * Copia el elemento del ticket como imagen PNG al portapapeles
 */
export async function copiarTicketComoImagen(elemento, numeroFactura = 'POS') {
  if (!elemento) throw new Error('No se encontró el elemento del comprobante para capturar.')

  const html2canvas = await getHtml2Canvas()
  const canvas = await html2canvas(elemento, {
    scale: 2.5, // Alta resolución para nitidez perfecta en WhatsApp
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
 * Descarga el elemento del ticket como imagen PNG o JPG
 */
export async function descargarTicketComoImagen(elemento, numeroFactura = 'POS', formato = 'png') {
  if (!elemento) throw new Error('No se encontró el elemento del comprobante.')

  const html2canvas = await getHtml2Canvas()
  const canvas = await html2canvas(elemento, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const mime = formato === 'jpg' || formato === 'jpeg' ? 'image/jpeg' : 'image/png'
  const ext = formato === 'jpg' || formato === 'jpeg' ? 'jpg' : 'png'

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        descargarBlob(blob, `Factura_${numeroFactura}.${ext}`)
        resolve(true)
      }
    }, mime, 0.95)
  })
}

/**
 * Descarga el elemento del ticket como archivo PDF con tamaño exacto
 */
export async function descargarTicketComoPDF(elemento, numeroFactura = 'POS', formatoPapel = '80MM') {
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

  if (formatoPapel === 'CARTA') {
    // Formato Carta Estándar (216mm x 279mm)
    const pdf = new jsPDF('p', 'mm', 'letter')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`Factura_${numeroFactura}.pdf`)
  } else {
    // Formato Térmico Rollo Continuo (58mm o 80mm con altura dinámica exacta)
    const mmWidth = formatoPapel === '58MM' ? 58 : 80
    const mmHeight = Math.max(80, Math.round((imgHeight * mmWidth) / imgWidth))

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [mmWidth, mmHeight],
    })

    pdf.addImage(imgData, 'PNG', 0, 0, mmWidth, mmHeight)
    pdf.save(`Factura_${numeroFactura}.pdf`)
  }

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

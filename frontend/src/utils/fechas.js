/**
 * Catálogo de Países y Zonas Horarias Predeterminadas
 */
export const PAISES_ZONAS_HORARIAS = [
  { id: 'CO', nombre: 'Colombia', flag: '🇨🇴', zona: 'America/Bogota', utc: 'UTC-5', moneda: 'COP', simbolo: '$' },
  { id: 'MX', nombre: 'México (Central / CDMX)', flag: '🇲🇽', zona: 'America/Mexico_City', utc: 'UTC-6', moneda: 'MXN', simbolo: '$' },
  { id: 'EC', nombre: 'Ecuador', flag: '🇪🇨', zona: 'America/Guayaquil', utc: 'UTC-5', moneda: 'USD', simbolo: '$' },
  { id: 'PE', nombre: 'Perú', flag: '🇵🇪', zona: 'America/Lima', utc: 'UTC-5', moneda: 'PEN', simbolo: 'S/' },
  { id: 'VE', nombre: 'Venezuela', flag: '🇻🇪', zona: 'America/Caracas', utc: 'UTC-4', moneda: 'VES', simbolo: 'Bs.' },
  { id: 'CL', nombre: 'Chile (Continental)', flag: '🇨🇱', zona: 'America/Santiago', utc: 'UTC-4', moneda: 'CLP', simbolo: '$' },
  { id: 'AR', nombre: 'Argentina', flag: '🇦🇷', zona: 'America/Argentina/Buenos_Aires', utc: 'UTC-3', moneda: 'ARS', simbolo: '$' },
  { id: 'BO', nombre: 'Bolivia', flag: '🇧🇴', zona: 'America/La_Paz', utc: 'UTC-4', moneda: 'BOB', simbolo: 'Bs' },
  { id: 'PY', nombre: 'Paraguay', flag: '🇵🇾', zona: 'America/Asuncion', utc: 'UTC-4', moneda: 'PYG', simbolo: '₲' },
  { id: 'UY', nombre: 'Uruguay', flag: '🇺🇾', zona: 'America/Montevideo', utc: 'UTC-3', moneda: 'UYU', simbolo: '$' },
  { id: 'PA', nombre: 'Panamá', flag: '🇵🇦', zona: 'America/Panama', utc: 'UTC-5', moneda: 'PAB', simbolo: '$' },
  { id: 'CR', nombre: 'Costa Rica', flag: '🇨🇷', zona: 'America/Costa_Rica', utc: 'UTC-6', moneda: 'CRC', simbolo: '₡' },
  { id: 'GT', nombre: 'Guatemala', flag: '🇬🇹', zona: 'America/Guatemala', utc: 'UTC-6', moneda: 'GTQ', simbolo: 'Q' },
  { id: 'HN', nombre: 'Honduras', flag: '🇭🇳', zona: 'America/Tegucigalpa', utc: 'UTC-6', moneda: 'HNL', simbolo: 'L' },
  { id: 'SV', nombre: 'El Salvador', flag: '🇸🇻', zona: 'America/El_Salvador', utc: 'UTC-6', moneda: 'USD', simbolo: '$' },
  { id: 'NI', nombre: 'Nicaragua', flag: '🇳🇮', zona: 'America/Managua', utc: 'UTC-6', moneda: 'NIO', simbolo: 'C$' },
  { id: 'DO', nombre: 'República Dominicana', flag: '🇩🇴', zona: 'America/Santo_Domingo', utc: 'UTC-4', moneda: 'DOP', simbolo: 'RD$' },
  { id: 'PR', nombre: 'Puerto Rico', flag: '🇵🇷', zona: 'America/Puerto_Rico', utc: 'UTC-4', moneda: 'USD', simbolo: '$' },
  { id: 'ES', nombre: 'España (Península / Madrid)', flag: '🇪🇸', zona: 'Europe/Madrid', utc: 'UTC+1', moneda: 'EUR', simbolo: '€' },
  { id: 'US_ET', nombre: 'Estados Unidos (Hora Este)', flag: '🇺🇸', zona: 'America/New_York', utc: 'UTC-5', moneda: 'USD', simbolo: '$' },
  { id: 'US_CT', nombre: 'Estados Unidos (Hora Central)', flag: '🇺🇸', zona: 'America/Chicago', utc: 'UTC-6', moneda: 'USD', simbolo: '$' },
  { id: 'US_PT', nombre: 'Estados Unidos (Hora Pacífico)', flag: '🇺🇸', zona: 'America/Los_Angeles', utc: 'UTC-8', moneda: 'USD', simbolo: '$' },
]

/**
 * Zonas horarias comunes seleccionables
 */
export const ZONAS_HORARIAS_POPULARES = [
  { id: 'America/Bogota', label: 'America/Bogota (UTC-5) - Colombia, Ecuador, Panamá, Perú' },
  { id: 'America/Mexico_City', label: 'America/Mexico_City (UTC-6) - México Central, Costa Rica, Guatemala, El Salvador' },
  { id: 'America/Cancun', label: 'America/Cancun (UTC-5) - México Quintana Roo' },
  { id: 'America/Tijuana', label: 'America/Tijuana (UTC-8) - México Pacífico' },
  { id: 'America/Lima', label: 'America/Lima (UTC-5) - Perú' },
  { id: 'America/Guayaquil', label: 'America/Guayaquil (UTC-5) - Ecuador' },
  { id: 'America/Caracas', label: 'America/Caracas (UTC-4) - Venezuela' },
  { id: 'America/Santiago', label: 'America/Santiago (UTC-4 / UTC-3) - Chile' },
  { id: 'America/Argentina/Buenos_Aires', label: 'America/Argentina/Buenos_Aires (UTC-3) - Argentina' },
  { id: 'America/La_Paz', label: 'America/La_Paz (UTC-4) - Bolivia' },
  { id: 'America/Asuncion', label: 'America/Asuncion (UTC-4 / UTC-3) - Paraguay' },
  { id: 'America/Montevideo', label: 'America/Montevideo (UTC-3) - Uruguay' },
  { id: 'America/Panama', label: 'America/Panama (UTC-5) - Panamá' },
  { id: 'America/Costa_Rica', label: 'America/Costa_Rica (UTC-6) - Costa Rica' },
  { id: 'America/Guatemala', label: 'America/Guatemala (UTC-6) - Guatemala' },
  { id: 'America/Tegucigalpa', label: 'America/Tegucigalpa (UTC-6) - Honduras' },
  { id: 'America/El_Salvador', label: 'America/El_Salvador (UTC-6) - El Salvador' },
  { id: 'America/Managua', label: 'America/Managua (UTC-6) - Nicaragua' },
  { id: 'America/Santo_Domingo', label: 'America/Santo_Domingo (UTC-4) - Rep. Dominicana' },
  { id: 'America/Puerto_Rico', label: 'America/Puerto_Rico (UTC-4) - Puerto Rico' },
  { id: 'Europe/Madrid', label: 'Europe/Madrid (UTC+1 / UTC+2) - España' },
  { id: 'America/New_York', label: 'America/New_York (UTC-5 / UTC-4) - EE.UU. Este / Florida' },
  { id: 'America/Chicago', label: 'America/Chicago (UTC-6 / UTC-5) - EE.UU. Central / Texas' },
  { id: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8 / UTC-7) - EE.UU. Pacífico / California' },
  { id: 'UTC', label: 'UTC (Tiempo Universal Coordinado)' },
]

export const obtenerZonaPorPais = (paisNombre) => {
  if (!paisNombre) return 'America/Bogota'
  const match = PAISES_ZONAS_HORARIAS.find(p => 
    p.nombre.toLowerCase().includes(paisNombre.toLowerCase()) || 
    paisNombre.toLowerCase().includes(p.nombre.toLowerCase()) ||
    p.id.toLowerCase() === paisNombre.toLowerCase()
  )
  return match ? match.zona : 'America/Bogota'
}

export const obtenerPaisPorZona = (zonaHoraria) => {
  if (!zonaHoraria) return 'Colombia'
  const match = PAISES_ZONAS_HORARIAS.find(p => p.zona === zonaHoraria)
  return match ? match.nombre : 'Colombia'
}

export const formatearFechaHora = (fecha, timeZone = 'America/Bogota', options = {}) => {
  if (!fecha) return ''
  try {
    let d
    if (typeof fecha === 'string') {
      let fechaStr = fecha
      if (!fechaStr.includes('Z') && !fechaStr.match(/[+-]\d{2}:\d{2}$/)) {
        fechaStr += 'Z'
      }
      d = new Date(fechaStr)
      if (isNaN(d.getTime())) {
        d = new Date(fecha)
      }
    } else {
      d = new Date(fecha)
    }

    if (isNaN(d.getTime())) return String(fecha)

    return new Intl.DateTimeFormat('es-CO', {
      timeZone: timeZone || 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      ...options,
    }).format(d)
  } catch (e) {
    return String(fecha)
  }
}

export const formatearFechaCorta = (fecha, timeZone = 'America/Bogota') => {
  return formatearFechaHora(fecha, timeZone, {
    hour: undefined,
    minute: undefined,
    second: undefined,
    hour12: undefined,
  })
}

export const obtenerHoraActualEnZona = (timeZone = 'America/Bogota') => {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: timeZone || 'America/Bogota',
      dateStyle: 'full',
      timeStyle: 'medium',
      hour12: true,
    }).format(new Date())
  } catch (e) {
    return new Date().toLocaleString()
  }
}

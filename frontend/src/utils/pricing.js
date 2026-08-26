/**
 * Utilidades de cálculo y redondeo de precios comerciales para el POS / ERP
 */

export const MODOS_REDONDEO = [
  {
    id: 'CENTENA_100',
    nombre: 'Redondeo a la Centena más cercana ($100)',
    descripcion: 'Ej: $24.022 → $24.000 | $24.089 → $24.100 (Recomendado para droguerías)',
    ejemplo: '$24.022 → $24.000',
  },
  {
    id: 'CINCUENTA_50',
    nombre: 'Redondeo a la Decena / Moneda de $50',
    descripcion: 'Ej: $24.022 → $24.000 | $24.035 → $24.050',
    ejemplo: '$24.035 → $24.050',
  },
  {
    id: 'ENTERO',
    nombre: 'Al Peso Entero más cercano (Sin decimales)',
    descripcion: 'Ej: $24.022,70 → $24.023 (Sin comas ni fracciones de centavos)',
    ejemplo: '$24.022,7 → $24.023',
  },
  {
    id: 'MIL_1000',
    nombre: 'Redondeo al Millar más cercano ($1.000)',
    descripcion: 'Ej: $24.400 → $24.000 | $24.600 → $25.000',
    ejemplo: '$24.400 → $24.000',
  },
  {
    id: 'DECIMALES_2',
    nombre: 'Exacto con 2 Decimales',
    descripcion: 'Ej: $24.022,70 (Para sistemas contables estrictos con centavos)',
    ejemplo: '$24.022,70',
  },
]

/**
 * Aplica el redondeo comercial configurado a un valor numérico
 */
export const redondearPrecio = (valor, modo = 'CENTENA_100') => {
  const num = parseFloat(valor) || 0
  if (num <= 0) return 0

  switch (modo) {
    case 'ENTERO':
      return Math.round(num)

    case 'CINCUENTA_50':
      return Math.round(num / 50) * 50

    case 'CENTENA_100':
      return Math.round(num / 100) * 100

    case 'MIL_1000':
      return Math.round(num / 1000) * 1000

    case 'DECIMALES_2':
      return parseFloat(num.toFixed(2))

    default:
      return Math.round(num / 100) * 100
  }
}

/**
 * Calcula el precio de venta a partir del costo y el porcentaje de margen, aplicando el redondeo
 */
export const calcularPrecioDesdeCosto = (costo, margenPct, modo = 'CENTENA_100') => {
  const c = parseFloat(costo) || 0
  const m = parseFloat(margenPct) || 0
  if (c <= 0) return 0
  const pSinRedondeo = c * (1 + m / 100)
  return redondearPrecio(pSinRedondeo, modo)
}

/**
 * Calcula el porcentaje de margen a partir del costo y el precio final
 */
export const calcularMargenDesdePrecio = (costo, precio) => {
  const c = parseFloat(costo) || 0
  const p = parseFloat(precio) || 0
  if (c <= 0) return 0
  return parseFloat((((p - c) / c) * 100).toFixed(2))
}

/**
 * Formatea un valor a Pesos Colombianos limpios ($ 24.000)
 */
export const formatCOP = (valor, forzarDecimales = false) => {
  const num = parseFloat(valor) || 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: forzarDecimales ? 2 : 0,
    maximumFractionDigits: forzarDecimales ? 2 : 0,
  }).format(num)
}
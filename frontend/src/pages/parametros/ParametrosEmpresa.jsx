import { useState, useEffect } from 'react'
import { configApi, productosApi } from '../../api/services'
import { Settings, Save, Building2, Percent, DollarSign, FileText, Truck, RefreshCw, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const RUBROS = [
  { id: 'FARMACIA',      nombre: 'Droguería / Farmacia',    desc: 'Habilita fraccionamiento (Cajas/Blisters) y búsqueda por principio activo.', icon: '💊' },
  { id: 'FERRETERIA',   nombre: 'Ferretería / Materiales', desc: 'Búsqueda por nombre comercial, referencias, marcas y bodega.', icon: '🔨' },
  { id: 'SUPERMERCADO', nombre: 'Supermercado / Víveres',  desc: 'Optimizado para códigos de barra, pesajes y venta rápida.', icon: '🛒' },
  { id: 'GENERAL',      nombre: 'Comercio General',        desc: 'Para tiendas de ropa, calzado, tecnología y servicios.', icon: '🏬' },
]

export default function ParametrosEmpresa() {
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [aplicandoRedondeo, setAplicandoRedondeo] = useState(false)

  useEffect(() => {
    configApi.get().then(data => {
      setConfig(data)
      setForm(data)
    }).catch(() => {})
  }, [])

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  const guardar = async (e) => {
    e?.preventDefault()
    setGuardando(true)
    try {
      await configApi.update(form)
      // Si cambió el modo de redondeo, aplicarlo globalmente al catálogo
      if (form.modo_redondeo && form.modo_redondeo !== config.modo_redondeo) {
        await productosApi.aplicarRedondeoGlobal()
        toast.success(`Parámetros guardados y regla de redondeo aplicada a todo el catálogo`)
      } else {
        toast.success('Parámetros de empresa guardados exitosamente')
      }
      setConfig({ ...form })
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al guardar parámetros')
    } finally {
      setGuardando(false)
    }
  }

  const handleAplicarRedondeoGlobal = async () => {
    setAplicandoRedondeo(true)
    try {
      await configApi.update(form)
      const res = await productosApi.aplicarRedondeoGlobal()
      setConfig({ ...form })
      toast.success(res.mensaje || 'Redondeo aplicado con éxito a todo el catálogo')
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error al aplicar redondeo')
    } finally {
      setAplicandoRedondeo(false)
    }
  }

  if (!config) {
    return (
      <div className="text-center py-12 space-y-2">
        <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-dark-500 text-xs">Cargando parámetros de configuración...</p>
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="space-y-5 max-w-3xl">
      {/* ── Encabezado ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-dark-700">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings size={20} className="text-primary-500" />
            Parámetros Generales y Datos de la Empresa
          </h2>
          <p className="text-dark-400 text-xs mt-0.5">
            Configuración fiscal, tipo de negocio, márgenes globales y tarifas de domicilio
          </p>
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="btn-primary flex items-center gap-2 py-2 px-5 font-bold text-xs shadow-lg self-start sm:self-auto"
        >
          {guardando ? <RefreshCw size={15} className="animate-spin" /> : <Save size={16} />}
          <span>{guardando ? 'Guardando...' : 'Guardar Cambios'}</span>
        </button>
      </div>

      {/* ── Selector de Rubro / Tipo de Negocio ─────────────────── */}
      <div className="card space-y-3">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <span>🏢</span> Rubro o Tipo de Negocio
          </h3>
          <p className="text-dark-400 text-xs">
            Optimiza el comportamiento del punto de venta, inventario y búsqueda
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RUBROS.map(r => {
            const activo = (form.rubro || 'FARMACIA') === r.id
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => set('rubro', r.id)}
                className={`p-3 rounded-xl text-left border transition-all ${
                  activo
                    ? 'bg-primary-950/40 border-primary-500 ring-1 ring-primary-500/30'
                    : 'bg-dark-700/50 border-dark-700 hover:border-dark-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{r.icon}</span>
                  <span className={`text-xs font-bold ${activo ? 'text-primary-400' : 'text-white'}`}>
                    {r.nombre}
                  </span>
                </div>
                <p className="text-dark-400 text-[11px] leading-relaxed">{r.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Datos Fiscales de la Empresa ────────────────────────── */}
      <div className="card space-y-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Building2 size={16} className="text-primary-400" />
          Información Fiscal y de Facturación
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Nombre Comercial de la Empresa</label>
            <input
              className="input-field py-1.5 text-xs font-semibold"
              value={form.nombre || ''}
              onChange={e => set('nombre', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">NIT / Documento Legal</label>
            <input
              className="input-field py-1.5 text-xs font-mono"
              value={form.nit || ''}
              onChange={e => set('nit', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Teléfono / Celular de Contacto</label>
            <input
              className="input-field py-1.5 text-xs font-mono"
              value={form.telefono || ''}
              onChange={e => set('telefono', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Correo Electrónico</label>
            <input
              type="email"
              className="input-field py-1.5 text-xs"
              value={form.email || ''}
              onChange={e => set('email', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Ciudad / Municipio</label>
            <input
              className="input-field py-1.5 text-xs"
              value={form.ciudad || ''}
              onChange={e => set('ciudad', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Dirección del Establecimiento</label>
            <input
              className="input-field py-1.5 text-xs"
              value={form.direccion || ''}
              onChange={e => set('direccion', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Precios y Márgenes de Ganancia ──────────────────────── */}
      <div className="card space-y-4">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Percent size={16} className="text-primary-400" />
          Precios, Márgenes y Reglas de Redondeo
        </h3>

        <div className="bg-dark-900/60 p-3.5 rounded-xl border border-dark-700 space-y-2">
          <label className="block text-xs font-semibold text-dark-300">
            Margen de ganancia sugerido por defecto (%)
          </label>
          <div className="relative max-w-xs">
            <input
              type="number"
              step="any"
              min="0"
              className="input-field py-1.5 pl-3 pr-8 text-xs font-mono font-bold text-primary-300"
              value={form.margen_ganancia_predeterminado ?? 30.0}
              onChange={e => set('margen_ganancia_predeterminado', parseFloat(e.target.value) || 0)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 font-bold text-xs">%</span>
          </div>
          <p className="text-dark-500 text-[11px]">
            Este porcentaje se aplicará automáticamente para proyectar el precio de venta cuando importes facturas de compras o crees nuevos artículos.
          </p>
        </div>

        {/* Selector de Modo de Redondeo */}
        <div className="space-y-2 pt-1">
          <div>
            <label className="block text-xs font-semibold text-dark-300">
              Regla de Redondeo y Aproximación de Precios de Venta
            </label>
            <p className="text-dark-500 text-[11px]">
              Evita precios con decimales o centavos difíciles de cobrar en caja (ej. $24.022,70) redondeando a valores limpios.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                id: 'CENTENA_100',
                nombre: 'Redondeo a la Centena más cercana ($100)',
                desc: 'Si da $24.022 → $24.000 | Si da $24.089 → $24.100 (Recomendado para droguerías)',
                ejemplo: '$24.022 → $24.000',
              },
              {
                id: 'CINCUENTA_50',
                nombre: 'Redondeo a la Decena / Moneda de $50',
                desc: 'Si da $24.022 → $24.000 | Si da $24.035 → $24.050',
                ejemplo: '$24.035 → $24.050',
              },
              {
                id: 'ENTERO',
                nombre: 'Al Peso Entero más cercano (Sin decimales)',
                desc: 'Si da $24.022,70 → $24.023 (Al peso exacto sin centavos)',
                ejemplo: '$24.022,7 → $24.023',
              },
              {
                id: 'MIL_1000',
                nombre: 'Redondeo al Millar más cercano ($1.000)',
                desc: 'Si da $24.400 → $24.000 | Si da $24.600 → $25.000',
                ejemplo: '$24.400 → $24.000',
              },
              {
                id: 'DECIMALES_2',
                nombre: 'Exacto con 2 Decimales',
                desc: 'Mantiene centavos exactos (ej. $24.022,70)',
                ejemplo: '$24.022,70',
              },
            ].map(m => {
              const activo = (form.modo_redondeo || 'CENTENA_100') === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => set('modo_redondeo', m.id)}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    activo
                      ? 'bg-primary-950/40 border-primary-500 ring-1 ring-primary-500/30'
                      : 'bg-dark-700/50 border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-xs font-bold ${activo ? 'text-primary-400' : 'text-white'}`}>
                      {m.nombre}
                    </span>
                    <span className="text-[10px] font-mono bg-dark-800 px-1.5 py-0.5 rounded text-primary-300 font-semibold">
                      {m.ejemplo}
                    </span>
                  </div>
                  <p className="text-dark-400 text-[11px] leading-relaxed">{m.desc}</p>
                </button>
              )
            })}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-dark-900/60 p-3 rounded-xl border border-primary-600/30">
            <div className="text-xs">
              <p className="text-white font-semibold flex items-center gap-1.5">
                <span>⚡</span> Aplicar esta regla a todo el inventario existente
              </p>
              <p className="text-dark-400 text-[11px] mt-0.5">
                Recalcula y aproxima automáticamente los precios de Caja, Blíster y Unidad de todos los productos ya guardados en tu catálogo.
              </p>
            </div>
            <button
              type="button"
              disabled={aplicandoRedondeo}
              onClick={handleAplicarRedondeoGlobal}
              className="btn-primary py-1.5 px-4 text-xs font-bold whitespace-nowrap flex items-center gap-1.5 shadow-md flex-shrink-0"
            >
              {aplicandoRedondeo ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>{aplicandoRedondeo ? 'Procesando...' : 'Aplicar a todo el catálogo'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Configuración de Facturación e Impresión ───────────── */}
      <div className="card space-y-4">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <FileText size={16} className="text-primary-400" />
          Configuración de Facturación e Impresión de Tickets POS
        </h3>

        {/* Selector de Formato de Impresión Predeterminado */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-dark-300">
            Formato de Impresión Predeterminado:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                id: '80MM',
                nombre: '🧾 Tirilla 80mm (Estándar POS)',
                desc: 'Para impresoras térmicas Epson, Bixolon, Xprinter 80mm de mostrador.',
                badge: 'Más común en POS',
              },
              {
                id: '58MM',
                nombre: '🧾 Tirilla 58mm (Compacta / Mini)',
                desc: 'Para impresoras térmicas compactas, mini portátiles o inalámbricas Bluetooth.',
                badge: 'Móvil / Mini',
              },
              {
                id: 'CARTA',
                nombre: '📄 Formato Carta / A4',
                desc: 'Diseño corporativo con tabla detallada para impresoras láser o de inyección.',
                badge: 'Oficina / Carta',
              },
            ].map(f => {
              const activo = (form.formato_impresion || '80MM') === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => set('formato_impresion', f.id)}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    activo
                      ? 'bg-primary-950/50 border-primary-500 ring-1 ring-primary-500/40 text-white'
                      : 'bg-dark-700/40 border-dark-700 text-dark-400 hover:border-dark-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-xs font-bold ${activo ? 'text-primary-300' : 'text-white'}`}>
                      {f.nombre}
                    </span>
                  </div>
                  <p className="text-[11px] text-dark-400 leading-snug">{f.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Prefijo Factura</label>
            <input
              className="input-field py-1.5 text-xs font-mono"
              value={form.factura_prefijo || 'FV'}
              onChange={e => set('factura_prefijo', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Símbolo Moneda</label>
            <input
              className="input-field py-1.5 text-xs font-mono text-center"
              value={form.moneda_simbolo || '$'}
              onChange={e => set('moneda_simbolo', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Mensaje al pie de factura</label>
            <input
              className="input-field py-1.5 text-xs"
              placeholder="Ej: ¡Gracias por su compra!"
              value={form.mensaje_factura || ''}
              onChange={e => set('mensaje_factura', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-dark-400 mb-1">
            Resolución / Autorización DIAN (Opcional):
          </label>
          <input
            className="input-field py-1.5 text-xs font-mono"
            placeholder="Ej: Autorización DIAN N° 18760000001 de 2024, Rango 1 al 10000, Vigencia 24 meses"
            value={form.resolucion_dian || ''}
            onChange={e => set('resolucion_dian', e.target.value)}
          />
        </div>
      </div>

      {/* ── Tarifas de Domicilios ───────────────────────────────── */}
      <div className="card space-y-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Truck size={16} className="text-primary-400" />
          Tarifas de Domicilio por Zonas ($)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Zona Corta ($)</label>
            <input
              type="number"
              className="input-field py-1.5 text-xs font-mono"
              value={form.domicilio_corta || 0}
              onChange={e => set('domicilio_corta', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Zona Media ($)</label>
            <input
              type="number"
              className="input-field py-1.5 text-xs font-mono"
              value={form.domicilio_media || 0}
              onChange={e => set('domicilio_media', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Zona Larga ($)</label>
            <input
              type="number"
              className="input-field py-1.5 text-xs font-mono"
              value={form.domicilio_larga || 0}
              onChange={e => set('domicilio_larga', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* Botón Guardar Inferior */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={guardando}
          className="btn-primary py-2.5 px-8 font-bold text-xs shadow-lg flex items-center gap-2"
        >
          {guardando ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          <span>{guardando ? 'Guardando...' : 'Guardar Todos los Cambios'}</span>
        </button>
      </div>
    </form>
  )
}

import math
import logging
from decimal import Decimal
from typing import Optional, Dict, Any
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.models.configuracion import ConfiguracionEmpresa

logger = logging.getLogger(__name__)

def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula la distancia en kilómetros entre dos coordenadas geográficas."""
    R = 6371.0  # Radio de la Tierra en km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

async def _geocodificar_direccion(direccion: str, ciudad: str, client: httpx.AsyncClient) -> Optional[tuple[float, float]]:
    """Geocodifica una dirección usando OpenStreetMap Nominatim con timeout seguro."""
    if not direccion or len(direccion.strip()) < 3:
        return None
    try:
        # Limpieza básica para Nominatim (Calle, Carrera, etc)
        dir_clean = direccion.replace("#", " No. ").strip()
        query = f"{dir_clean}, {ciudad}, Colombia"
        url = "https://nominatim.openstreetmap.org/search"
        headers = {"User-Agent": "FacturAap-POS/1.0 (contacto@facturaap.com)"}
        params = {"q": query, "format": "json", "limit": 1, "countrycodes": "co"}

        resp = await client.get(url, params=params, headers=headers, timeout=2.5)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                return (lat, lon)
    except Exception as e:
        logger.debug(f"Geocodificación no disponible para '{direccion}': {e}")
    return None

async def calcular_tarifa_domicilio(
    db: AsyncSession,
    empresa_id: int,
    direccion_destino: str,
    ciudad_destino: Optional[str] = None,
    direccion_origen: Optional[str] = None,
    subtotal_venta: Optional[Decimal] = Decimal("0"),
) -> Dict[str, Any]:
    """
    Calcula el costo del domicilio con base en la distancia entre el negocio y el cliente,
    utilizando las tarifas por zona parametrizadas en la empresa.
    """
    # 1. Cargar configuración de la empresa
    res_cfg = await db.execute(
        select(ConfiguracionEmpresa).where(
            or_(ConfiguracionEmpresa.empresa_id == empresa_id, ConfiguracionEmpresa.id == empresa_id)
        )
    )
    cfg = res_cfg.scalar_one_or_none()

    ciudad_empresa = (cfg.ciudad if cfg and cfg.ciudad else "Bogota").strip()
    ciudad_final = (ciudad_destino or ciudad_empresa).strip()
    dir_origen_final = (direccion_origen or (cfg.direccion if cfg and cfg.direccion else "")).strip()
    dir_destino_final = (direccion_destino or "").strip()

    tarifa_corta = float(getattr(cfg, "domicilio_corta", 3000) or 3000)
    tarifa_media = float(getattr(cfg, "domicilio_media", 5000) or 5000)
    tarifa_larga = float(getattr(cfg, "domicilio_larga", 8000) or 8000)
    tarifa_base = float(getattr(cfg, "domicilio_tarifa_base", 4000) or 4000)
    costo_km = float(getattr(cfg, "domicilio_costo_por_km", 1500) or 1500)
    gratis_desde = float(getattr(cfg, "domicilio_gratis_desde", 0) or 0)

    # Validar si aplica envío gratis por monto
    if gratis_desde > 0 and float(subtotal_venta or 0) >= gratis_desde:
        return {
            "exito": True,
            "tarifa_sugerida": Decimal("0"),
            "distancia_km": None,
            "zona_sugerida": "GRATIS",
            "direccion_origen": dir_origen_final or f"Establecimiento ({ciudad_empresa})",
            "direccion_destino": dir_destino_final,
            "tiempo_estimado_minutos": 25,
            "mensaje": f"¡Envío GRATIS! Compra superior a ${gratis_desde:,.0f}",
        }

    # 2. Intentar geocodificar origen y destino
    distancia_vial_km = None
    tiempo_minutos = 25
    zona = "MEDIA"
    tarifa_calculada = tarifa_media

    if dir_destino_final:
        try:
            async with httpx.AsyncClient() as client:
                coord_origen = None
                if dir_origen_final:
                    coord_origen = await _geocodificar_direccion(dir_origen_final, ciudad_empresa, client)
                
                coord_destino = await _geocodificar_direccion(dir_destino_final, ciudad_final, client)

                if coord_origen and coord_destino:
                    dist_lineal = _haversine_distance(coord_origen[0], coord_origen[1], coord_destino[0], coord_destino[1])
                    # Factor de corrección vial urbana (rutas reales en calles suelen ser ~35% más largas que la línea recta)
                    distancia_vial_km = round(dist_lineal * 1.35, 2)

                    if distancia_vial_km <= 3.0:
                        tarifa_calculada = tarifa_corta
                        zona = "CORTA"
                        tiempo_minutos = 20
                    elif distancia_vial_km <= 6.0:
                        tarifa_calculada = tarifa_media
                        zona = "MEDIA"
                        tiempo_minutos = 30
                    else:
                        # Zona larga: Tarifa larga base + excedente por km adicional
                        km_extra = max(0.0, distancia_vial_km - 6.0)
                        tarifa_calculada = tarifa_larga + (km_extra * costo_km)
                        zona = "LARGA"
                        tiempo_minutos = int(35 + km_extra * 4)

                    # Redondear a la centena más cercana (ej. $5.230 -> $5.200)
                    tarifa_calculada = float(round(tarifa_calculada / 100.0) * 100)

                    return {
                        "exito": True,
                        "tarifa_sugerida": Decimal(str(tarifa_calculada)),
                        "distancia_km": Decimal(str(distancia_vial_km)),
                        "zona_sugerida": zona,
                        "direccion_origen": dir_origen_final or f"Establecimiento ({ciudad_empresa})",
                        "direccion_destino": dir_destino_final,
                        "tiempo_estimado_minutos": tiempo_minutos,
                        "mensaje": f"Distancia calculada: {distancia_vial_km} km ({zona.title()}). Tarifa sugerida: ${tarifa_calculada:,.0f}",
                    }
        except Exception as err:
            logger.warning(f"Error calculando ruta de domicilio: {err}")

    # Fallback si no se pudieron geocodificar coordenadas exactas
    return {
        "exito": True,
        "tarifa_sugerida": Decimal(str(tarifa_base or tarifa_media)),
        "distancia_km": None,
        "zona_sugerida": "MEDIA",
        "direccion_origen": dir_origen_final or f"Establecimiento ({ciudad_empresa})",
        "direccion_destino": dir_destino_final or "Dirección mostrador",
        "tiempo_estimado_minutos": 25,
        "mensaje": f"Tarifa estándar sugerida: ${tarifa_base or tarifa_media:,.0f} COP (ajustable por el cajero)",
    }
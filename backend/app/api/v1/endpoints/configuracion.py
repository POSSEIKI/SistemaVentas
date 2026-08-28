from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.configuracion import ConfiguracionEmpresa

router = APIRouter(prefix="/configuracion", tags=["Configuración"])

@router.get("/empresa")
async def get_configuracion(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
    config = result.scalar_one_or_none()
    if not config:
        return {}
    return {
        "nombre": config.nombre, "nit": config.nit, "direccion": config.direccion,
        "telefono": config.telefono, "email": config.email, "ciudad": config.ciudad,
        "regimen": config.regimen, "logo_url": config.logo_url,
        "mensaje_factura": config.mensaje_factura, "moneda_simbolo": config.moneda_simbolo,
        "moneda_decimales": config.moneda_decimales, "factura_prefijo": config.factura_prefijo,
        "iva_porcentaje": float(config.iva_porcentaje), "iva_incluido": config.iva_incluido,
        "domicilio_corta": float(config.domicilio_corta),
        "domicilio_media": float(config.domicilio_media),
        "domicilio_larga": float(config.domicilio_larga),
        "rubro": config.rubro or "FARMACIA",
        "margen_ganancia_predeterminado": float(getattr(config, "margen_ganancia_predeterminado", 30.00) or 30.00),
        "modo_redondeo": getattr(config, "modo_redondeo", "CENTENA_100") or "CENTENA_100",
        "formato_impresion": getattr(config, "formato_impresion", "80MM") or "80MM",
        "resolucion_dian": getattr(config, "resolucion_dian", "") or "",
        "pais": getattr(config, "pais", "Colombia") or "Colombia",
        "zona_horaria": getattr(config, "zona_horaria", "America/Bogota") or "America/Bogota",
    }

@router.patch("/empresa")
async def actualizar_configuracion(
    datos: dict,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
    config = result.scalar_one_or_none()
    if not config:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    campos_permitidos = [
        "nombre", "nit", "direccion", "telefono", "email", "ciudad",
        "regimen", "logo_url", "mensaje_factura", "moneda_simbolo",
        "moneda_decimales", "factura_prefijo", "iva_porcentaje", "iva_incluido",
        "domicilio_corta", "domicilio_media", "domicilio_larga", "rubro",
        "margen_ganancia_predeterminado", "modo_redondeo",
        "formato_impresion", "resolucion_dian", "pais", "zona_horaria",
    ]
    for campo, valor in datos.items():
        if campo in campos_permitidos:
            setattr(config, campo, valor)
    await db.commit()
    return {"mensaje": "Configuración actualizada"}

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
        "domicilio_corta", "domicilio_media", "domicilio_larga",
    ]
    for campo, valor in datos.items():
        if campo in campos_permitidos:
            setattr(config, campo, valor)
    await db.commit()
    return {"mensaje": "Configuración actualizada"}

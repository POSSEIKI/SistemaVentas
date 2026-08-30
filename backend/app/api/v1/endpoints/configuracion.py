from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.db.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.configuracion import ConfiguracionEmpresa
from app.models.suscripcion import Empresa

router = APIRouter(prefix="/configuracion", tags=["Configuración"])

@router.get("/empresa")
async def get_configuracion(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    empresa_id = current_user.empresa_id or 1
    result = await db.execute(
        select(ConfiguracionEmpresa).where(
            or_(ConfiguracionEmpresa.empresa_id == empresa_id, ConfiguracionEmpresa.id == empresa_id)
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        # Si no existe, crearla con los datos de la empresa
        res_emp = await db.execute(select(Empresa).where(Empresa.id == empresa_id))
        emp = res_emp.scalar_one_or_none()
        config = ConfiguracionEmpresa(
            empresa_id=empresa_id,
            nombre=emp.nombre if emp else "Mi Empresa",
            nit=emp.nit if emp and emp.nit else "",
            rubro=emp.rubro if emp and emp.rubro else "COMERCIO_GENERAL",
            pais="Colombia",
            zona_horaria="America/Bogota"
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)

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
        "rubro": config.rubro or "COMERCIO_GENERAL",
        "margen_ganancia_predeterminado": float(getattr(config, "margen_ganancia_predeterminado", 30.00) or 30.00),
        "modo_redondeo": getattr(config, "modo_redondeo", "CENTENA_100") or "CENTENA_100",
        "formato_impresion": getattr(config, "formato_impresion", "80MM") or "80MM",
        "resolucion_dian": getattr(config, "resolucion_dian", "") or "",
        "pais": getattr(config, "pais", "Colombia") or "Colombia",
        "zona_horaria": getattr(config, "zona_horaria", "America/Bogota") or "America/Bogota",
        # Facturación Electrónica DIAN / Factus
        "fe_habilitada": bool(getattr(config, "fe_habilitada", False)),
        "fe_proveedor": getattr(config, "fe_proveedor", "FACTUS") or "FACTUS",
        "fe_ambiente": getattr(config, "fe_ambiente", "SANDBOX") or "SANDBOX",
        "fe_client_id": getattr(config, "fe_client_id", "") or "",
        "fe_client_secret": getattr(config, "fe_client_secret", "") or "",
        "fe_rango_id": getattr(config, "fe_rango_id", "") or "",
        "fe_tipo_documento": getattr(config, "fe_tipo_documento", "POS_ELECTRONICO") or "POS_ELECTRONICO",
        "fe_municipio_id": getattr(config, "fe_municipio_id", "980") or "980",
    }

@router.patch("/empresa")
async def actualizar_configuracion(
    datos: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    empresa_id = current_user.empresa_id or 1
    result = await db.execute(
        select(ConfiguracionEmpresa).where(
            or_(ConfiguracionEmpresa.empresa_id == empresa_id, ConfiguracionEmpresa.id == empresa_id)
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        config = ConfiguracionEmpresa(empresa_id=empresa_id)
        db.add(config)

    campos_permitidos = [
        "nombre", "nit", "direccion", "telefono", "email", "ciudad",
        "regimen", "logo_url", "mensaje_factura", "moneda_simbolo",
        "moneda_decimales", "factura_prefijo", "iva_porcentaje", "iva_incluido",
        "domicilio_corta", "domicilio_media", "domicilio_larga", "rubro",
        "margen_ganancia_predeterminado", "modo_redondeo",
        "formato_impresion", "resolucion_dian", "pais", "zona_horaria",
        "fe_habilitada", "fe_proveedor", "fe_ambiente", "fe_client_id",
        "fe_client_secret", "fe_rango_id", "fe_tipo_documento", "fe_municipio_id",
    ]
    for campo, valor in datos.items():
        if campo in campos_permitidos:
            setattr(config, campo, valor)
    config.empresa_id = empresa_id
    await db.commit()
    return {"mensaje": "Configuración actualizada"}

@router.post("/factus/probar-conexion")
async def probar_conexion_factus(
    datos: dict,
    _=Depends(require_admin),
):
    from app.services.factus_service import probar_conexion
    client_id = datos.get("client_id", "")
    client_secret = datos.get("client_secret", "")
    ambiente = datos.get("ambiente", "SANDBOX")
    return await probar_conexion(client_id, client_secret, ambiente)

@router.post("/factus/rangos-numeracion")
async def consultar_rangos_factus(
    datos: dict,
    _=Depends(require_admin),
):
    from app.services.factus_service import obtener_rangos_numeracion
    client_id = datos.get("client_id", "")
    client_secret = datos.get("client_secret", "")
    ambiente = datos.get("ambiente", "SANDBOX")
    return await obtener_rangos_numeracion(client_id, client_secret, ambiente)


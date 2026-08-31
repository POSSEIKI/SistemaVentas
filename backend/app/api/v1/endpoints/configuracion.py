from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.db.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.configuracion import ConfiguracionEmpresa
from app.models.suscripcion import Empresa

router = APIRouter(prefix="/configuracion", tags=["Configuración"])

def _safe_float(val, default=0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

async def _obtener_config_empresa(db: AsyncSession, empresa_id: int) -> ConfiguracionEmpresa:
    # 1. Buscar prioritariamente por empresa_id
    res = await db.execute(
        select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.empresa_id == empresa_id).order_by(ConfiguracionEmpresa.id.desc())
    )
    config = res.scalars().first()

    # 2. Si no se encuentra y empresa_id == 1, buscar por id == 1
    if not config and empresa_id == 1:
        res = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
        config = res.scalars().first()

    # 3. Si no existe, crearla con los datos de la empresa
    if not config:
        from sqlalchemy import func
        res_emp = await db.execute(select(Empresa).where(Empresa.id == empresa_id))
        emp = res_emp.scalars().first()
        res_max = await db.execute(select(func.coalesce(func.max(ConfiguracionEmpresa.id), 0)))
        next_id = (res_max.scalar() or 0) + 1

        config = ConfiguracionEmpresa(
            id=next_id,
            empresa_id=empresa_id,
            nombre=emp.nombre if emp and emp.nombre else "Mi Empresa",
            nit=emp.nit if emp and emp.nit else "",
            rubro=emp.rubro if emp and emp.rubro else "COMERCIO_GENERAL",
            telefono=emp.telefono if emp and emp.telefono else "",
            ciudad=emp.ciudad if emp and emp.ciudad else "",
            direccion=emp.direccion if emp and emp.direccion else "",
            email=emp.email if emp and emp.email else "",
            pais="Colombia",
            zona_horaria="America/Bogota"
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)

    return config

@router.get("/empresa")
async def get_configuracion(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    empresa_id = current_user.empresa_id or 1
    config = await _obtener_config_empresa(db, empresa_id)

    return {
        "nombre": config.nombre or "Mi Empresa",
        "nit": config.nit or "",
        "direccion": config.direccion or "",
        "telefono": config.telefono or "",
        "email": config.email or "",
        "ciudad": config.ciudad or "",
        "regimen": config.regimen or "RESPONSABLE_IVA",
        "logo_url": config.logo_url,
        "mensaje_factura": config.mensaje_factura or "¡Gracias por su compra!",
        "moneda_simbolo": config.moneda_simbolo or "$",
        "moneda_decimales": config.moneda_decimales if config.moneda_decimales is not None else 0,
        "factura_prefijo": config.factura_prefijo or "POS",
        "iva_porcentaje": _safe_float(config.iva_porcentaje, 0.0),
        "iva_incluido": bool(config.iva_incluido),
        "domicilio_corta": _safe_float(config.domicilio_corta, 3000.0),
        "domicilio_media": _safe_float(config.domicilio_media, 5000.0),
        "domicilio_larga": _safe_float(config.domicilio_larga, 8000.0),
        "domicilio_tarifa_base": _safe_float(getattr(config, "domicilio_tarifa_base", 4000), 4000.0),
        "domicilio_costo_por_km": _safe_float(getattr(config, "domicilio_costo_por_km", 1500), 1500.0),
        "domicilio_gratis_desde": _safe_float(getattr(config, "domicilio_gratis_desde", 0), 0.0),
        "rubro": config.rubro or "COMERCIO_GENERAL",
        "margen_ganancia_predeterminado": _safe_float(getattr(config, "margen_ganancia_predeterminado", 30.00), 30.00),
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
        "fe_test_set_id": getattr(config, "fe_test_set_id", "") or "",
    }

@router.patch("/empresa")
@router.put("/empresa")
@router.post("/empresa")
async def actualizar_configuracion(
    datos: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    try:
        empresa_id = current_user.empresa_id or 1
        config = await _obtener_config_empresa(db, empresa_id)

        # Sincronizar campos principales con la tabla Empresa si existe
        if current_user.empresa_id:
            res_emp = await db.execute(select(Empresa).where(Empresa.id == current_user.empresa_id))
            emp = res_emp.scalar_one_or_none()
            if emp:
                if "nombre" in datos and datos["nombre"]:
                    emp.nombre = str(datos["nombre"]).strip()
                if "nit" in datos and datos["nit"]:
                    emp.nit = str(datos["nit"]).strip()
                if "telefono" in datos:
                    emp.telefono = str(datos["telefono"]).strip()
                if "ciudad" in datos:
                    emp.ciudad = str(datos["ciudad"]).strip()
                if "direccion" in datos:
                    emp.direccion = str(datos["direccion"]).strip()
                if "email" in datos:
                    emp.email = str(datos["email"]).strip()
                if "rubro" in datos and datos["rubro"]:
                    emp.rubro = str(datos["rubro"]).strip().upper()

        str_fields = [
            "nombre", "nit", "direccion", "telefono", "email", "ciudad",
            "regimen", "logo_url", "mensaje_factura", "moneda_simbolo",
            "factura_prefijo", "rubro", "modo_redondeo", "formato_impresion",
            "resolucion_dian", "pais", "zona_horaria", "fe_proveedor",
            "fe_ambiente", "fe_client_id", "fe_client_secret", "fe_rango_id",
            "fe_tipo_documento", "fe_municipio_id", "fe_test_set_id"
        ]
        numeric_fields = [
            "iva_porcentaje", "domicilio_corta", "domicilio_media", "domicilio_larga",
            "domicilio_tarifa_base", "domicilio_costo_por_km", "domicilio_gratis_desde",
            "margen_ganancia_predeterminado"
        ]
        bool_fields = ["iva_incluido", "fe_habilitada"]
        int_fields = ["moneda_decimales"]

        # Mapear alias comunes
        if "fe_numbering_range_id" in datos and not datos.get("fe_rango_id"):
            datos["fe_rango_id"] = str(datos["fe_numbering_range_id"] or "")
        if "fe_tipo_documento_defecto" in datos and not datos.get("fe_tipo_documento"):
            datos["fe_tipo_documento"] = str(datos["fe_tipo_documento_defecto"] or "POS_ELECTRONICO")

        for campo, valor in datos.items():
            if campo in str_fields:
                setattr(config, campo, str(valor or "").strip() if valor is not None else "")
            elif campo in numeric_fields:
                setattr(config, campo, _safe_float(valor, 0.0))
            elif campo in bool_fields:
                setattr(config, campo, bool(valor))
            elif campo in int_fields:
                try:
                    setattr(config, campo, int(valor) if valor is not None else 0)
                except (ValueError, TypeError):
                    setattr(config, campo, 0)

        config.empresa_id = empresa_id
        await db.commit()
        return {"mensaje": "Configuración actualizada correctamente"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar configuración: {str(e)}")

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

@router.post("/fe/ejecutar-set-pruebas")
async def ejecutar_set_pruebas_endpoint(
    datos: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    test_set_id = (datos.get("test_set_id") or "").strip()
    if not test_set_id:
        raise HTTPException(status_code=400, detail="El código TestSetID de la DIAN es obligatorio")

    from app.services.factus_service import ejecutar_set_de_pruebas_dian
    return await ejecutar_set_de_pruebas_dian(
        test_set_id=test_set_id,
        client_id=datos.get("client_id"),
        client_secret=datos.get("client_secret"),
        ambiente=datos.get("ambiente", "SANDBOX"),
        db=db,
        empresa_id=empresa_id
    )

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.cliente import Cliente
from app.models.factura import Factura, FacturaDetalle
from app.models.configuracion import ConfiguracionEmpresa
from app.schemas.ventas import (
    ClienteCreate, ClienteUpdate, ClienteOut,
    FacturaCreate, FacturaOut, AnularFacturaRequest,
    DevolucionFacturaRequest, BonoClienteOut
)
from app.services import venta_service
from typing import List, Optional
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

router = APIRouter(tags=["Ventas"])

async def _obtener_zona_horaria(db: AsyncSession, empresa_id: int = 1) -> ZoneInfo:
    res = await db.execute(select(ConfiguracionEmpresa.zona_horaria).where(ConfiguracionEmpresa.empresa_id == empresa_id))
    zh = res.scalar() or "America/Bogota"
    try:
        return ZoneInfo(zh)
    except Exception:
        return ZoneInfo("America/Bogota")


# ─── Clientes ─────────────────────────────────────────────────────────────────

@router.get("/clientes", response_model=List[ClienteOut])
async def listar_clientes(
    q: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1

    # Asegurar que siempre exista el Cliente Mostrador predeterminado por ley en Colombia para este negocio
    res_cm = await db.execute(
        select(Cliente).where(Cliente.empresa_id == empresa_id, Cliente.nit == "222222222222")
    )
    cm = res_cm.scalar_one_or_none()
    if not cm:
        cm = Cliente(
            empresa_id=empresa_id,
            nombre="CLIENTE MOSTRADOR (CONSUMIDOR FINAL)",
            nit="222222222222",
            tipo_doc="CC",
            direccion="Mostrador",
            telefono="0000000",
            email="",
            activo=True
        )
        db.add(cm)
        await db.commit()

    query = select(Cliente).where(Cliente.empresa_id == empresa_id, Cliente.activo == True)
    if q:
        query = query.where(or_(
            Cliente.nombre.ilike(f"%{q}%"),
            Cliente.nit.ilike(f"%{q}%"),
            Cliente.telefono.ilike(f"%{q}%"),
            Cliente.ciudad.ilike(f"%{q}%"),
            Cliente.direccion.ilike(f"%{q}%"),
        ))
    result = await db.execute(query.order_by(Cliente.id.asc()))
    return result.scalars().all()

@router.get("/clientes/{cliente_id}", response_model=ClienteOut)
async def get_cliente(cliente_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    empresa_id = current_user.empresa_id or 1
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id, Cliente.empresa_id == empresa_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente

@router.get("/clientes/buscar-nit/{nit}", response_model=ClienteOut)
async def buscar_cliente_nit(nit: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    empresa_id = current_user.empresa_id or 1
    result = await db.execute(select(Cliente).where(Cliente.nit == nit, Cliente.empresa_id == empresa_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente

@router.post("/clientes", response_model=ClienteOut)
async def crear_cliente(datos: ClienteCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    empresa_id = current_user.empresa_id or 1
    if datos.nit and datos.nit.strip():
        res_existente = await db.execute(
            select(Cliente).where(Cliente.empresa_id == empresa_id, Cliente.nit == datos.nit.strip())
        )
        existente = res_existente.scalar_one_or_none()
        if existente:
            raise HTTPException(status_code=400, detail=f"Ya existe un cliente registrado en tu negocio con el documento {datos.nit}")

    c_dict = datos.model_dump()
    c_dict["empresa_id"] = empresa_id
    cliente = Cliente(**c_dict)
    db.add(cliente)
    await db.commit()
    await db.refresh(cliente)
    return cliente

@router.patch("/clientes/{cliente_id}", response_model=ClienteOut)
async def actualizar_cliente(
    cliente_id: int,
    datos: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id, Cliente.empresa_id == empresa_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Si se intenta cambiar el NIT, validar duplicados dentro de la empresa
    if datos.nit and datos.nit.strip() != cliente.nit:
        res_dup = await db.execute(
            select(Cliente).where(
                Cliente.empresa_id == empresa_id,
                Cliente.nit == datos.nit.strip(),
                Cliente.id != cliente_id
            )
        )
        if res_dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Ya existe otro cliente con el documento {datos.nit}")

    datos_dict = datos.model_dump(exclude_unset=True)
    for campo, valor in datos_dict.items():
        setattr(cliente, campo, valor)

    await db.commit()
    await db.refresh(cliente)
    return cliente

@router.delete("/clientes/{cliente_id}")
async def eliminar_cliente(cliente_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    empresa_id = current_user.empresa_id or 1
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id, Cliente.empresa_id == empresa_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if cliente.nit == "222222222222" or "MOSTRADOR" in (cliente.nombre or "").upper():
        raise HTTPException(
            status_code=400,
            detail="El 'CLIENTE MOSTRADOR (CONSUMIDOR FINAL - 222222222222)' es obligatorio por ley en Colombia para la emisión de facturas y no puede ser eliminado."
        )

    cliente.activo = False
    await db.commit()
    return {"mensaje": "Cliente desactivado correctamente"}

@router.post("/clientes/crear-o-encontrar", response_model=ClienteOut)
async def crear_o_encontrar(datos: ClienteCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    empresa_id = current_user.empresa_id or 1
    if datos.nit:
        result = await db.execute(select(Cliente).where(Cliente.empresa_id == empresa_id, Cliente.nit == datos.nit))
        existente = result.scalar_one_or_none()
        if existente:
            return existente
    c_dict = datos.model_dump()
    c_dict["empresa_id"] = empresa_id
    cliente = Cliente(**c_dict)
    db.add(cliente)
    await db.commit()
    await db.refresh(cliente)
    return cliente

from sqlalchemy.orm import joinedload, selectinload
from app.models.configuracion import ConfiguracionEmpresa

async def _formatear_factura_completa(factura_id: int, db: AsyncSession) -> dict:
    query = (
        select(Factura)
        .options(
            joinedload(Factura.cliente),
            joinedload(Factura.usuario),
            selectinload(Factura.lineas).joinedload(FacturaDetalle.producto)
        )
        .where(Factura.id == factura_id)
    )
    result = await db.execute(query)
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    empresa_id = f.empresa_id or 1
    res_cfg = await db.execute(
        select(ConfiguracionEmpresa).where(
            or_(ConfiguracionEmpresa.empresa_id == empresa_id, ConfiguracionEmpresa.id == empresa_id)
        )
    )
    cfg = res_cfg.scalar_one_or_none()
    tz = await _obtener_zona_horaria(db, empresa_id)

    fecha_dt = f.fecha
    if fecha_dt:
        if fecha_dt.tzinfo is None:
            fecha_dt = fecha_dt.replace(tzinfo=timezone.utc).astimezone(tz)
        else:
            fecha_dt = fecha_dt.astimezone(tz)
        fecha_iso = fecha_dt.isoformat()
        fecha_fmt = fecha_dt.strftime("%d/%m/%Y %I:%M %p")
    else:
        fecha_iso = None
        fecha_fmt = ""

    return {
        "id": f.id,
        "numero": f.numero,
        "fecha": fecha_iso,
        "fecha_formateada": fecha_fmt,
        "subtotal": float(f.subtotal or 0),
        "descuento_valor": float(f.descuento_valor or 0),
        "iva_valor": float(f.iva_valor or 0),
        "domicilio_valor": float(f.domicilio_valor or 0),
        "total": float(f.total or 0),
        "forma_pago": f.forma_pago,
        "valor_recibido": float(f.valor_recibido or 0),
        "cambio": float(f.cambio or 0),
        "observaciones": f.observaciones,
        "estado": f.estado,
        # Facturación Electrónica DIAN
        "cufe": f.cufe,
        "qr_cadena": f.qr_cadena,
        "qr_imagen_base64": f.qr_imagen_base64,
        "dian_estado": f.dian_estado or "NO_ENVIADA",
        "dian_xml_url": f.dian_xml_url,
        "dian_pdf_url": f.dian_pdf_url,
        "dian_errores": f.dian_errores,
        "dian_numero_oficial": f.dian_numero_oficial,
        "cliente": {
            "id": f.cliente.id if f.cliente else 1,
            "nombre": f.cliente.nombre if f.cliente else "CLIENTE MOSTRADOR (CONSUMIDOR FINAL)",
            "nit": f.cliente.nit if f.cliente else "222222222222",
            "telefono": f.cliente.telefono if f.cliente else "",
            "direccion": f.cliente.direccion if f.cliente else "",
            "email": f.cliente.email if f.cliente else "",
            "ciudad": f.cliente.ciudad if f.cliente else "",
        } if f.cliente else {
            "id": 1, "nombre": "CLIENTE MOSTRADOR (CONSUMIDOR FINAL)", "nit": "222222222222"
        },
        "cajero": {
            "id": f.usuario.id if f.usuario else 1,
            "nombre": f.usuario.nombre if f.usuario else "Cajero",
        } if f.usuario else {"id": 1, "nombre": "Cajero"},
        "empresa": {
            "nombre": cfg.nombre if cfg and cfg.nombre else "Mi Empresa",
            "nit": cfg.nit if cfg and cfg.nit else "",
            "direccion": cfg.direccion if cfg and cfg.direccion else "",
            "telefono": cfg.telefono if cfg and cfg.telefono else "",
            "email": cfg.email if cfg and cfg.email else "",
            "ciudad": cfg.ciudad if cfg and cfg.ciudad else "",
            "regimen": cfg.regimen if cfg and cfg.regimen else "SIMPLIFICADO",
            "logo_url": cfg.logo_url if cfg and cfg.logo_url else "",
            "mensaje_factura": cfg.mensaje_factura if cfg and cfg.mensaje_factura else "¡Gracias por su compra!",
            "resolucion_dian": getattr(cfg, "resolucion_dian", "") if cfg else "",
            "formato_impresion": getattr(cfg, "formato_impresion", "80MM") if cfg else "80MM",
            "moneda_simbolo": cfg.moneda_simbolo if cfg and cfg.moneda_simbolo else "$",
        },
        "lineas": [
            {
                "id": l.id,
                "producto_id": l.producto_id,
                "codigo": l.producto.codigo if l.producto else "S/C",
                "codigo_barras": (
                    l.producto.codigo_barras_unidad if l.presentacion == "UNIDAD" and l.producto and l.producto.codigo_barras_unidad
                    else (l.producto.codigo_barras_blister if l.presentacion == "BLISTER" and l.producto and l.producto.codigo_barras_blister
                    else (l.producto.codigo_barras if l.producto else ""))
                ),
                "nombre": l.producto.nombre if l.producto else f"Producto #{l.producto_id}",
                "principio_activo": l.producto.principio_activo if l.producto else "",
                "laboratorio": l.producto.laboratorio if l.producto else "",
                "presentacion": l.presentacion,
                "cantidad": float(l.cantidad),
                "precio_unitario": float(l.precio_unitario),
                "descuento_porcentaje": float(l.descuento_porcentaje or 0),
                "descuento_valor": float(l.descuento_valor or 0),
                "iva_porcentaje": float(l.iva_porcentaje or 0),
                "iva_valor": float(l.iva_valor or 0),
                "subtotal": float(l.subtotal),
                "total_linea": float(l.total_linea),
                "es_encargo": l.es_encargo,
            }
            for l in (f.lineas or [])
        ]
    }

# ─── Facturas ─────────────────────────────────────────────────────────────────

@router.post("/facturas")
async def crear_factura(
    datos: FacturaCreate,
    db: AsyncSession = Depends(get_db),
    usuario=Depends(get_current_user),
):
    empresa_id = usuario.empresa_id or 1
    factura = await venta_service.crear_factura(datos, usuario.id, db, empresa_id=empresa_id)

    # Si la empresa tiene habilitada la Facturación Electrónica DIAN / Factus, emitir automáticamente
    res_cfg = await db.execute(
        select(ConfiguracionEmpresa).where(
            or_(ConfiguracionEmpresa.empresa_id == empresa_id, ConfiguracionEmpresa.id == empresa_id)
        )
    )
    cfg = res_cfg.scalar_one_or_none()
    if cfg and cfg.fe_habilitada and cfg.fe_client_id and cfg.fe_client_secret:
        try:
            from app.services.factus_service import enviar_factura_a_dian
            await enviar_factura_a_dian(factura.id, db)
        except Exception:
            pass

    return await _formatear_factura_completa(factura.id, db)

@router.get("/facturas")
async def listar_facturas(
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    estado: Optional[str] = None,
    limite: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    tz = await _obtener_zona_horaria(db, empresa_id)
    query = select(Factura).where(Factura.empresa_id == empresa_id).order_by(Factura.fecha.desc())
    if estado:
        query = query.where(Factura.estado == estado)
    if fecha_inicio:
        dt_inicio_local = datetime.combine(fecha_inicio, time.min).replace(tzinfo=tz)
        dt_inicio_utc = dt_inicio_local.astimezone(timezone.utc)
        query = query.where(Factura.fecha >= dt_inicio_utc)
    if fecha_fin:
        dt_fin_local = datetime.combine(fecha_fin, time.max).replace(tzinfo=tz)
        dt_fin_utc = dt_fin_local.astimezone(timezone.utc)
        query = query.where(Factura.fecha <= dt_fin_utc)
    
    result = await db.execute(query.limit(limite))
    facturas = result.scalars().all()
    
    res_list = []
    for f in facturas:
        fecha_dt = f.fecha
        if fecha_dt:
            if fecha_dt.tzinfo is None:
                fecha_dt = fecha_dt.replace(tzinfo=timezone.utc).astimezone(tz)
            else:
                fecha_dt = fecha_dt.astimezone(tz)
            fecha_iso = fecha_dt.isoformat()
        else:
            fecha_iso = None

        res_list.append({
            "id": f.id, "numero": f.numero, "total": float(f.total),
            "estado": f.estado, "forma_pago": f.forma_pago,
            "cliente_id": f.cliente_id, "fecha": fecha_iso,
            "cufe": f.cufe,
            "dian_estado": f.dian_estado or "NO_ENVIADA",
            "dian_numero_oficial": f.dian_numero_oficial,
        })
    return res_list

@router.post("/facturas/{factura_id}/emitir-dian")
async def emitir_factura_dian(
    factura_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    # Validar pertenencia a la empresa
    res_f = await db.execute(select(Factura).where(Factura.id == factura_id, Factura.empresa_id == empresa_id))
    if not res_f.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    from app.services.factus_service import enviar_factura_a_dian
    resultado = await enviar_factura_a_dian(factura_id, db)
    factura_act = await _formatear_factura_completa(factura_id, db)
    return {
        "resultado": resultado,
        "factura": factura_act,
    }

@router.get("/facturas/{factura_id}")
async def get_factura(factura_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    empresa_id = current_user.empresa_id or 1
    res_f = await db.execute(select(Factura).where(Factura.id == factura_id, Factura.empresa_id == empresa_id))
    if not res_f.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return await _formatear_factura_completa(factura_id, db)

@router.post("/facturas/{factura_id}/anular")
async def anular_factura(
    factura_id: int,
    body: AnularFacturaRequest,
    db: AsyncSession = Depends(get_db),
    usuario=Depends(get_current_user),
):
    empresa_id = usuario.empresa_id or 1
    res_f = await db.execute(select(Factura).where(Factura.id == factura_id, Factura.empresa_id == empresa_id))
    if not res_f.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    factura = await venta_service.anular_factura(factura_id, body.motivo, usuario.id, db)
    return {"mensaje": f"Factura {factura.numero} anulada exitosamente"}

@router.post("/facturas/{factura_id}/devolucion")
async def devolver_factura(
    factura_id: int,
    body: DevolucionFacturaRequest,
    db: AsyncSession = Depends(get_db),
    usuario=Depends(get_current_user),
):
    empresa_id = usuario.empresa_id or 1
    res_f = await db.execute(select(Factura).where(Factura.id == factura_id, Factura.empresa_id == empresa_id))
    if not res_f.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    resultado = await venta_service.procesar_devolucion_factura(factura_id, body, usuario.id, db)
    return resultado

@router.get("/bonos/cliente/{cliente_id}")
async def listar_bonos(
    cliente_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    return await venta_service.listar_bonos_cliente(cliente_id, db)

@router.get("/bonos/verificar/{codigo}")
async def verificar_bono(
    codigo: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await venta_service.verificar_bono_codigo(codigo, db)

# ─── Reportes ─────────────────────────────────────────────────────────────────

@router.get("/reportes/resumen-dia")
async def resumen_dia(
    fecha: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    tz = await _obtener_zona_horaria(db, empresa_id)
    if fecha is None:
        ahora_local = datetime.now(tz)
        dia = ahora_local.date()
    else:
        dia = fecha

    dt_inicio_local = datetime.combine(dia, time.min).replace(tzinfo=tz)
    dt_inicio_utc = dt_inicio_local.astimezone(timezone.utc)
    dt_fin_local = datetime.combine(dia, time.max).replace(tzinfo=tz)
    dt_fin_utc = dt_fin_local.astimezone(timezone.utc)

    result = await db.execute(
        select(
            func.count(Factura.id).label("total_facturas"),
            func.sum(Factura.total).label("total_ventas"),
            func.sum(Factura.iva_valor).label("total_iva"),
        ).where(
            Factura.empresa_id == empresa_id,
            Factura.fecha >= dt_inicio_utc,
            Factura.fecha <= dt_fin_utc,
            Factura.estado == "EMITIDA",
        )
    )
    row = result.one()
    return {
        "fecha": dia.isoformat(),
        "total_facturas": row.total_facturas or 0,
        "total_ventas": float(row.total_ventas or 0),
        "total_iva": float(row.total_iva or 0),
    }


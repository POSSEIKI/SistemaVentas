from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.producto import Producto
from app.models.inventario import Proveedor, MovimientoInventario
from app.schemas.ventas import CompraCreate, ProveedorCreate, ProveedorUpdate, ProveedorOut
from app.services import venta_service, inventario_service
from typing import Optional, List

router = APIRouter(tags=["Inventario"])

@router.post("/compras")
async def registrar_compra(
    datos: CompraCreate,
    db: AsyncSession = Depends(get_db),
    usuario=Depends(get_current_user),
):
    compra = await venta_service.crear_compra(datos, usuario.id, db)
    return {"id": compra.id, "numero": compra.numero, "total": float(compra.total)}

@router.get("/compras")
async def listar_compras(
    q: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    proveedor_id: Optional[int] = None,
    limite: int = 50,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    from app.models.inventario import Compra, CompraDetalle, Proveedor
    from sqlalchemy.orm import joinedload, selectinload
    from datetime import datetime, time

    query = (
        select(Compra)
        .options(joinedload(Compra.proveedor), selectinload(Compra.lineas))
        .order_by(Compra.fecha.desc())
    )

    if proveedor_id:
        query = query.where(Compra.proveedor_id == proveedor_id)

    if fecha_inicio:
        try:
            fi = datetime.combine(datetime.strptime(fecha_inicio, "%Y-%m-%d").date(), time.min)
            query = query.where(Compra.fecha >= fi)
        except Exception:
            pass

    if fecha_fin:
        try:
            ff = datetime.combine(datetime.strptime(fecha_fin, "%Y-%m-%d").date(), time.max)
            query = query.where(Compra.fecha <= ff)
        except Exception:
            pass

    if q:
        query = query.join(Compra.proveedor, isouter=True).where(
            or_(
                Compra.numero.ilike(f"%{q}%"),
                Compra.numero_factura_proveedor.ilike(f"%{q}%"),
                Proveedor.razon_social.ilike(f"%{q}%"),
            )
        )

    max_limit = 50
    try:
        max_limit = int(limite) if int(limite) > 0 else 50
    except Exception:
        max_limit = 50

    result = await db.execute(query.limit(max_limit))
    compras = result.scalars().all()

    return [
        {
            "id": c.id,
            "numero": c.numero,
            "numero_factura_proveedor": c.numero_factura_proveedor,
            "fecha": c.fecha.isoformat() if c.fecha else None,
            "proveedor_id": c.proveedor_id,
            "proveedor_nombre": c.proveedor.razon_social if c.proveedor else "Sin proveedor asignado",
            "proveedor_nit": c.proveedor.nit if c.proveedor else None,
            "subtotal": float(c.subtotal or 0),
            "iva_valor": float(c.iva_valor or 0),
            "total": float(c.total or 0),
            "total_items": len(c.lineas) if c.lineas else 0,
            "observaciones": c.observaciones,
            "estado": c.estado,
        }
        for c in compras
    ]

@router.get("/compras/{id}")
async def obtener_compra(
    id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    from app.models.inventario import Compra, CompraDetalle
    from app.models.usuario import Usuario
    from sqlalchemy.orm import joinedload, selectinload

    query = (
        select(Compra)
        .options(
            joinedload(Compra.proveedor),
            selectinload(Compra.lineas).joinedload(CompraDetalle.producto)
        )
        .where(Compra.id == id)
    )
    result = await db.execute(query)
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Factura de compra no encontrada")

    res_u = await db.execute(select(Usuario).where(Usuario.id == c.usuario_id))
    u = res_u.scalar_one_or_none()

    return {
        "id": c.id,
        "numero": c.numero,
        "numero_factura_proveedor": c.numero_factura_proveedor,
        "fecha": c.fecha.isoformat() if c.fecha else None,
        "proveedor": {
            "id": c.proveedor.id,
            "razon_social": c.proveedor.razon_social,
            "nit": c.proveedor.nit,
            "telefono": c.proveedor.telefono,
            "ciudad": c.proveedor.ciudad,
        } if c.proveedor else None,
        "subtotal": float(c.subtotal or 0),
        "iva_valor": float(c.iva_valor or 0),
        "total": float(c.total or 0),
        "observaciones": c.observaciones,
        "estado": c.estado,
        "usuario_nombre": u.nombre if u else "Administrador",
        "lineas": [
            {
                "id": l.id,
                "producto_id": l.producto_id,
                "codigo": l.producto.codigo if l.producto else "S/C",
                "codigo_barras": l.producto.codigo_barras if l.producto else "",
                "nombre": l.producto.nombre if l.producto else f"Producto #{l.producto_id}",
                "principio_activo": l.producto.principio_activo if l.producto else "",
                "laboratorio": l.producto.laboratorio if l.producto else "",
                "cantidad": float(l.cantidad),
                "costo_unitario": float(l.costo_unitario),
                "iva_porcentaje": float(l.iva_porcentaje or 0),
                "iva_valor": float(l.iva_valor or 0),
                "subtotal": float(l.subtotal),
                "precio_sugerido": float(l.precio_sugerido) if l.precio_sugerido else None,
            }
            for l in (c.lineas or [])
        ]
    }

@router.post("/compras/analizar-factura-excel")
async def analizar_factura_excel(
    archivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    contenido = await archivo.read()
    if not contenido:
        raise HTTPException(status_code=400, detail="El archivo enviado está vacío")
    resultado = await inventario_service.analizar_factura_compra_excel(
        file_bytes=contenido,
        filename=archivo.filename,
        db=db,
    )
    return resultado

@router.get("/inventario/movimientos")
async def listar_movimientos(
    producto_id: Optional[int] = None,
    limite: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = select(MovimientoInventario).order_by(MovimientoInventario.fecha.desc())
    if producto_id:
        query = query.where(MovimientoInventario.producto_id == producto_id)
    result = await db.execute(query.limit(limite))
    movs = result.scalars().all()
    return [
        {
            "id": m.id, "producto_id": m.producto_id, "tipo": m.tipo,
            "cantidad": float(m.cantidad), "stock_anterior": float(m.stock_anterior),
            "stock_nuevo": float(m.stock_nuevo), "fecha": m.fecha.isoformat() if m.fecha else None,
            "referencia_tipo": m.referencia_tipo, "observacion": m.observacion,
        }
        for m in movs
    ]

@router.get("/inventario/stock-bajo")
async def stock_bajo(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Producto).where(
            Producto.activo == True,
            Producto.afecta_inventario == True,
            Producto.stock_actual <= Producto.stock_minimo,
        )
    )
    productos = result.scalars().all()
    return [
        {
            "id": p.id, "codigo": p.codigo, "nombre": p.nombre,
            "stock_actual": float(p.stock_actual), "stock_minimo": float(p.stock_minimo),
        }
        for p in productos
    ]

@router.get("/proveedores", response_model=List[ProveedorOut])
async def listar_proveedores(
    q: Optional[str] = None,
    solo_activos: bool = True,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = select(Proveedor)
    if solo_activos:
        query = query.where(Proveedor.activo == True)
    if q:
        query = query.where(
            or_(
                Proveedor.razon_social.ilike(f"%{q}%"),
                Proveedor.nit.ilike(f"%{q}%"),
                Proveedor.contacto.ilike(f"%{q}%"),
                Proveedor.ciudad.ilike(f"%{q}%"),
            )
        )
    result = await db.execute(query.order_by(Proveedor.razon_social))
    return result.scalars().all()

@router.get("/proveedores/{proveedor_id}", response_model=ProveedorOut)
async def obtener_proveedor(
    proveedor_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Proveedor).where(Proveedor.id == proveedor_id))
    proveedor = result.scalar_one_or_none()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return proveedor

@router.post("/proveedores", response_model=ProveedorOut)
async def crear_proveedor(
    datos: ProveedorCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    if datos.nit:
        existente = await db.execute(select(Proveedor).where(Proveedor.nit == datos.nit))
        if existente.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe un proveedor con este NIT / Documento")

    proveedor = Proveedor(**datos.model_dump())
    db.add(proveedor)
    await db.commit()
    await db.refresh(proveedor)
    return proveedor

@router.patch("/proveedores/{proveedor_id}", response_model=ProveedorOut)
async def actualizar_proveedor(
    proveedor_id: int,
    datos: ProveedorUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Proveedor).where(Proveedor.id == proveedor_id))
    proveedor = result.scalar_one_or_none()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    update_data = datos.model_dump(exclude_unset=True)
    if "nit" in update_data and update_data["nit"] and update_data["nit"] != proveedor.nit:
        existente = await db.execute(select(Proveedor).where(Proveedor.nit == update_data["nit"], Proveedor.id != proveedor_id))
        if existente.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe otro proveedor con este NIT / Documento")

    for field, value in update_data.items():
        setattr(proveedor, field, value)

    await db.commit()
    await db.refresh(proveedor)
    return proveedor

@router.delete("/proveedores/{proveedor_id}")
async def eliminar_o_desactivar_proveedor(
    proveedor_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Proveedor).where(Proveedor.id == proveedor_id))
    proveedor = result.scalar_one_or_none()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    proveedor.activo = False
    await db.commit()
    return {"ok": True, "mensaje": "Proveedor desactivado exitosamente"}

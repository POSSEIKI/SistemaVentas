from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.cliente import Cliente
from app.models.factura import Factura, FacturaDetalle
from app.schemas.ventas import ClienteCreate, ClienteUpdate, ClienteOut, FacturaCreate, FacturaOut, AnularFacturaRequest
from app.services import venta_service
from typing import List, Optional
from datetime import date

router = APIRouter(tags=["Ventas"])

# ─── Clientes ─────────────────────────────────────────────────────────────────

@router.get("/clientes", response_model=List[ClienteOut])
async def listar_clientes(
    q: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = select(Cliente).where(Cliente.activo == True)
    if q:
        query = query.where(or_(
            Cliente.nombre.ilike(f"%{q}%"),
            Cliente.nit.ilike(f"%{q}%"),
            Cliente.telefono.ilike(f"%{q}%"),
            Cliente.ciudad.ilike(f"%{q}%"),
            Cliente.direccion.ilike(f"%{q}%"),
        ))
    result = await db.execute(query.order_by(Cliente.id.desc()).limit(100))
    return result.scalars().all()

@router.get("/clientes/{cliente_id}", response_model=ClienteOut)
async def get_cliente(cliente_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente

@router.get("/clientes/buscar-nit/{nit}", response_model=ClienteOut)
async def buscar_cliente_nit(nit: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Cliente).where(Cliente.nit == nit))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente

@router.post("/clientes", response_model=ClienteOut)
async def crear_cliente(datos: ClienteCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    if datos.nit and datos.nit.strip():
        res_existente = await db.execute(select(Cliente).where(Cliente.nit == datos.nit.strip()))
        existente = res_existente.scalar_one_or_none()
        if existente:
            raise HTTPException(status_code=400, detail=f"Ya existe un cliente registrado con el documento {datos.nit}")

    cliente = Cliente(**datos.model_dump())
    db.add(cliente)
    await db.commit()
    await db.refresh(cliente)
    return cliente

@router.patch("/clientes/{cliente_id}", response_model=ClienteOut)
async def actualizar_cliente(
    cliente_id: int,
    datos: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Si se intenta cambiar el NIT, validar duplicados
    if datos.nit and datos.nit.strip() != cliente.nit:
        res_dup = await db.execute(select(Cliente).where(Cliente.nit == datos.nit.strip(), Cliente.id != cliente_id))
        if res_dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Ya existe otro cliente con el documento {datos.nit}")

    datos_dict = datos.model_dump(exclude_unset=True)
    for campo, valor in datos_dict.items():
        setattr(cliente, campo, valor)

    await db.commit()
    await db.refresh(cliente)
    return cliente

@router.delete("/clientes/{cliente_id}")
async def eliminar_cliente(cliente_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    if cliente_id == 1:
        raise HTTPException(status_code=400, detail="No se puede eliminar el Cliente Mostrador por defecto del sistema")
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    cliente.activo = False
    await db.commit()
    return {"mensaje": "Cliente desactivado correctamente"}

@router.post("/clientes/crear-o-encontrar", response_model=ClienteOut)
async def crear_o_encontrar(datos: ClienteCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    if datos.nit:
        result = await db.execute(select(Cliente).where(Cliente.nit == datos.nit))
        existente = result.scalar_one_or_none()
        if existente:
            return existente
    cliente = Cliente(**datos.model_dump())
    db.add(cliente)
    await db.commit()
    await db.refresh(cliente)
    return cliente

# ─── Facturas ─────────────────────────────────────────────────────────────────

@router.post("/facturas")
async def crear_factura(
    datos: FacturaCreate,
    db: AsyncSession = Depends(get_db),
    usuario=Depends(get_current_user),
):
    factura = await venta_service.crear_factura(datos, usuario.id, db)
    return {"id": factura.id, "numero": factura.numero, "total": float(factura.total), "cambio": float(factura.cambio)}

@router.get("/facturas")
async def listar_facturas(
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    estado: Optional[str] = None,
    limite: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = select(Factura).order_by(Factura.fecha.desc())
    if estado:
        query = query.where(Factura.estado == estado)
    if fecha_inicio:
        query = query.where(func.date(Factura.fecha) >= fecha_inicio)
    if fecha_fin:
        query = query.where(func.date(Factura.fecha) <= fecha_fin)
    result = await db.execute(query.limit(limite))
    facturas = result.scalars().all()
    return [
        {
            "id": f.id, "numero": f.numero, "total": float(f.total),
            "estado": f.estado, "forma_pago": f.forma_pago,
            "cliente_id": f.cliente_id, "fecha": f.fecha.isoformat() if f.fecha else None,
        }
        for f in facturas
    ]

@router.get("/facturas/{factura_id}")
async def get_factura(factura_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Factura).where(Factura.id == factura_id))
    factura = result.scalar_one_or_none()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return factura

@router.post("/facturas/{factura_id}/anular")
async def anular_factura(
    factura_id: int,
    body: AnularFacturaRequest,
    db: AsyncSession = Depends(get_db),
    usuario=Depends(get_current_user),
):
    factura = await venta_service.anular_factura(factura_id, body.motivo, usuario.id, db)
    return {"mensaje": f"Factura {factura.numero} anulada exitosamente"}

# ─── Reportes ─────────────────────────────────────────────────────────────────

@router.get("/reportes/resumen-dia")
async def resumen_dia(
    fecha: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    from datetime import date as date_type
    dia = fecha or date_type.today()
    result = await db.execute(
        select(
            func.count(Factura.id).label("total_facturas"),
            func.sum(Factura.total).label("total_ventas"),
            func.sum(Factura.iva_valor).label("total_iva"),
        ).where(
            func.date(Factura.fecha) == dia,
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

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.producto import Producto
from app.models.inventario import Proveedor, MovimientoInventario
from app.schemas.ventas import CompraCreate
from app.services import venta_service
from typing import Optional

router = APIRouter(tags=["Inventario"])

@router.post("/compras")
async def registrar_compra(
    datos: CompraCreate,
    db: AsyncSession = Depends(get_db),
    usuario=Depends(get_current_user),
):
    compra = await venta_service.crear_compra(datos, usuario.id, db)
    return {"id": compra.id, "numero": compra.numero, "total": float(compra.total)}

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

@router.get("/proveedores")
async def listar_proveedores(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Proveedor).where(Proveedor.activo == True).order_by(Proveedor.razon_social))
    return [{"id": p.id, "razon_social": p.razon_social, "nit": p.nit} for p in result.scalars().all()]

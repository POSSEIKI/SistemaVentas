from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.db.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.producto import Producto, Categoria, UnidadMedida
from app.schemas.ventas import ProductoCreate, ProductoUpdate, ProductoOut
from typing import List, Optional

router = APIRouter(prefix="/productos", tags=["Productos"])

@router.get("/buscar", response_model=List[ProductoOut])
async def buscar_productos(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(Producto).where(
            Producto.activo == True,
            or_(
                Producto.nombre.ilike(f"%{q}%"),
                Producto.codigo.ilike(f"%{q}%"),
                Producto.codigo_barras.ilike(f"%{q}%"),
            )
        ).limit(20)
    )
    productos = result.scalars().all()
    return [_to_out(p) for p in productos]

@router.get("/categorias/lista")
async def listar_categorias(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Categoria).where(Categoria.activo == True))
    return [{"id": c.id, "nombre": c.nombre} for c in result.scalars().all()]

@router.get("/unidades/lista")
async def listar_unidades(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(UnidadMedida).where(UnidadMedida.activo == True))
    return [{"id": u.id, "nombre": u.nombre, "abreviatura": u.abreviatura} for u in result.scalars().all()]

@router.get("", response_model=List[ProductoOut])
async def listar_productos(
    categoria_id: Optional[int] = None,
    activo: Optional[bool] = True,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = select(Producto)
    if activo is not None:
        query = query.where(Producto.activo == activo)
    if categoria_id:
        query = query.where(Producto.categoria_id == categoria_id)
    result = await db.execute(query.order_by(Producto.nombre))
    return [_to_out(p) for p in result.scalars().all()]

@router.post("", response_model=ProductoOut)
async def crear_producto(
    datos: ProductoCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    producto = Producto(**datos.model_dump())
    db.add(producto)
    await db.commit()
    await db.refresh(producto)
    return _to_out(producto)

@router.patch("/{producto_id}", response_model=ProductoOut)
async def actualizar_producto(
    producto_id: int,
    datos: ProductoUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(Producto).where(Producto.id == producto_id))
    producto = result.scalar_one_or_none()
    if not producto:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(producto, campo, valor)
    await db.commit()
    await db.refresh(producto)
    return _to_out(producto)

def _to_out(p: Producto) -> ProductoOut:
    return ProductoOut(
        id=p.id,
        codigo=p.codigo,
        nombre=p.nombre,
        precio_venta=p.precio_venta,
        precio_costo=p.precio_costo,
        iva_porcentaje=p.iva_porcentaje,
        stock_actual=p.stock_actual,
        stock_minimo=p.stock_minimo,
        afecta_inventario=p.afecta_inventario,
        es_servicio=p.es_servicio,
        activo=p.activo,
        categoria_id=p.categoria_id,
        categoria_nombre=p.categoria.nombre if p.categoria else None,
        unidad_medida_id=p.unidad_medida_id,
        unidad_abreviatura=p.unidad_medida.abreviatura if p.unidad_medida else None,
    )

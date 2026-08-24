import io
import csv
from decimal import Decimal
from typing import List, Optional
import openpyxl
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.producto import Producto, Categoria, UnidadMedida
from app.schemas.ventas import ProductoCreate, ProductoUpdate, ProductoOut

router = APIRouter(prefix="/productos", tags=["Productos"])

def _to_out(p: Producto) -> ProductoOut:
    return ProductoOut(
        id=p.id,
        codigo=p.codigo,
        codigo_barras=p.codigo_barras,
        nombre=p.nombre,
        descripcion=p.descripcion,
        precio_venta=p.precio_venta or Decimal("0"),
        precio_costo=p.precio_costo or Decimal("0"),
        iva_porcentaje=p.iva_porcentaje or Decimal("0"),
        stock_actual=p.stock_actual or Decimal("0"),
        stock_minimo=p.stock_minimo or Decimal("0"),
        afecta_inventario=p.afecta_inventario if p.afecta_inventario is not None else True,
        es_servicio=p.es_servicio if p.es_servicio is not None else False,
        activo=p.activo if p.activo is not None else True,
        categoria_id=p.categoria_id,
        categoria_nombre=p.categoria.nombre if p.categoria else None,
        unidad_medida_id=p.unidad_medida_id,
        unidad_abreviatura=p.unidad_medida.abreviatura if p.unidad_medida else None,
        maneja_fracciones=p.maneja_fracciones if p.maneja_fracciones is not None else False,
        contenido_caja=p.contenido_caja or 1,
        contenido_blister=p.contenido_blister or 0,
        precio_caja=p.precio_caja or Decimal("0"),
        precio_blister=p.precio_blister or Decimal("0"),
        precio_unidad=p.precio_unidad or Decimal("0"),
        laboratorio=p.laboratorio,
        principio_activo=p.principio_activo,
        ubicacion=p.ubicacion,
    )

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
                Producto.principio_activo.ilike(f"%{q}%"),
                Producto.laboratorio.ilike(f"%{q}%"),
            )
        ).limit(30)
    )
    productos = result.scalars().all()
    return [_to_out(p) for p in productos]

@router.get("/categorias/lista")
async def listar_categorias(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Categoria).where(Categoria.activo == True).order_by(Categoria.nombre))
    return [{"id": c.id, "nombre": c.nombre} for c in result.scalars().all()]

@router.post("/categorias")
async def crear_categoria(datos: dict, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre de categoría requerido")
    
    result = await db.execute(select(Categoria).where(Categoria.nombre.ilike(nombre)))
    cat = result.scalar_one_or_none()
    if not cat:
        cat = Categoria(nombre=nombre)
        db.add(cat)
        await db.commit()
        await db.refresh(cat)
    return {"id": cat.id, "nombre": cat.nombre}

@router.get("/unidades/lista")
async def listar_unidades(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(UnidadMedida).where(UnidadMedida.activo == True).order_by(UnidadMedida.nombre))
    return [{"id": u.id, "nombre": u.nombre, "abreviatura": u.abreviatura} for u in result.scalars().all()]

@router.get("", response_model=List[ProductoOut])
async def listar_productos(
    categoria_id: Optional[int] = None,
    activo: Optional[bool] = True,
    limite: int = Query(200, le=1000),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = select(Producto)
    if activo is not None:
        query = query.where(Producto.activo == activo)
    if categoria_id:
        query = query.where(Producto.categoria_id == categoria_id)
    result = await db.execute(query.order_by(Producto.nombre).limit(limite))
    return [_to_out(p) for p in result.scalars().all()]

@router.post("", response_model=ProductoOut)
async def crear_producto(
    datos: ProductoCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    # Validar código único
    result = await db.execute(select(Producto).where(Producto.codigo == datos.codigo.strip()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Ya existe un producto con el código '{datos.codigo}'")

    # Si es fraccionado y precio_venta no fue puesto, usar precio_caja o precio_unidad
    p_data = datos.model_dump()
    if p_data.get("maneja_fracciones"):
        if not p_data.get("precio_venta") and p_data.get("precio_caja"):
            p_data["precio_venta"] = p_data["precio_caja"]

    producto = Producto(**p_data)
    db.add(producto)
    await db.commit()
    await db.refresh(producto)
    return _to_out(producto)

@router.patch("/{producto_id}", response_model=ProductoOut)
async def actualizar_producto(
    producto_id: int,
    datos: ProductoUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Producto).where(Producto.id == producto_id))
    producto = result.scalar_one_or_none()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(producto, campo, valor)
    
    await db.commit()
    await db.refresh(producto)
    return _to_out(producto)

@router.delete("/{producto_id}")
async def eliminar_producto(producto_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Producto).where(Producto.id == producto_id))
    producto = result.scalar_one_or_none()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    producto.activo = False
    await db.commit()
    return {"mensaje": "Producto desactivado"}

# ─── PLANTILLA DE EXCEL ───────────────────────────────────────────────────────

@router.get("/plantilla-excel")
async def descargar_plantilla_excel(_=Depends(get_current_user)):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Productos"

    headers = [
        "Codigo", "Codigo_Barras", "Nombre", "Categoria", "Unidad_Medida",
        "Precio_Costo", "Precio_Venta", "IVA_Porcentaje", "Stock_Actual", "Stock_Minimo",
        "Maneja_Fracciones_SI_NO", "Contenido_Caja", "Contenido_Blister",
        "Precio_Caja", "Precio_Blister", "Precio_Unidad", "Laboratorio_Marca", "Principio_Activo", "Ubicacion"
    ]
    ws.append(headers)

    # Filas de ejemplo
    ejemplos = [
        [
            "100026176", "7702057001234", "ACETAMINOFEN 500 MG 100 TAB MK", "Medicamentos", "CAJA",
            12000, 18000, 0, 150, 20,
            "SI", 100, 10,
            18000, 2000, 300, "TECNOQUIMICAS", "ACETAMINOFEN", "Estante A1"
        ],
        [
            "670", "", "ABRAZADERA 1 PULGADA TITAN", "Ferreteria", "UNIDAD",
            1200, 2000, 19, 50, 10,
            "NO", 1, 0,
            2000, 0, 0, "TITAN", "", "Bodega B"
        ]
    ]
    for ej in ejemplos:
        ws.append(ej)

    # Estilo básico
    for col in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col)
        cell.font = openpyxl.styles.Font(bold=True, color="FFFFFF")
        cell.fill = openpyxl.styles.PatternFill(start_color="16A34A", end_color="16A34A", fill_type="solid")

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=plantilla_productos_sistemaventas.xlsx"}
    )

# ─── IMPORTADOR INTELIGENTE (EXCEL / CSV) ──────────────────────────────────────

@router.post("/importar-excel")
async def importar_archivo_productos(
    archivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    from app.services.import_service import procesar_archivo_inventario
    contenido = await archivo.read()
    try:
        resultado = await procesar_archivo_inventario(
            contenido=contenido,
            nombre_archivo=archivo.filename or "",
            db=db
        )
        return resultado
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando archivo: {str(e)}")

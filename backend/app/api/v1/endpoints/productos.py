import io
import csv
from decimal import Decimal
from typing import List, Optional
import openpyxl
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import joinedload

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
    categoria_id: Optional[int] = None,
    modo: Optional[str] = Query("NOMBRE", enum=["NOMBRE", "SUSTANCIA", "CODIGO"]),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    from sqlalchemy import case
    q_clean = q.strip()

    if modo == "SUSTANCIA":
        # Búsqueda dedicada por principio activo / sustancia genérica
        rank_expr = case(
            (Producto.principio_activo == q_clean, 1),
            (Producto.principio_activo.ilike(f"{q_clean}%"), 2),
            (Producto.principio_activo.ilike(f"% {q_clean}%"), 3),
            (Producto.principio_activo.ilike(f"%{q_clean}%"), 4),
            else_=5
        )
        condiciones = [
            Producto.activo == True,
            Producto.principio_activo.isnot(None),
            Producto.principio_activo.ilike(f"%{q_clean}%")
        ]
    elif modo == "CODIGO":
        # Búsqueda dedicada por código o código de barras
        rank_expr = case(
            (Producto.codigo_barras == q_clean, 1),
            (Producto.codigo == q_clean, 2),
            (Producto.codigo_barras.ilike(f"{q_clean}%"), 3),
            (Producto.codigo.ilike(f"{q_clean}%"), 4),
            else_=5
        )
        condiciones = [
            Producto.activo == True,
            or_(
                Producto.codigo_barras.ilike(f"%{q_clean}%"),
                Producto.codigo.ilike(f"%{q_clean}%"),
            )
        ]
    else:
        # Modo NOMBRE (Predeterminado): Prioridad absoluta al Nombre Comercial y Código
        rank_expr = case(
            (Producto.codigo_barras == q_clean, 1),
            (Producto.codigo == q_clean, 2),
            (Producto.nombre.ilike(f"{q_clean}%"), 3),
            (Producto.nombre.ilike(f"% {q_clean}%"), 4),
            (Producto.nombre.ilike(f"%{q_clean}%"), 5),
            (Producto.codigo.ilike(f"{q_clean}%"), 6),
            (Producto.principio_activo.ilike(f"{q_clean}%"), 7),
            (Producto.principio_activo.ilike(f"%{q_clean}%"), 8),
            (Producto.laboratorio.ilike(f"%{q_clean}%"), 9),
            else_=10
        )
        condiciones = [
            Producto.activo == True,
            or_(
                Producto.nombre.ilike(f"%{q_clean}%"),
                Producto.codigo.ilike(f"%{q_clean}%"),
                Producto.codigo_barras.ilike(f"%{q_clean}%"),
                Producto.principio_activo.ilike(f"%{q_clean}%"),
                Producto.laboratorio.ilike(f"%{q_clean}%"),
            )
        ]

    if categoria_id:
        condiciones.append(Producto.categoria_id == categoria_id)

    stmt = (
        select(Producto)
        .options(joinedload(Producto.categoria), joinedload(Producto.unidad_medida))
        .where(*condiciones)
        .order_by(rank_expr, Producto.nombre)
        .limit(50)
    )
    result = await db.execute(stmt)
    productos = result.scalars().unique().all()
    return [_to_out(p) for p in productos]

@router.get("/categorias/lista")
async def listar_categorias(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    stmt = (
        select(Categoria.id, Categoria.nombre, func.count(Producto.id).label("total_productos"))
        .outerjoin(Producto, (Producto.categoria_id == Categoria.id) & (Producto.activo == True))
        .where(Categoria.activo == True)
        .group_by(Categoria.id, Categoria.nombre)
        .order_by(Categoria.nombre)
    )
    result = await db.execute(stmt)
    return [
        {"id": row.id, "nombre": row.nombre, "total_productos": row.total_productos}
        for row in result.all()
    ]

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
    return {"id": cat.id, "nombre": cat.nombre, "total_productos": 0}

@router.get("/unidades/lista")
async def listar_unidades(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(UnidadMedida).where(UnidadMedida.activo == True).order_by(UnidadMedida.nombre))
    return [{"id": u.id, "nombre": u.nombre, "abreviatura": u.abreviatura} for u in result.scalars().all()]

@router.get("/por-codigo/{codigo}", response_model=ProductoOut)
async def obtener_por_codigo(codigo: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    stmt = (
        select(Producto)
        .options(joinedload(Producto.categoria), joinedload(Producto.unidad_medida))
        .where(Producto.codigo == codigo.strip())
    )
    result = await db.execute(stmt)
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return _to_out(p)

@router.get("", response_model=List[ProductoOut])
async def listar_productos(
    categoria_id: Optional[int] = None,
    q: Optional[str] = None,
    activo: Optional[bool] = True,
    limite: int = Query(200, le=1000),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = (
        select(Producto)
        .options(joinedload(Producto.categoria), joinedload(Producto.unidad_medida))
    )
    condiciones = []
    if activo is not None:
        condiciones.append(Producto.activo == activo)
    if categoria_id:
        condiciones.append(Producto.categoria_id == categoria_id)
    if q and q.strip():
        condiciones.append(
            or_(
                Producto.nombre.ilike(f"%{q.strip()}%"),
                Producto.codigo.ilike(f"%{q.strip()}%"),
                Producto.codigo_barras.ilike(f"%{q.strip()}%"),
                Producto.principio_activo.ilike(f"%{q.strip()}%"),
                Producto.laboratorio.ilike(f"%{q.strip()}%"),
            )
        )
    if condiciones:
        query = query.where(*condiciones)

    result = await db.execute(query.order_by(Producto.id.desc()).limit(limite))
    return [_to_out(p) for p in result.scalars().unique().all()]

@router.post("", response_model=ProductoOut)
async def crear_producto(
    datos: ProductoCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    # Validar código único
    result = await db.execute(select(Producto).where(Producto.codigo == datos.codigo.strip()))
    existente = result.scalar_one_or_none()
    if existente:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un producto con el código '{datos.codigo}' (ID: {existente.id}). Búscalo en la tabla para modificarlo o usa otro código."
        )

    # Si es fraccionado y precio_venta no fue puesto, usar precio_caja o precio_unidad
    p_data = datos.model_dump()
    if p_data.get("maneja_fracciones"):
        if not p_data.get("precio_venta") and p_data.get("precio_caja"):
            p_data["precio_venta"] = p_data["precio_caja"]

    producto = Producto(**p_data)
    db.add(producto)
    await db.commit()
    
    # Reload with relationships
    stmt = (
        select(Producto)
        .options(joinedload(Producto.categoria), joinedload(Producto.unidad_medida))
        .where(Producto.id == producto.id)
    )
    res = await db.execute(stmt)
    return _to_out(res.scalar_one())

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
    
    # Reload with relationships
    stmt = (
        select(Producto)
        .options(joinedload(Producto.categoria), joinedload(Producto.unidad_medida))
        .where(Producto.id == producto_id)
    )
    res = await db.execute(stmt)
    return _to_out(res.scalar_one())

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

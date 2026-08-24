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
    nombre_archivo = (archivo.filename or "").lower()
    contenido = await archivo.read()
    
    filas = []
    if nombre_archivo.endswith(".xlsx") or nombre_archivo.endswith(".xls"):
        wb = openpyxl.load_workbook(io.BytesIO(contenido), data_only=True)
        ws = wb.active
        for row in ws.iter_rows(values_only=True):
            filas.append(list(row))
    elif nombre_archivo.endswith(".csv"):
        texto = contenido.decode("utf-8-sig", errors="replace")
        lector = csv.reader(io.StringIO(texto))
        for row in lector:
            filas.append(row)
    else:
        raise HTTPException(status_code=400, detail="Formato no soportado. Suba archivo .xlsx o .csv")

    if not filas or len(filas) < 2:
        raise HTTPException(status_code=400, detail="El archivo está vacío o no contiene datos")

    # Identificar encabezados
    header_row = filas[0]
    headers_clean = [str(h).strip().lower() if h is not None else "" for h in header_row]

    # Cargar mapa de categorías existentes
    res_cats = await db.execute(select(Categoria))
    categorias_map = {c.nombre.lower(): c.id for c in res_cats.scalars().all()}

    # Cargar mapa de unidades de medida existentes
    res_unis = await db.execute(select(UnidadMedida))
    unidades_map = {u.nombre.lower(): u.id for u in res_unis.scalars().all()}
    unidades_map.update({u.abreviatura.lower(): u.id for u in res_unis.scalars().all() if u.abreviatura})

    creados = 0
    actualizados = 0
    errores = []

    # Detectar Tipo de Formato:
    # 1. Formato Droguería Maestro (contiene 'cod producto' y 'contenido interno caja')
    es_maestro = "cod producto" in headers_clean and any("contenido interno caja" in h for h in headers_clean)
    # 2. Formato Ferretería (contiene 'código' o 'codigo' y 'precios')
    es_ferreteria = not es_maestro and ("precios" in headers_clean or "tipo" in headers_clean)

    for i, row in enumerate(filas[1:], start=2):
        if not any(row):
            continue
        try:
            codigo = None
            nombre = None
            precio_costo = Decimal("0")
            precio_venta = Decimal("0")
            iva_pct = Decimal("0")
            stock_actual = Decimal("0")
            stock_minimo = Decimal("0")
            categoria_nombre = "General"
            laboratorio = ""
            principio_activo = ""
            ubicacion = ""
            codigo_barras = None
            descripcion = ""
            maneja_fracciones = False
            contenido_caja = 1
            contenido_blister = 0
            precio_caja = Decimal("0")
            precio_blister = Decimal("0")
            precio_unidad = Decimal("0")

            if es_maestro:
                # Mapeo según REPORTE MAESTRO POR PRODUCTO
                h_map = {h: idx for idx, h in enumerate(headers_clean)}
                codigo = str(row[h_map.get("cod producto", 0)] or "").strip()
                nombre = str(row[h_map.get("nombre", 1)] or "").strip()
                if not codigo or not nombre:
                    continue

                contenido_caja = int(row[h_map.get("contenido interno caja", 4)] or 1)
                contenido_blister = int(row[h_map.get("contenido interno blister", 5)] or 0)
                contenido_unidad = int(row[h_map.get("contenido interno unidad", 6)] or 1)
                
                costo_raw = row[h_map.get("costo", 8)] or 0
                precio_costo = Decimal(str(costo_raw)).quantize(Decimal("0.01"))

                p_caja_raw = row[h_map.get("valor caja contado", 12)] or 0
                p_blis_raw = row[h_map.get("valor blister contado", 13)] or 0
                p_unid_raw = row[h_map.get("valor unidad contado", 14)] or 0

                precio_caja = Decimal(str(p_caja_raw)).quantize(Decimal("0.01"))
                precio_blister = Decimal(str(p_blis_raw)).quantize(Decimal("0.01"))
                precio_unidad = Decimal(str(p_unid_raw)).quantize(Decimal("0.01"))

                if contenido_caja > 1 or contenido_blister > 0:
                    maneja_fracciones = True
                    precio_venta = precio_caja if precio_caja > 0 else precio_unidad
                else:
                    precio_venta = precio_caja if precio_caja > 0 else Decimal("0")

                # Stocks
                stk_caja = Decimal(str(row[h_map.get("inventario caja", 35)] or 0))
                stk_blis = Decimal(str(row[h_map.get("inventario blister", 36)] or 0))
                stk_unid = Decimal(str(row[h_map.get("inventario unidad", 37)] or 0))

                # Cálculo de unidades mínimas totales
                if maneja_fracciones:
                    unidades_por_blister = Decimal(str(contenido_unidad if contenido_unidad > 0 else (contenido_caja / contenido_blister if contenido_blister > 0 else 1)))
                    stock_actual = (stk_caja * Decimal(contenido_caja)) + (stk_blis * unidades_por_blister) + stk_unid
                else:
                    stock_actual = stk_caja

                categoria_nombre = str(row[h_map.get("grupo i", 23)] or "Medicamentos").strip()
                laboratorio = str(row[h_map.get("grupo ii", 24)] or "").strip()
                principio_activo = str(row[h_map.get("componente", 58)] or "").strip()

            elif es_ferreteria:
                # Formato Ferretería: Tipo, Código, Nombre, Precios
                codigo = str(row[1] or "").strip()
                nombre = str(row[2] or "").strip()
                p_raw = row[3] or 0
                precio_venta = Decimal(str(p_raw)).quantize(Decimal("0.01"))
                categoria_nombre = "Ferretería"

            else:
                # Formato estándar o plantilla
                h_map = {h: idx for idx, h in enumerate(headers_clean)}
                codigo = str(row[h_map.get("codigo", 0)] or "").strip()
                nombre = str(row[h_map.get("nombre", 2 if len(row) > 2 else 1)] or "").strip()
                if not codigo or not nombre:
                    continue
                
                codigo_barras = str(row[h_map.get("codigo_barras", 1)] or "").strip() or None
                categoria_nombre = str(row[h_map.get("categoria", 3)] or "General").strip()
                precio_costo = Decimal(str(row[h_map.get("precio_costo", 5)] or 0)).quantize(Decimal("0.01"))
                precio_venta = Decimal(str(row[h_map.get("precio_venta", 6)] or 0)).quantize(Decimal("0.01"))
                iva_pct = Decimal(str(row[h_map.get("iva_porcentaje", 7)] or 0)).quantize(Decimal("0.01"))
                stock_actual = Decimal(str(row[h_map.get("stock_actual", 8)] or 0)).quantize(Decimal("0.001"))
                stock_minimo = Decimal(str(row[h_map.get("stock_minimo", 9)] or 0)).quantize(Decimal("0.001"))

                frac_raw = str(row[h_map.get("maneja_fracciones_si_no", 10)] or "").upper()
                maneja_fracciones = frac_raw in ["SI", "S", "TRUE", "1"]
                if maneja_fracciones:
                    contenido_caja = int(row[h_map.get("contenido_caja", 11)] or 1)
                    contenido_blister = int(row[h_map.get("contenido_blister", 12)] or 0)
                    precio_caja = Decimal(str(row[h_map.get("precio_caja", 13)] or 0)).quantize(Decimal("0.01"))
                    precio_blister = Decimal(str(row[h_map.get("precio_blister", 14)] or 0)).quantize(Decimal("0.01"))
                    precio_unidad = Decimal(str(row[h_map.get("precio_unidad", 15)] or 0)).quantize(Decimal("0.01"))
                
                laboratorio = str(row[h_map.get("laboratorio_marca", 16)] or "").strip()
                principio_activo = str(row[h_map.get("principio_activo", 17)] or "").strip()
                ubicacion = str(row[h_map.get("ubicacion", 18)] or "").strip()

            if not codigo or not nombre:
                continue

            # Auto-crear categoría si no existe
            cat_id = None
            if categoria_nombre:
                cat_key = categoria_nombre.lower()
                if cat_key not in categorias_map:
                    nueva_cat = Categoria(nombre=categoria_nombre)
                    db.add(nueva_cat)
                    await db.flush()
                    categorias_map[cat_key] = nueva_cat.id
                cat_id = categorias_map[cat_key]

            # Buscar si ya existe el producto
            res_prod = await db.execute(select(Producto).where(Producto.codigo == codigo))
            prod = res_prod.scalar_one_or_none()

            if prod:
                prod.nombre = nombre
                prod.precio_venta = precio_venta
                prod.precio_costo = precio_costo
                prod.iva_porcentaje = iva_pct
                prod.stock_actual = stock_actual
                prod.stock_minimo = stock_minimo
                prod.categoria_id = cat_id
                prod.maneja_fracciones = maneja_fracciones
                prod.contenido_caja = contenido_caja
                prod.contenido_blister = contenido_blister
                prod.precio_caja = precio_caja
                prod.precio_blister = precio_blister
                prod.precio_unidad = precio_unidad
                prod.laboratorio = laboratorio or prod.laboratorio
                prod.principio_activo = principio_activo or prod.principio_activo
                prod.ubicacion = ubicacion or prod.ubicacion
                prod.activo = True
                actualizados += 1
            else:
                nuevo_prod = Producto(
                    codigo=codigo,
                    codigo_barras=codigo_barras,
                    nombre=nombre,
                    descripcion=descripcion,
                    categoria_id=cat_id,
                    unidad_medida_id=1,
                    precio_venta=precio_venta,
                    precio_costo=precio_costo,
                    iva_porcentaje=iva_pct,
                    stock_actual=stock_actual,
                    stock_minimo=stock_minimo,
                    afecta_inventario=True,
                    es_servicio=False,
                    activo=True,
                    maneja_fracciones=maneja_fracciones,
                    contenido_caja=contenido_caja,
                    contenido_blister=contenido_blister,
                    precio_caja=precio_caja,
                    precio_blister=precio_blister,
                    precio_unidad=precio_unidad,
                    laboratorio=laboratorio,
                    principio_activo=principio_activo,
                    ubicacion=ubicacion,
                )
                db.add(nuevo_prod)
                creados += 1

            if (creados + actualizados) % 100 == 0:
                await db.flush()

        except Exception as e:
            errores.append(f"Fila {i}: {str(e)}")

    await db.commit()

    return {
        "mensaje": f"Importación completada: {creados} creados, {actualizados} actualizados.",
        "creados": creados,
        "actualizados": actualizados,
        "total_procesados": creados + actualizados,
        "errores": errores[:20],
    }

import io
import csv
import unicodedata
from decimal import Decimal
from typing import List, Dict, Any, Tuple
import openpyxl
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.producto import Producto, Categoria, UnidadMedida

def _normalizar_texto(texto: Any) -> str:
    if texto is None:
        return ""
    s = str(texto).strip().lower()
    # Quitar tildes
    return ''.join(
        c for c in unicodedata.normalize('NFD', s)
        if unicodedata.category(c) != 'Mn'
    )

def _parse_decimal(val: Any, default: Decimal = Decimal("0")) -> Decimal:
    if val is None or val == "":
        return default
    try:
        s = str(val).strip().replace("$", "").replace(" ", "")
        # Manejo de comas/puntos colombianos
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s and "." not in s:
            s = s.replace(",", ".")
        return Decimal(s).quantize(Decimal("0.01"))
    except Exception:
        return default

def _parse_int(val: Any, default: int = 0) -> int:
    if val is None or val == "":
        return default
    try:
        f = float(str(val).strip())
        return int(f)
    except Exception:
        return default

async def procesar_archivo_inventario(contenido: bytes, nombre_archivo: str, db: AsyncSession) -> Dict[str, Any]:
    nombre_archivo = nombre_archivo.lower()
    filas_crudas = []

    if nombre_archivo.endswith(".xlsx") or nombre_archivo.endswith(".xls"):
        wb = openpyxl.load_workbook(io.BytesIO(contenido), read_only=True, data_only=True)
        ws = wb.active
        for row in ws.iter_rows(values_only=True):
            if any(c is not None and str(c).strip() != "" for c in row):
                filas_crudas.append(list(row))
        wb.close()
    elif nombre_archivo.endswith(".csv"):
        texto = contenido.decode("utf-8-sig", errors="replace")
        lector = csv.reader(io.StringIO(texto))
        for row in lector:
            if any(c.strip() != "" for c in row):
                filas_crudas.append(row)
    else:
        raise ValueError("Formato no soportado. Suba archivo .xlsx, .xls o .csv")

    if not filas_crudas:
        raise ValueError("El archivo está vacío")

    # 1. Encontrar la fila de encabezados dinámicamente
    header_idx = -1
    headers_norm = []
    
    for idx, row in enumerate(filas_crudas[:10]):
        row_norm = [_normalizar_texto(c) for c in row]
        # Verificar si parece encabezado
        tiene_cod = any(k in h for h in row_norm for k in ["codigo", "cod producto", "cod_producto", "ref", "referencia"])
        tiene_nom = any(k in h for h in row_norm for k in ["nombre", "descripcion", "articulo", "producto"])
        if tiene_cod or (tiene_nom and any(k in h for h in row_norm for k in ["precio", "precios", "costo", "stock"])):
            header_idx = idx
            headers_norm = row_norm
            break

    if header_idx == -1:
        # Asumir primera fila
        header_idx = 0
        headers_norm = [_normalizar_texto(c) for c in filas_crudas[0]]

    data_rows = filas_crudas[header_idx + 1:]
    if not data_rows:
        raise ValueError("No se encontraron filas de productos después del encabezado")

    # Detectar tipo de formato
    es_maestro_drogueria = any("contenido interno caja" in h or "contenido_interno_caja" in h for h in headers_norm)
    es_ferreteria = not es_maestro_drogueria and ("precios" in headers_norm or "tipo" in headers_norm)

    h_map = {h: idx for idx, h in enumerate(headers_norm) if h}

    # 2. Cargar categorías existentes y auto-crear las que falten
    res_cats = await db.execute(select(Categoria))
    categorias_map = {_normalizar_texto(c.nombre): c.id for c in res_cats.scalars().all()}
    if not categorias_map:
        cat_def = Categoria(nombre="General", activo=True)
        db.add(cat_def)
        await db.commit()
        await db.refresh(cat_def)
        categorias_map["general"] = cat_def.id

    # Obtener o crear Unidad de Medida por defecto con ID real
    res_und = await db.execute(select(UnidadMedida).order_by(UnidadMedida.id))
    und_objs = res_und.scalars().all()
    if not und_objs:
        und_def = UnidadMedida(nombre="Unidad", abreviatura="UND", activo=True)
        db.add(und_def)
        await db.commit()
        await db.refresh(und_def)
        default_und_id = und_def.id
    else:
        und_match = next((u for u in und_objs if _normalizar_texto(u.nombre) == "unidad"), und_objs[0])
        default_und_id = und_match.id

    # Extraer categorías únicas del archivo
    nuevas_cats = set()
    for row in data_rows:
        cat_nom = ""
        if es_maestro_drogueria:
            cat_nom = str(row[h_map.get("grupo i", 23)] if h_map.get("grupo i") is not None and len(row) > h_map["grupo i"] else "Medicamentos").strip()
        elif es_ferreteria:
            cat_nom = "Ferretería"
        else:
            cat_idx = h_map.get("categoria", h_map.get("categoria_nombre", 3))
            if cat_idx is not None and len(row) > cat_idx and row[cat_idx]:
                cat_nom = str(row[cat_idx]).strip()

        if cat_nom and _normalizar_texto(cat_nom) not in categorias_map:
            nuevas_cats.add(cat_nom)

    for c_nom in nuevas_cats:
        cat_inst = Categoria(nombre=c_nom)
        db.add(cat_inst)
    if nuevas_cats:
        await db.commit()
        # Recargar mapa
        res_cats = await db.execute(select(Categoria))
        categorias_map = {_normalizar_texto(c.nombre): c.id for c in res_cats.scalars().all()}

    # 3. Parsear todos los productos en una lista de diccionarios
    productos_a_procesar: List[Dict[str, Any]] = []
    codigos_vistos = set()

    for i, row in enumerate(data_rows, start=header_idx + 2):
        if not any(row):
            continue

        try:
            codigo = None
            nombre = None
            precio_costo = Decimal("0")
            precio_venta = Decimal("0")
            iva_pct = Decimal("0")
            stock_actual = Decimal("0")
            stock_minimo = Decimal("5")
            cat_id = None
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

            codigo_barras = None
            codigo_barras_blister = None
            codigo_barras_unidad = None

            if es_maestro_drogueria:
                idx_cod = h_map.get("cod producto", 0)
                idx_nom = h_map.get("nombre", 1)
                codigo = str(row[idx_cod] or "").strip()
                nombre = str(row[idx_nom] or "").strip()
                if not codigo or not nombre:
                    continue

                # Códigos de barra si vienen en el archivo
                idx_bar = h_map.get("codigo barras", h_map.get("codigo_barras", h_map.get("barra", -1)))
                if idx_bar != -1 and len(row) > idx_bar and row[idx_bar]:
                    codigo_barras = str(row[idx_bar]).strip() or None

                idx_bar_blis = h_map.get("codigo barras blister", h_map.get("codigo_barras_blister", h_map.get("barra_blister", -1)))
                if idx_bar_blis != -1 and len(row) > idx_bar_blis and row[idx_bar_blis]:
                    codigo_barras_blister = str(row[idx_bar_blis]).strip() or None

                idx_bar_unid = h_map.get("codigo barras unidad", h_map.get("codigo_barras_unidad", h_map.get("barra_unidad", -1)))
                if idx_bar_unid != -1 and len(row) > idx_bar_unid and row[idx_bar_unid]:
                    codigo_barras_unidad = str(row[idx_bar_unid]).strip() or None

                contenido_caja = _parse_int(row[h_map.get("contenido interno caja", 4)] if len(row) > 4 else 1, default=1)
                contenido_blister = _parse_int(row[h_map.get("contenido interno blister", 5)] if len(row) > 5 else 0, default=0)
                contenido_unidad = _parse_int(row[h_map.get("contenido interno unidad", 6)] if len(row) > 6 else 1, default=1)

                precio_costo = _parse_decimal(row[h_map.get("costo", 8)] if len(row) > 8 else 0)
                precio_caja = _parse_decimal(row[h_map.get("valor caja contado", 12)] if len(row) > 12 else 0)
                precio_blister = _parse_decimal(row[h_map.get("valor blister contado", 13)] if len(row) > 13 else 0)
                precio_unidad = _parse_decimal(row[h_map.get("valor unidad contado", 14)] if len(row) > 14 else 0)

                if contenido_caja > 1 or contenido_blister > 0:
                    maneja_fracciones = True
                    precio_venta = precio_caja if precio_caja > 0 else (precio_unidad if precio_unidad > 0 else Decimal("0"))
                else:
                    precio_venta = precio_caja if precio_caja > 0 else Decimal("0")

                stk_caja = _parse_decimal(row[h_map.get("inventario caja", 35)] if len(row) > 35 else 0)
                stk_blis = _parse_decimal(row[h_map.get("inventario blister", 36)] if len(row) > 36 else 0)
                stk_unid = _parse_decimal(row[h_map.get("inventario unidad", 37)] if len(row) > 37 else 0)

                if maneja_fracciones:
                    unids_blister = Decimal(contenido_unidad if contenido_unidad > 0 else (contenido_caja / contenido_blister if contenido_blister > 0 else 1))
                    stock_actual = (stk_caja * Decimal(contenido_caja)) + (stk_blis * unids_blister) + stk_unid
                else:
                    stock_actual = stk_caja

                cat_raw = str(row[h_map.get("grupo i", 23)] if len(row) > 23 else "Medicamentos").strip()
                cat_id = categorias_map.get(_normalizar_texto(cat_raw))
                laboratorio = str(row[h_map.get("grupo ii", 24)] if len(row) > 24 else "").strip()
                principio_activo = str(row[h_map.get("componente", 58)] if len(row) > 58 else "").strip()

            elif es_ferreteria:
                idx_cod = h_map.get("codigo", h_map.get("codigo", 1))
                idx_nom = h_map.get("nombre", 2)
                idx_pre = h_map.get("precios", h_map.get("precio", 3))

                codigo = str(row[idx_cod] or "").strip()
                nombre = str(row[idx_nom] or "").strip()
                if not codigo or not nombre:
                    continue

                idx_bar = h_map.get("codigo_barras", h_map.get("codigo barras", h_map.get("barra", -1)))
                if idx_bar != -1 and len(row) > idx_bar and row[idx_bar]:
                    codigo_barras = str(row[idx_bar]).strip() or None

                precio_venta = _parse_decimal(row[idx_pre] if len(row) > idx_pre else 0)
                cat_id = categorias_map.get("ferreteria")

            else:
                # Formato estándar o plantilla
                idx_cod = h_map.get("codigo", 0)
                idx_nom = h_map.get("nombre", 2 if len(row) > 2 else 1)
                codigo = str(row[idx_cod] or "").strip()
                nombre = str(row[idx_nom] or "").strip()
                if not codigo or not nombre:
                    continue

                codigo_barras = str(row[h_map.get("codigo_barras", 1)] or "").strip() or None
                idx_bar_blis = h_map.get("codigo_barras_blister", -1)
                if idx_bar_blis != -1 and len(row) > idx_bar_blis and row[idx_bar_blis]:
                    codigo_barras_blister = str(row[idx_bar_blis]).strip() or None
                idx_bar_unid = h_map.get("codigo_barras_unidad", -1)
                if idx_bar_unid != -1 and len(row) > idx_bar_unid and row[idx_bar_unid]:
                    codigo_barras_unidad = str(row[idx_bar_unid]).strip() or None

                cat_raw = str(row[h_map.get("categoria", 3)] or "General").strip()
                cat_id = categorias_map.get(_normalizar_texto(cat_raw))

                precio_costo = _parse_decimal(row[h_map.get("precio_costo", 5)] if len(row) > 5 else 0)
                precio_venta = _parse_decimal(row[h_map.get("precio_venta", 6)] if len(row) > 6 else 0)
                iva_pct = _parse_decimal(row[h_map.get("iva_porcentaje", 7)] if len(row) > 7 else 0)
                stock_actual = _parse_decimal(row[h_map.get("stock_actual", 8)] if len(row) > 8 else 0)
                stock_minimo = _parse_decimal(row[h_map.get("stock_minimo", 9)] if len(row) > 9 else 5)

                frac_raw = _normalizar_texto(row[h_map.get("maneja_fracciones_si_no", 10)] if len(row) > 10 else "")
                maneja_fracciones = frac_raw in ["si", "s", "true", "1"]
                if maneja_fracciones:
                    contenido_caja = _parse_int(row[h_map.get("contenido_caja", 11)] if len(row) > 11 else 1, default=1)
                    contenido_blister = _parse_int(row[h_map.get("contenido_blister", 12)] if len(row) > 12 else 0, default=0)
                    precio_caja = _parse_decimal(row[h_map.get("precio_caja", 13)] if len(row) > 13 else 0)
                    precio_blister = _parse_decimal(row[h_map.get("precio_blister", 14)] if len(row) > 14 else 0)
                    precio_unidad = _parse_decimal(row[h_map.get("precio_unidad", 15)] if len(row) > 15 else 0)

                laboratorio = str(row[h_map.get("laboratorio_marca", 16)] if len(row) > 16 else "").strip()
                principio_activo = str(row[h_map.get("principio_activo", 17)] if len(row) > 17 else "").strip()
                ubicacion = str(row[h_map.get("ubicacion", 18)] if len(row) > 18 else "").strip()

            if not codigo or not nombre:
                continue

            # Evitar duplicados dentro del mismo archivo
            if codigo in codigos_vistos:
                continue
            codigos_vistos.add(codigo)

            productos_a_procesar.append({
                "codigo": codigo,
                "codigo_barras": codigo_barras,
                "codigo_barras_blister": codigo_barras_blister,
                "codigo_barras_unidad": codigo_barras_unidad,
                "nombre": nombre,
                "descripcion": descripcion or None,
                "categoria_id": cat_id,
                "unidad_medida_id": default_und_id,
                "precio_venta": precio_venta,
                "precio_costo": precio_costo,
                "iva_porcentaje": iva_pct,
                "stock_actual": stock_actual,
                "stock_minimo": stock_minimo,
                "afecta_inventario": True,
                "es_servicio": False,
                "activo": True,
                "maneja_fracciones": maneja_fracciones,
                "contenido_caja": contenido_caja,
                "contenido_blister": contenido_blister,
                "precio_caja": precio_caja,
                "precio_blister": precio_blister,
                "precio_unidad": precio_unidad,
                "laboratorio": laboratorio or None,
                "principio_activo": principio_activo or None,
                "ubicacion": ubicacion or None,
            })

        except Exception:
            continue

    if not productos_a_procesar:
        raise ValueError("No se pudieron extraer productos válidos del archivo")

    # 4. Upsert Masivo de alto rendimiento en bloques de 500
    chunk_size = 500
    total_procesados = len(productos_a_procesar)

    for idx in range(0, total_procesados, chunk_size):
        chunk = productos_a_procesar[idx:idx + chunk_size]
        stmt = pg_insert(Producto).values(chunk)
        stmt = stmt.on_conflict_do_update(
            index_elements=['codigo'],
            set_={
                'nombre': stmt.excluded.nombre,
                'codigo_barras': func.coalesce(stmt.excluded.codigo_barras, Producto.codigo_barras),
                'codigo_barras_blister': func.coalesce(stmt.excluded.codigo_barras_blister, Producto.codigo_barras_blister),
                'codigo_barras_unidad': func.coalesce(stmt.excluded.codigo_barras_unidad, Producto.codigo_barras_unidad),
                'categoria_id': func.coalesce(stmt.excluded.categoria_id, Producto.categoria_id),
                'precio_venta': stmt.excluded.precio_venta,
                'precio_costo': stmt.excluded.precio_costo,
                'iva_porcentaje': stmt.excluded.iva_porcentaje,
                'stock_actual': stmt.excluded.stock_actual,
                'stock_minimo': stmt.excluded.stock_minimo,
                'maneja_fracciones': stmt.excluded.maneja_fracciones,
                'contenido_caja': stmt.excluded.contenido_caja,
                'contenido_blister': stmt.excluded.contenido_blister,
                'precio_caja': stmt.excluded.precio_caja,
                'precio_blister': stmt.excluded.precio_blister,
                'precio_unidad': stmt.excluded.precio_unidad,
                'laboratorio': func.coalesce(stmt.excluded.laboratorio, Producto.laboratorio),
                'principio_activo': func.coalesce(stmt.excluded.principio_activo, Producto.principio_activo),
                'ubicacion': func.coalesce(stmt.excluded.ubicacion, Producto.ubicacion),
                'activo': True,
            }
        )
        await db.execute(stmt)
        await db.commit()

    return {
        "mensaje": f"¡Éxito! Se procesaron {total_procesados} productos correctamente.",
        "total_procesados": total_procesados,
        "creados": total_procesados,
        "actualizados": 0,
    }

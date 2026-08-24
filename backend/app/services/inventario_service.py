import io
import math
import unicodedata
from decimal import Decimal
from datetime import datetime
from typing import Optional, List, Dict, Any
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import joinedload

from app.models.producto import Producto, Categoria
from app.models.configuracion import ConfiguracionEmpresa

def _normalizar(texto: Any) -> str:
    if texto is None:
        return ""
    s = str(texto).strip().lower()
    return ''.join(
        c for c in unicodedata.normalize('NFD', s)
        if unicodedata.category(c) != 'Mn'
    )

async def generar_excel_inventario_fisico(
    db: AsyncSession,
    categoria_id: Optional[int] = None,
    q: Optional[str] = None,
    solo_con_stock: bool = False,
) -> io.BytesIO:
    res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
    cfg = res_cfg.scalar_one_or_none()
    rubro = (cfg.rubro if cfg and cfg.rubro else "FARMACIA").upper()
    nombre_empresa = cfg.nombre if cfg and cfg.nombre else "SistemaVentas"

    stmt = (
        select(Producto)
        .options(joinedload(Producto.categoria), joinedload(Producto.unidad_medida))
        .where(Producto.activo == True)
    )
    if categoria_id:
        stmt = stmt.where(Producto.categoria_id == categoria_id)
    if q and q.strip():
        stmt = stmt.where(
            or_(
                Producto.nombre.ilike(f"%{q.strip()}%"),
                Producto.codigo.ilike(f"%{q.strip()}%"),
                Producto.codigo_barras.ilike(f"%{q.strip()}%"),
                Producto.codigo_barras_blister.ilike(f"%{q.strip()}%"),
                Producto.codigo_barras_unidad.ilike(f"%{q.strip()}%"),
                Producto.principio_activo.ilike(f"%{q.strip()}%"),
            )
        )
    if solo_con_stock:
        stmt = stmt.where(Producto.stock_actual > 0)

    stmt = stmt.order_by(Producto.categoria_id, Producto.nombre)
    result = await db.execute(stmt)
    productos = result.scalars().unique().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Inventario Fisico"

    font_titulo = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    font_subtitulo = Font(name="Calibri", size=10, italic=True, color="E2E8F0")
    font_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    font_data = Font(name="Calibri", size=10)
    font_conteo = Font(name="Calibri", size=10, bold=True, color="1E3A8A")

    fill_header_main = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    fill_header_conteo = PatternFill(start_color="F59E0B", end_color="F59E0B", fill_type="solid")
    fill_header_desfase = PatternFill(start_color="DC2626", end_color="DC2626", fill_type="solid")
    fill_conteo_cell = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    fill_zebra = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )
    thick_conteo_border = Border(
        left=Side(style="medium", color="D97706"),
        right=Side(style="medium", color="D97706"),
        top=Side(style="thin", color="D97706"),
        bottom=Side(style="thin", color="D97706"),
    )

    align_center = Alignment(horizontal="center", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")

    ws.merge_cells("A1:M1")
    title_cell = ws["A1"]
    title_cell.value = f"HOJA DE TOMA DE INVENTARIO FÍSICO — {nombre_empresa.upper()}"
    title_cell.font = font_titulo
    title_cell.fill = fill_header_main
    title_cell.alignment = align_center

    ws.merge_cells("A2:M2")
    sub_cell = ws["A2"]
    fecha_hoy = datetime.now().strftime("%Y-%m-%d %H:%M")
    sub_cell.value = f"Generado: {fecha_hoy} · Rubro: {rubro} · Total Productos: {len(productos)} · Diligencie el conteo físico en las columnas amarillas"
    sub_cell.font = font_subtitulo
    sub_cell.fill = fill_header_main
    sub_cell.alignment = align_center

    ws.row_dimensions[1].height = 28
    ws.row_dimensions[2].height = 20
    ws.row_dimensions[3].height = 10

    if rubro == "FARMACIA":
        headers = [
            ("ID", "left", fill_header_main),
            ("CODIGO", "left", fill_header_main),
            ("COD_BARRAS_CAJA", "left", fill_header_main),
            ("COD_BARRAS_BLISTER", "left", fill_header_main),
            ("COD_BARRAS_UNIDAD", "left", fill_header_main),
            ("NOMBRE_COMERCIAL", "left", fill_header_main),
            ("CATEGORIA", "left", fill_header_main),
            ("LABORATORIO", "left", fill_header_main),
            ("PRINCIPIO_ACTIVO", "left", fill_header_main),
            ("UBICACION", "left", fill_header_main),
            ("FRACCION", "center", fill_header_main),
            ("STOCK_DIGITAL_TOTAL", "right", fill_header_main),
            ("CONTEO_CAJAS", "center", fill_header_conteo),
            ("CONTEO_BLISTERS", "center", fill_header_conteo),
            ("CONTEO_UNIDADES", "center", fill_header_conteo),
            ("TOTAL_FISICO", "right", fill_header_conteo),
            ("DESFASE", "right", fill_header_desfase),
            ("COSTO_UNIT", "right", fill_header_main),
            ("PRECIO_VENTA", "right", fill_header_main),
        ]
    else:
        headers = [
            ("ID", "left", fill_header_main),
            ("CODIGO", "left", fill_header_main),
            ("COD_BARRAS", "left", fill_header_main),
            ("NOMBRE_PRODUCTO", "left", fill_header_main),
            ("CATEGORIA", "left", fill_header_main),
            ("UBICACION", "left", fill_header_main),
            ("STOCK_DIGITAL", "right", fill_header_main),
            ("CONTEO_FISICO", "center", fill_header_conteo),
            ("DESFASE", "right", fill_header_desfase),
            ("COSTO_UNIT", "right", fill_header_main),
            ("PRECIO_VENTA", "right", fill_header_main),
        ]

    header_row = 4
    ws.row_dimensions[header_row].height = 24

    for col_idx, (h_title, align, fill_color) in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col_idx)
        cell.value = h_title
        cell.font = font_header
        cell.fill = fill_color
        cell.alignment = align_center
        cell.border = thin_border

    for r_idx, p in enumerate(productos, start=5):
        ws.row_dimensions[r_idx].height = 20
        cat_nom = p.categoria.nombre if p.categoria else ""
        stock_num = float(p.stock_actual or 0)
        costo_num = float(p.precio_costo or 0)
        venta_num = float(p.precio_venta or 0)

        is_even = (r_idx % 2 == 0)
        row_fill = fill_zebra if is_even else PatternFill(fill_type=None)

        if rubro == "FARMACIA":
            c_caja = int(p.contenido_caja or 1)
            c_blister = int(p.contenido_blister or 0)
            unids_blister = int(c_caja / c_blister) if c_blister > 0 else 0
            frac_str = f"Caja x{c_caja}" if p.maneja_fracciones else "No"

            # Columnas: M=Conteo Cajas, N=Conteo Blisters, O=Conteo Unids, P=Total Fisico, Q=Desfase, L=Stock Digital
            formula_total = f"=IF(AND(M{r_idx}=\"\",N{r_idx}=\"\",O{r_idx}=\"\"),\"\",(IF(ISBLANK(M{r_idx}),0,M{r_idx})*{c_caja})+(IF(ISBLANK(N{r_idx}),0,N{r_idx})*{unids_blister})+(IF(ISBLANK(O{r_idx}),0,O{r_idx})))"
            formula_desfase = f"=IF(P{r_idx}=\"\",\"\",P{r_idx}-L{r_idx})"

            row_data = [
                (p.id, align_left, row_fill, thin_border, None),
                (p.codigo, align_left, row_fill, thin_border, None),
                (p.codigo_barras or "", align_left, row_fill, thin_border, None),
                (p.codigo_barras_blister or "", align_left, row_fill, thin_border, None),
                (p.codigo_barras_unidad or "", align_left, row_fill, thin_border, None),
                (p.nombre, align_left, row_fill, thin_border, None),
                (cat_nom, align_left, row_fill, thin_border, None),
                (p.laboratorio or "", align_left, row_fill, thin_border, None),
                (p.principio_activo or "", align_left, row_fill, thin_border, None),
                (p.ubicacion or "", align_left, row_fill, thin_border, None),
                (frac_str, align_center, row_fill, thin_border, None),
                (stock_num, align_right, row_fill, thin_border, "#,##0"),
                ("", align_center, fill_conteo_cell, thick_conteo_border, "#,##0"),
                ("", align_center, fill_conteo_cell, thick_conteo_border, "#,##0"),
                ("", align_center, fill_conteo_cell, thick_conteo_border, "#,##0"),
                (formula_total, align_right, row_fill, thin_border, "#,##0"),
                (formula_desfase, align_right, row_fill, thin_border, "+#,##0;-#,##0;0"),
                (costo_num, align_right, row_fill, thin_border, "$#,##0"),
                (venta_num, align_right, row_fill, thin_border, "$#,##0"),
            ]
        else:
            formula_desfase = f"=IF(H{r_idx}=\"\",\"\",H{r_idx}-G{r_idx})"

            row_data = [
                (p.id, align_left, row_fill, thin_border, None),
                (p.codigo, align_left, row_fill, thin_border, None),
                (p.codigo_barras or "", align_left, row_fill, thin_border, None),
                (p.nombre, align_left, row_fill, thin_border, None),
                (cat_nom, align_left, row_fill, thin_border, None),
                (p.ubicacion or "", align_left, row_fill, thin_border, None),
                (stock_num, align_right, row_fill, thin_border, "#,##0"),
                ("", align_center, fill_conteo_cell, thick_conteo_border, "#,##0"),
                (formula_desfase, align_right, row_fill, thin_border, "+#,##0;-#,##0;0"),
                (costo_num, align_right, row_fill, thin_border, "$#,##0"),
                (venta_num, align_right, row_fill, thin_border, "$#,##0"),
            ]

        for col_idx, (val, alignment, cell_fill, cell_border, num_format) in enumerate(row_data, 1):
            cell = ws.cell(row=r_idx, column=col_idx)
            cell.value = val
            cell.font = font_conteo if cell_fill == fill_conteo_cell else font_data
            if cell_fill:
                cell.fill = cell_fill
            cell.alignment = alignment
            cell.border = cell_border
            if num_format:
                cell.number_format = num_format

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.row in [1, 2]:
                continue
            v_str = str(cell.value or "")
            if cell.number_format and "$" in cell.number_format:
                v_str += "    "
            if len(v_str) > max_len:
                max_len = len(v_str)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    ws.freeze_panes = "F5"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output

async def procesar_ajuste_inventario_fisico(
    contenido_bytes: bytes,
    db: AsyncSession
) -> Dict[str, Any]:
    wb = openpyxl.load_workbook(filename=io.BytesIO(contenido_bytes), data_only=True)
    ws = wb.active

    header_row_idx = None
    headers_map = {}

    for row_idx in range(1, 10):
        row_vals = [_normalizar(ws.cell(row=row_idx, column=c).value) for c in range(1, ws.max_column + 1)]
        if any(k in row_vals for k in ["codigo", "id", "cod", "nombre_comercial", "nombre_producto", "nombre"]):
            header_row_idx = row_idx
            for c_idx, val in enumerate(row_vals, 1):
                if val:
                    headers_map[val] = c_idx
            break

    if not header_row_idx:
        raise ValueError("No se encontró la fila de encabezados en el archivo Excel de conteo físico.")

    col_id = headers_map.get("id") or headers_map.get("id_sistema")
    col_codigo = headers_map.get("codigo") or headers_map.get("cod") or headers_map.get("cod_producto") or headers_map.get("ref")
    col_nombre = headers_map.get("nombre_comercial") or headers_map.get("nombre_producto") or headers_map.get("nombre")

    col_barras_caja = headers_map.get("cod_barras_caja") or headers_map.get("cod_barras") or headers_map.get("codigo_barras") or headers_map.get("barra")
    col_barras_blister = headers_map.get("cod_barras_blister") or headers_map.get("codigo_barras_blister") or headers_map.get("barra_blister")
    col_barras_unidad = headers_map.get("cod_barras_unidad") or headers_map.get("codigo_barras_unidad") or headers_map.get("barra_unidad")

    col_conteo_fisico = headers_map.get("conteo_fisico") or headers_map.get("fisico")
    col_conteo_cajas = headers_map.get("conteo_cajas")
    col_conteo_blisters = headers_map.get("conteo_blisters")
    col_conteo_unidades = headers_map.get("conteo_unidades")
    col_total_fisico = headers_map.get("total_fisico")

    if not col_id and not col_codigo and not col_nombre:
        raise ValueError("El archivo debe contener al menos la columna 'ID', 'CODIGO' o 'NOMBRE' del producto.")

    stmt = select(Producto).options(joinedload(Producto.categoria), joinedload(Producto.unidad_medida)).where(Producto.activo == True)
    res = await db.execute(stmt)
    prods_all = res.scalars().unique().all()
    map_by_id = {p.id: p for p in prods_all}
    map_by_codigo = {p.codigo.strip().upper(): p for p in prods_all if p.codigo}
    map_by_nombre = {_normalizar(p.nombre): p for p in prods_all if p.nombre}

    total_leidos = 0
    total_ajustados = 0
    total_sin_cambio = 0
    barras_actualizadas_count = 0
    sobrantes_count = 0
    faltantes_count = 0
    impacto_total_costo = Decimal("0")
    desfases_detalle = []

    for r in range(header_row_idx + 1, ws.max_row + 1):
        id_val = ws.cell(row=r, column=col_id).value if col_id else None
        cod_val = str(ws.cell(row=r, column=col_codigo).value or "").strip().upper() if col_codigo else None
        nom_val = _normalizar(ws.cell(row=r, column=col_nombre).value) if col_nombre else None

        prod: Optional[Producto] = None
        if id_val is not None:
            try:
                prod = map_by_id.get(int(id_val))
            except:
                pass
        if not prod and cod_val:
            prod = map_by_codigo.get(cod_val)
        if not prod and nom_val:
            prod = map_by_nombre.get(nom_val)

        if not prod:
            continue

        # ── 1. ACTUALIZAR CÓDIGOS DE BARRA SI VIENEN EN EL EXCEL ────────
        modifico_barras = False
        if col_barras_caja:
            b_caja = str(ws.cell(row=r, column=col_barras_caja).value or "").strip()
            if b_caja and b_caja != "None" and b_caja != str(prod.codigo_barras or ""):
                prod.codigo_barras = b_caja
                modifico_barras = True

        if col_barras_blister:
            b_blis = str(ws.cell(row=r, column=col_barras_blister).value or "").strip()
            if b_blis and b_blis != "None" and b_blis != str(prod.codigo_barras_blister or ""):
                prod.codigo_barras_blister = b_blis
                modifico_barras = True

        if col_barras_unidad:
            b_unid = str(ws.cell(row=r, column=col_barras_unidad).value or "").strip()
            if b_unid and b_unid != "None" and b_unid != str(prod.codigo_barras_unidad or ""):
                prod.codigo_barras_unidad = b_unid
                modifico_barras = True

        if modifico_barras:
            barras_actualizadas_count += 1

        # ── 2. CALCULAR CONTEO FÍSICO Y DESFASE ────────────────────────
        conteo_final = None

        if col_total_fisico:
            v = ws.cell(row=r, column=col_total_fisico).value
            if v is not None and str(v).strip() != "":
                try:
                    conteo_final = Decimal(str(v).replace(",", "."))
                except:
                    pass

        if conteo_final is None and (col_conteo_cajas or col_conteo_blisters or col_conteo_unidades):
            val_cajas = ws.cell(row=r, column=col_conteo_cajas).value if col_conteo_cajas else None
            val_blisters = ws.cell(row=r, column=col_conteo_blisters).value if col_conteo_blisters else None
            val_unids = ws.cell(row=r, column=col_conteo_unidades).value if col_conteo_unidades else None

            if any(x is not None and str(x).strip() != "" for x in [val_cajas, val_blisters, val_unids]):
                cajas = Decimal(str(val_cajas or 0).replace(",", ".")) if val_cajas not in [None, ""] else Decimal("0")
                blisters = Decimal(str(val_blisters or 0).replace(",", ".")) if val_blisters not in [None, ""] else Decimal("0")
                unids = Decimal(str(val_unids or 0).replace(",", ".")) if val_unids not in [None, ""] else Decimal("0")

                c_caja = Decimal(str(prod.contenido_caja or 1))
                c_blister = Decimal(str(prod.contenido_blister or 0))
                unids_per_blister = (c_caja / c_blister) if c_blister > 0 else Decimal("0")

                conteo_final = (cajas * c_caja) + (blisters * unids_per_blister) + unids

        if conteo_final is None and col_conteo_fisico:
            v = ws.cell(row=r, column=col_conteo_fisico).value
            if v is not None and str(v).strip() != "":
                try:
                    conteo_final = Decimal(str(v).replace(",", "."))
                except:
                    pass

        if conteo_final is None:
            continue

        total_leidos += 1
        stock_anterior = Decimal(str(prod.stock_actual or 0))
        desfase = conteo_final - stock_anterior

        if desfase != Decimal("0"):
            costo_unit = Decimal(str(prod.precio_costo or 0))
            impacto_item = desfase * costo_unit
            impacto_total_costo += impacto_item

            if desfase > 0:
                sobrantes_count += 1
            else:
                faltantes_count += 1

            desfases_detalle.append({
                "id": prod.id,
                "codigo": prod.codigo,
                "nombre": prod.nombre,
                "categoria": prod.categoria.nombre if prod.categoria else "Sin categoría",
                "stock_digital": float(stock_anterior),
                "conteo_fisico": float(conteo_final),
                "desfase": float(desfase),
                "costo_unitario": float(costo_unit),
                "impacto_costo": float(impacto_item),
                "codigo_barras": prod.codigo_barras,
                "codigo_barras_blister": prod.codigo_barras_blister,
            })

            prod.stock_actual = conteo_final
            total_ajustados += 1
        else:
            total_sin_cambio += 1

    await db.commit()

    return {
        "total_contados": total_leidos,
        "total_ajustados": total_ajustados,
        "total_coincidentes": total_sin_cambio,
        "barras_actualizadas": barras_actualizadas_count,
        "sobrantes": sobrantes_count,
        "faltantes": faltantes_count,
        "impacto_total_costo": float(impacto_total_costo),
        "desfases": desfases_detalle,
    }
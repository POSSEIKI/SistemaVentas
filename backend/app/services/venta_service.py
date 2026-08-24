from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.factura import Factura, FacturaDetalle
from app.models.producto import Producto
from app.models.inventario import Compra, CompraDetalle, MovimientoInventario
from app.models.configuracion import ConfiguracionEmpresa
from app.schemas.ventas import FacturaCreate, CompraCreate

async def _siguiente_numero(db: AsyncSession, prefijo: str, modelo, campo) -> str:
    result = await db.execute(
        select(func.count()).select_from(modelo)
    )
    total = result.scalar() or 0
    return f"{prefijo}{str(total + 1).zfill(6)}"

async def crear_factura(datos: FacturaCreate, usuario_id: int, db: AsyncSession) -> Factura:
    # Obtener config para prefijo
    result = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
    config = result.scalar_one_or_none()
    prefijo = config.factura_prefijo if config else "FV"

    numero = await _siguiente_numero(db, prefijo, Factura, "numero")

    subtotal = Decimal("0")
    descuento_total = Decimal("0")
    iva_total = Decimal("0")
    lineas_db = []

    for linea in datos.lineas:
        result = await db.execute(select(Producto).where(Producto.id == linea.producto_id))
        producto = result.scalar_one_or_none()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {linea.producto_id} no encontrado")

        if producto.afecta_inventario and not producto.es_servicio:
            if producto.stock_actual < linea.cantidad:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para '{producto.nombre}'. Disponible: {producto.stock_actual}"
                )

        precio = linea.precio_unitario
        desc_pct = linea.descuento_porcentaje
        desc_val = (precio * linea.cantidad * desc_pct / 100).quantize(Decimal("0.01"))
        sub_linea = (precio * linea.cantidad - desc_val).quantize(Decimal("0.01"))
        iva_pct = producto.iva_porcentaje
        iva_val = (sub_linea * iva_pct / 100).quantize(Decimal("0.01"))
        total_linea = (sub_linea + iva_val).quantize(Decimal("0.01"))

        subtotal += sub_linea
        descuento_total += desc_val
        iva_total += iva_val

        lineas_db.append(FacturaDetalle(
            producto_id=linea.producto_id,
            cantidad=linea.cantidad,
            precio_unitario=precio,
            descuento_porcentaje=desc_pct,
            descuento_valor=desc_val,
            iva_porcentaje=iva_pct,
            iva_valor=iva_val,
            subtotal=sub_linea,
            total_linea=total_linea,
        ))

        # Actualizar stock
        if producto.afecta_inventario and not producto.es_servicio:
            stock_ant = producto.stock_actual
            producto.stock_actual = producto.stock_actual - linea.cantidad
            mov = MovimientoInventario(
                producto_id=producto.id,
                tipo="SALIDA",
                cantidad=linea.cantidad,
                stock_anterior=stock_ant,
                stock_nuevo=producto.stock_actual,
                referencia_tipo="FACTURA",
                usuario_id=usuario_id,
            )
            db.add(mov)

    total = (subtotal + iva_total + datos.domicilio_valor).quantize(Decimal("0.01"))
    cambio = max(Decimal("0"), datos.valor_recibido - total)

    factura = Factura(
        numero=numero,
        cliente_id=datos.cliente_id,
        usuario_id=usuario_id,
        subtotal=subtotal,
        descuento_valor=descuento_total,
        iva_valor=iva_total,
        domicilio_valor=datos.domicilio_valor,
        total=total,
        forma_pago=datos.forma_pago,
        valor_recibido=datos.valor_recibido,
        cambio=cambio,
        observaciones=datos.observaciones,
        lineas=lineas_db,
    )
    db.add(factura)
    await db.commit()
    await db.refresh(factura)
    return factura

async def anular_factura(factura_id: int, motivo: str, usuario_id: int, db: AsyncSession) -> Factura:
    result = await db.execute(select(Factura).where(Factura.id == factura_id))
    factura = result.scalar_one_or_none()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if factura.estado == "ANULADA":
        raise HTTPException(status_code=400, detail="La factura ya está anulada")

    from datetime import datetime, timezone
    factura.estado = "ANULADA"
    factura.anulada_por = usuario_id
    factura.anulada_en = datetime.now(timezone.utc)
    factura.motivo_anulacion = motivo

    # Revertir stock
    for linea in factura.lineas:
        result = await db.execute(select(Producto).where(Producto.id == linea.producto_id))
        producto = result.scalar_one_or_none()
        if producto and producto.afecta_inventario and not producto.es_servicio:
            stock_ant = producto.stock_actual
            producto.stock_actual = producto.stock_actual + linea.cantidad
            mov = MovimientoInventario(
                producto_id=producto.id,
                tipo="DEVOLUCION",
                cantidad=linea.cantidad,
                stock_anterior=stock_ant,
                stock_nuevo=producto.stock_actual,
                referencia_tipo="ANULACION",
                referencia_id=factura_id,
                usuario_id=usuario_id,
                observacion=f"Anulación factura {factura.numero}",
            )
            db.add(mov)

    await db.commit()
    await db.refresh(factura)
    return factura

async def crear_compra(datos: CompraCreate, usuario_id: int, db: AsyncSession) -> Compra:
    numero = await _siguiente_numero(db, "CO", Compra, "numero")
    subtotal = Decimal("0")
    iva_total = Decimal("0")
    lineas_db = []

    for linea in datos.lineas:
        result = await db.execute(select(Producto).where(Producto.id == linea.producto_id))
        producto = result.scalar_one_or_none()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {linea.producto_id} no encontrado")

        sub = (linea.cantidad * linea.costo_unitario).quantize(Decimal("0.01"))
        iva_val = (sub * linea.iva_porcentaje / 100).quantize(Decimal("0.01"))
        subtotal += sub
        iva_total += iva_val

        lineas_db.append(CompraDetalle(
            producto_id=linea.producto_id,
            cantidad=linea.cantidad,
            costo_unitario=linea.costo_unitario,
            iva_porcentaje=linea.iva_porcentaje,
            iva_valor=iva_val,
            subtotal=sub,
            precio_sugerido=linea.precio_sugerido,
        ))

        # Actualizar stock y costo
        if producto.afecta_inventario and not producto.es_servicio:
            stock_ant = producto.stock_actual
            producto.stock_actual = producto.stock_actual + linea.cantidad
            producto.precio_costo = linea.costo_unitario
            if linea.precio_sugerido:
                producto.precio_venta = linea.precio_sugerido
            mov = MovimientoInventario(
                producto_id=producto.id,
                tipo="ENTRADA",
                cantidad=linea.cantidad,
                stock_anterior=stock_ant,
                stock_nuevo=producto.stock_actual,
                referencia_tipo="COMPRA",
                costo_unitario=linea.costo_unitario,
                usuario_id=usuario_id,
            )
            db.add(mov)

    compra = Compra(
        numero=numero,
        proveedor_id=datos.proveedor_id,
        numero_factura_proveedor=datos.numero_factura_proveedor,
        subtotal=subtotal,
        iva_valor=iva_total,
        total=(subtotal + iva_total).quantize(Decimal("0.01")),
        usuario_id=usuario_id,
        observaciones=datos.observaciones,
        lineas=lineas_db,
    )
    db.add(compra)
    await db.commit()
    await db.refresh(compra)
    return compra

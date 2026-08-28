from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import json
import secrets
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import joinedload

from app.models.factura import Factura, FacturaDetalle
from app.models.producto import Producto
from app.models.cliente import Cliente
from app.models.bono import BonoCliente
from app.models.inventario import Compra, CompraDetalle, MovimientoInventario
from app.models.configuracion import ConfiguracionEmpresa
from app.models.resolucion_dian import ResolucionDian
from app.models.usuario import Usuario, Rol
from app.core.security import verify_password
from app.schemas.ventas import FacturaCreate, CompraCreate, DevolucionFacturaRequest

async def _siguiente_numero(db: AsyncSession, prefijo: str, modelo, campo) -> str:
    result = await db.execute(
        select(func.count()).select_from(modelo)
    )
    total = result.scalar() or 0
    return f"{prefijo}{str(total + 1).zfill(6)}"

async def crear_factura(datos: FacturaCreate, usuario_id: int, db: AsyncSession) -> Factura:
    # 1. Buscar si existe una Resolución DIAN activa
    res_resolucion = await db.execute(
        select(ResolucionDian)
        .where(ResolucionDian.activa == True)
        .order_by(ResolucionDian.id.desc())
    )
    resolucion = res_resolucion.scalars().first()

    resolucion_id = None
    if resolucion:
        resolucion_id = resolucion.id
        prefijo = (resolucion.prefijo or "POS").strip().upper()
        # Siguiente consecutivo de la resolución
        consecutivo = max(resolucion.consecutivo_actual + 1, resolucion.rango_desde)
        if consecutivo > resolucion.rango_hasta:
            raise HTTPException(
                status_code=400,
                detail=f"Se ha alcanzado el límite máximo del rango autorizado por la DIAN ({resolucion.rango_hasta:,}). Debe renovar su resolución de numeración."
            )
        resolucion.consecutivo_actual = consecutivo
        numero = f"{prefijo}{str(consecutivo).zfill(6)}"
    else:
        # Fallback a configuración general
        res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
        config = res_cfg.scalar_one_or_none()
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

        factor = getattr(linea, 'factor_multiplicador', Decimal('1')) or Decimal('1')
        unidades_a_descontar = (linea.cantidad * factor)
        presentacion = getattr(linea, 'presentacion', 'UNIDAD') or 'UNIDAD'
        es_encargo = getattr(linea, 'es_encargo', False) or False

        # Validación estricta de stock si no es encargo y afecta inventario
        if producto.afecta_inventario and not producto.es_servicio and not es_encargo:
            if producto.stock_actual < unidades_a_descontar:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para '{producto.nombre}'. Requiere {unidades_a_descontar} unidad(es), disponible en estantería: {producto.stock_actual}. Puedes autorizar la venta marcándola como 'Pedido por Encargo'."
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
            presentacion=presentacion,
            factor_multiplicador=factor,
            es_encargo=es_encargo,
        ))

        # Actualizar stock
        if producto.afecta_inventario and not producto.es_servicio:
            stock_ant = producto.stock_actual
            producto.stock_actual = producto.stock_actual - unidades_a_descontar
            obs_mov = f"Venta {linea.cantidad} ({presentacion})"
            if es_encargo:
                obs_mov += " [ENCARGO]"

            mov = MovimientoInventario(
                producto_id=producto.id,
                tipo="SALIDA",
                cantidad=unidades_a_descontar,
                stock_anterior=stock_ant,
                stock_nuevo=producto.stock_actual,
                referencia_tipo="FACTURA",
                usuario_id=usuario_id,
                observacion=obs_mov,
            )
            db.add(mov)

    total = (subtotal + iva_total + datos.domicilio_valor).quantize(Decimal("0.01"))

    # Procesar redención de bono / saldo a favor si fue aplicado
    if datos.bono_codigo and datos.bono_monto_aplicado and datos.bono_monto_aplicado > Decimal("0"):
        res_bono = await db.execute(select(BonoCliente).where(BonoCliente.codigo == datos.bono_codigo.strip().upper(), BonoCliente.estado == "ACTIVO"))
        bono = res_bono.scalar_one_or_none()
        if not bono:
            raise HTTPException(status_code=400, detail=f"El bono '{datos.bono_codigo}' no es válido o ya fue redimido")
        if bono.saldo_disponible < datos.bono_monto_aplicado:
            raise HTTPException(status_code=400, detail=f"El saldo del bono ({bono.saldo_disponible}) es menor al monto a aplicar ({datos.bono_monto_aplicado})")

        bono.saldo_disponible -= datos.bono_monto_aplicado
        if bono.saldo_disponible <= Decimal("0"):
            bono.estado = "REDIMIDO"

    cambio = max(Decimal("0"), datos.valor_recibido - total)

    factura = Factura(
        numero=numero,
        fecha=datetime.now(timezone.utc),
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
        resolucion_id=resolucion_id,
        lineas=lineas_db,
    )
    db.add(factura)
    await db.commit()
    await db.refresh(factura)
    return factura

async def anular_factura(factura_id: int, motivo: str, usuario_id: int, db: AsyncSession) -> Factura:
    result = await db.execute(select(Factura).options(joinedload(Factura.lineas)).where(Factura.id == factura_id))
    factura = result.scalar_one_or_none()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if factura.estado in ["ANULADA", "DEVUELTA"]:
        raise HTTPException(status_code=400, detail="La factura ya fue anulada o devuelta previamente")

    factura.estado = "ANULADA"
    factura.anulada_por = usuario_id
    factura.anulada_en = datetime.now(timezone.utc)
    factura.motivo_anulacion = motivo

    # Revertir stock
    for linea in factura.lineas:
        result = await db.execute(select(Producto).where(Producto.id == linea.producto_id))
        producto = result.scalar_one_or_none()
        factor = Decimal(str(linea.factor_multiplicador or 1))
        unids_retorno = (Decimal(str(linea.cantidad)) * factor)

        if producto and producto.afecta_inventario and not producto.es_servicio:
            stock_ant = producto.stock_actual
            producto.stock_actual = producto.stock_actual + unids_retorno
            mov = MovimientoInventario(
                producto_id=producto.id,
                tipo="DEVOLUCION",
                cantidad=unids_retorno,
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

async def procesar_devolucion_factura(
    factura_id: int,
    datos: DevolucionFacturaRequest,
    usuario_id: int,
    db: AsyncSession
) -> Dict[str, Any]:
    result = await db.execute(
        select(Factura)
        .options(joinedload(Factura.lineas), joinedload(Factura.cliente))
        .where(Factura.id == factura_id)
    )
    factura = result.scalar_one_or_none()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if factura.estado in ["ANULADA", "DEVUELTA"]:
        raise HTTPException(status_code=400, detail="La factura ya fue anulada o devuelta previamente")

    # ─── 0. Verificación de Seguridad y Autorización Anti-Fraude ─────────────
    # Consultar usuario y rol actual
    res_user = await db.execute(select(Usuario).options(joinedload(Usuario.rol)).where(Usuario.id == usuario_id))
    user_actual = res_user.scalar_one_or_none()

    permisos = json.loads(user_actual.rol.permisos) if (user_actual and user_actual.rol and user_actual.rol.permisos) else {}
    es_admin = bool(
        permisos.get("administrador_total") or
        (user_actual and user_actual.rol and user_actual.rol.nombre in ["Administrador", "Admin", "Gerente"])
    )

    autorizado_por_admin = es_admin
    admin_autorizador_nombre = user_actual.nombre if es_admin else None

    # Si se proporcionó un PIN / contraseña de autorización, validarlo contra administradores
    if datos.pin_autorizacion and datos.pin_autorizacion.strip():
        res_admins = await db.execute(select(Usuario).options(joinedload(Usuario.rol)).where(Usuario.activo == True))
        admins = res_admins.scalars().all()
        for adm in admins:
            adm_perms = json.loads(adm.rol.permisos) if (adm.rol and adm.rol.permisos) else {}
            if adm_perms.get("administrador_total") or (adm.rol and adm.rol.nombre in ["Administrador", "Admin", "Gerente"]):
                if verify_password(datos.pin_autorizacion.strip(), adm.codigo_hash):
                    autorizado_por_admin = True
                    admin_autorizador_nombre = adm.nombre
                    break

    # Si el método es Reembolso en Efectivo o Transferencia, exigir autorización obligatoria
    if datos.tipo_reembolso in ["EFECTIVO", "TRANSFERENCIA"] and not autorizado_por_admin:
        raise HTTPException(
            status_code=403,
            detail="La devolución de dinero (Efectivo o Transferencia) requiere obligatoriamente autorización con PIN o contraseña de Administrador por seguridad de caja."
        )

    factura.estado = "DEVUELTA"
    factura.anulada_por = usuario_id
    factura.anulada_en = datetime.now(timezone.utc)
    autorizador_txt = f" [Autorizado por: {admin_autorizador_nombre}]" if admin_autorizador_nombre else ""
    factura.motivo_anulacion = f"[{datos.tipo_reembolso}]{autorizador_txt} {datos.motivo}"

    # ─── 1. Revertir Inventario con Trazabilidad Completa ───────────────────────
    for linea in factura.lineas:
        result_p = await db.execute(select(Producto).where(Producto.id == linea.producto_id))
        producto = result_p.scalar_one_or_none()
        factor = Decimal(str(linea.factor_multiplicador or 1))
        unids_retorno = (Decimal(str(linea.cantidad)) * factor)

        if producto and producto.afecta_inventario and not producto.es_servicio:
            stock_ant = producto.stock_actual
            producto.stock_actual = producto.stock_actual + unids_retorno
            mov = MovimientoInventario(
                producto_id=producto.id,
                tipo="DEVOLUCION",
                cantidad=unids_retorno,
                stock_anterior=stock_ant,
                stock_nuevo=producto.stock_actual,
                costo_unitario=producto.precio_costo,
                referencia_tipo="DEVOLUCION",
                referencia_id=factura_id,
                usuario_id=usuario_id,
                observacion=f"Devolución factura {factura.numero}: {datos.motivo}{autorizador_txt}",
            )
            db.add(mov)

    # ─── 2. Generar Bono Seguro con Titular Cédula / NIT ────────────────────────
    bono_obj = None
    if datos.tipo_reembolso == "BONO":
        res_count = await db.execute(select(func.count(BonoCliente.id)))
        num_bono = (res_count.scalar() or 0) + 1
        sufijo_seguro = secrets.token_hex(2).upper()
        codigo_bono = f"BONO-{num_bono:04d}-{sufijo_seguro}"

        cliente_id_bono = factura.cliente_id if factura.cliente_id else 1

        bono_obj = BonoCliente(
            codigo=codigo_bono,
            cliente_id=cliente_id_bono,
            factura_origen_id=factura.id,
            monto_inicial=factura.total,
            saldo_disponible=factura.total,
            motivo=f"Devolución factura {factura.numero}: {datos.motivo}{autorizador_txt}",
            tipo_reembolso="BONO",
            estado="ACTIVO",
        )
        db.add(bono_obj)

    await db.commit()
    if bono_obj:
        await db.refresh(bono_obj)

    nom_cliente = factura.cliente.nombre if factura.cliente else "Cliente Mostrador"
    doc_cliente = factura.cliente.nit if factura.cliente else "222222222222"

    return {
        "mensaje": f"Devolución procesada con éxito ({'Bono generado' if bono_obj else 'Reembolso en efectivo'})",
        "factura_id": factura.id,
        "factura_numero": factura.numero,
        "monto_reembolsado": float(factura.total),
        "tipo_reembolso": datos.tipo_reembolso,
        "autorizado_por": admin_autorizador_nombre,
        "bono": {
            "id": bono_obj.id,
            "codigo": bono_obj.codigo,
            "saldo_disponible": float(bono_obj.saldo_disponible),
            "cliente_id": bono_obj.cliente_id,
            "cliente_nombre": nom_cliente,
            "cliente_nit": doc_cliente,
            "motivo": bono_obj.motivo,
            "created_at": bono_obj.created_at.isoformat() if bono_obj.created_at else None,
        } if bono_obj else None
    }

async def listar_bonos_cliente(cliente_id: int, db: AsyncSession) -> List[Dict[str, Any]]:
    stmt = (
        select(BonoCliente)
        .where(
            BonoCliente.cliente_id == cliente_id,
            BonoCliente.estado == "ACTIVO",
            BonoCliente.saldo_disponible > 0
        )
        .order_by(BonoCliente.id.desc())
    )
    result = await db.execute(stmt)
    bonos = result.scalars().all()
    return [
        {
            "id": b.id,
            "codigo": b.codigo,
            "monto_inicial": float(b.monto_inicial),
            "saldo_disponible": float(b.saldo_disponible),
            "motivo": b.motivo,
            "estado": b.estado,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in bonos
    ]

async def verificar_bono_codigo(codigo: str, db: AsyncSession) -> Dict[str, Any]:
    stmt = (
        select(BonoCliente)
        .options(joinedload(BonoCliente.cliente))
        .where(BonoCliente.codigo == codigo.strip().upper())
    )
    result = await db.execute(stmt)
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail=f"Bono con código '{codigo}' no encontrado")
    if b.estado != "ACTIVO" or b.saldo_disponible <= 0:
        raise HTTPException(status_code=400, detail=f"El bono '{codigo}' ya fue redimido o no tiene saldo disponible")

    return {
        "id": b.id,
        "codigo": b.codigo,
        "cliente_id": b.cliente_id,
        "cliente_nombre": b.cliente.nombre if b.cliente else "Cliente",
        "monto_inicial": float(b.monto_inicial),
        "saldo_disponible": float(b.saldo_disponible),
        "estado": b.estado,
    }

async def crear_compra(datos: CompraCreate, usuario_id: int, db: AsyncSession) -> Compra:
    # 0. Validación Anti-Duplicados: Evitar ingresar dos veces la misma factura del proveedor
    if datos.numero_factura_proveedor and datos.numero_factura_proveedor.strip():
        num_clean = datos.numero_factura_proveedor.strip()
        stmt_check = select(Compra).options(joinedload(Compra.proveedor)).where(Compra.numero_factura_proveedor == num_clean)
        if datos.proveedor_id:
            stmt_check = stmt_check.where(Compra.proveedor_id == datos.proveedor_id)
        res_dup = await db.execute(stmt_check)
        c_dup = res_dup.scalar_one_or_none()
        if c_dup:
            fecha_str = c_dup.fecha.strftime('%d/%m/%Y a las %H:%M') if c_dup.fecha else 'fecha previa'
            prov_str = f" del proveedor {c_dup.proveedor.razon_social}" if c_dup.proveedor else ""
            raise HTTPException(
                status_code=400,
                detail=f"La factura de compra N° '{num_clean}'{prov_str} ya fue registrada previamente en el sistema (Comprobante {c_dup.numero} del {fecha_str} - Total: ${float(c_dup.total):,.0f}). No se puede volver a ingresar para evitar duplicidad de inventario y costos."
            )

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

        # Actualizar stock, costo, venta y parametrización de fracciones
        if producto.afecta_inventario and not producto.es_servicio:
            stock_ant = Decimal(str(producto.stock_actual or 0))
            costo_ant = Decimal(str(producto.precio_costo or 0))
            cant_nueva = Decimal(str(linea.cantidad or 0))
            costo_factura = Decimal(str(linea.costo_unitario or 0))

            producto.stock_actual = stock_ant + cant_nueva

            # Determinar nuevo costo del producto según estrategia (CPP / Costo Más Alto / Último Costo)
            if linea.costo_calculado_producto is not None and linea.costo_calculado_producto > 0:
                producto.precio_costo = linea.costo_calculado_producto
            else:
                estrategia = linea.estrategia_costo or getattr(datos, 'estrategia_costo_global', 'PROMEDIO_PONDERADO') or 'PROMEDIO_PONDERADO'
                if estrategia == "PROMEDIO_PONDERADO" and stock_ant > 0 and costo_ant > 0:
                    cpp = ((stock_ant * costo_ant) + (cant_nueva * costo_factura)) / (stock_ant + cant_nueva)
                    producto.precio_costo = cpp.quantize(Decimal("0.01"))
                elif estrategia == "COSTO_MAS_ALTO" and costo_ant > 0:
                    producto.precio_costo = max(costo_ant, costo_factura)
                else:
                    producto.precio_costo = costo_factura

            if linea.precio_sugerido:
                producto.precio_venta = linea.precio_sugerido

            if linea.maneja_fracciones is not None:
                producto.maneja_fracciones = linea.maneja_fracciones
            if linea.contenido_caja is not None:
                producto.contenido_caja = linea.contenido_caja
            if linea.contenido_blister is not None:
                producto.contenido_blister = linea.contenido_blister
            if linea.precio_caja is not None:
                producto.precio_caja = linea.precio_caja
            if linea.precio_blister is not None:
                producto.precio_blister = linea.precio_blister
            if linea.precio_unidad is not None:
                producto.precio_unidad = linea.precio_unidad
            if linea.codigo_barras:
                producto.codigo_barras = linea.codigo_barras
            if linea.codigo_barras_blister:
                producto.codigo_barras_blister = linea.codigo_barras_blister
            if linea.codigo_barras_unidad:
                producto.codigo_barras_unidad = linea.codigo_barras_unidad

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
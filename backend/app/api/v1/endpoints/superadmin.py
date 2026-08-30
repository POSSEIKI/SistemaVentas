from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from app.db.database import get_db
from app.core.deps import require_super_admin
from app.models.usuario import Usuario, Rol
from app.models.suscripcion import Empresa, Suscripcion, PlanSuscripcion
from app.models.factura import Factura
from app.models.producto import Producto
from app.models.configuracion import ConfiguracionEmpresa

router = APIRouter(prefix="/superadmin", tags=["Super Administrador SaaS"])

class ExtenderPruebaRequest(BaseModel):
    dias: int = 15

class CambiarPlanRequest(BaseModel):
    plan_codigo: str
    estado: str = "ACTIVA"
    meses: int = 1

@router.get("/metricas")
async def obtener_metricas_globales(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    # Total empresas
    res_emp = await db.execute(select(func.count(Empresa.id)))
    total_empresas = res_emp.scalar() or 0

    # Total usuarios
    res_usr = await db.execute(select(func.count(Usuario.id)))
    total_usuarios = res_usr.scalar() or 0

    # Total productos en la plataforma
    res_prod = await db.execute(select(func.count(Producto.id)))
    total_productos = res_prod.scalar() or 0

    # Total facturas y dinero vendido
    res_fac = await db.execute(
        select(
            func.count(Factura.id),
            func.coalesce(func.sum(Factura.total), 0)
        ).where(Factura.estado == "EMITIDA")
    )
    row_fac = res_fac.first()
    total_facturas = row_fac[0] if row_fac else 0
    total_ventas_dinero = float(row_fac[1]) if row_fac else 0.0

    # Facturas DIAN
    res_dian = await db.execute(
        select(func.count(Factura.id)).where(Factura.dian_estado == "VALIDADA")
    )
    total_facturas_dian = res_dian.scalar() or 0

    # Suscripciones
    now = datetime.now(timezone.utc)
    res_susc = await db.execute(
        select(Suscripcion, PlanSuscripcion)
        .join(PlanSuscripcion, Suscripcion.plan_id == PlanSuscripcion.id)
    )
    susc_rows = res_susc.all()

    susc_prueba = 0
    susc_activas = 0
    susc_vencidas = 0
    mrr_estimado = 0.0

    for s, p in susc_rows:
        if s.estado == "PRUEBA_GRATIS":
            if s.fecha_fin > now:
                susc_prueba += 1
            else:
                susc_vencidas += 1
        elif s.estado == "ACTIVA":
            if s.fecha_fin > now:
                susc_activas += 1
                mrr_estimado += float(p.precio_mensual or 0)
            else:
                susc_vencidas += 1
        else:
            susc_vencidas += 1

    # Desglose por rubros
    res_rubros = await db.execute(
        select(Empresa.rubro, func.count(Empresa.id)).group_by(Empresa.rubro)
    )
    distribucion_rubros = {row[0] or 'GENERAL': row[1] for row in res_rubros.all()}

    # Registros últimos 30 días
    hace_30d = now - timedelta(days=30)
    res_rec = await db.execute(
        select(func.count(Empresa.id)).where(Empresa.created_at >= hace_30d)
    )
    nuevos_registros_mes = res_rec.scalar() or 0

    return {
        "total_empresas": total_empresas,
        "total_usuarios": total_usuarios,
        "total_productos": total_productos,
        "total_facturas": total_facturas,
        "total_ventas_dinero": total_ventas_dinero,
        "total_facturas_dian": total_facturas_dian,
        "suscripciones_prueba": susc_prueba,
        "suscripciones_activas": susc_activas,
        "suscripciones_vencidas": susc_vencidas,
        "mrr_estimado": mrr_estimado,
        "distribucion_rubros": distribucion_rubros,
        "nuevos_registros_mes": nuevos_registros_mes,
    }

@router.get("/empresas")
async def listar_empresas_superadmin(
    busqueda: Optional[str] = None,
    estado: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    query = select(Empresa).order_by(Empresa.id.desc())
    if busqueda:
        term = f"%{busqueda.strip()}%"
        query = query.where(
            or_(
                Empresa.nombre.ilike(term),
                Empresa.nit.ilike(term),
                Empresa.email.ilike(term),
                Empresa.ciudad.ilike(term),
                Empresa.telefono.ilike(term),
            )
        )
    result = await db.execute(query)
    empresas = result.scalars().all()

    now = datetime.now(timezone.utc)
    lista = []

    for emp in empresas:
        # Obtener suscripcion activa
        res_s = await db.execute(
            select(Suscripcion, PlanSuscripcion)
            .join(PlanSuscripcion, Suscripcion.plan_id == PlanSuscripcion.id)
            .where(Suscripcion.empresa_id == emp.id)
            .order_by(Suscripcion.id.desc())
        )
        susc_row = res_s.first()
        susc, plan = (susc_row[0], susc_row[1]) if susc_row else (None, None)

        dias_restantes = 0
        estado_susc = "SIN_SUSCRIPCION"
        if susc:
            delta = susc.fecha_fin - now
            dias_restantes = max(0, delta.days)
            if susc.estado == "PRUEBA_GRATIS":
                estado_susc = "PRUEBA_GRATIS" if delta.total_seconds() > 0 else "PRUEBA_VENCIDA"
            elif susc.estado == "ACTIVA":
                estado_susc = "ACTIVA" if delta.total_seconds() > 0 else "VENCIDA"
            else:
                estado_susc = susc.estado

        # Admin / Dueño
        res_u = await db.execute(
            select(Usuario).where(Usuario.empresa_id == emp.id).order_by(Usuario.id.asc())
        )
        admin_usr = res_u.scalars().first()

        # Configuración FE
        res_cfg = await db.execute(
            select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.empresa_id == emp.id).order_by(ConfiguracionEmpresa.id.desc())
        )
        cfg = res_cfg.scalars().first()
        if not cfg and emp.id == 1:
            res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
            cfg = res_cfg.scalars().first()

        lista.append({
            "id": emp.id,
            "nombre": emp.nombre,
            "nit": emp.nit or "Sin NIT",
            "rubro": emp.rubro or "GENERAL",
            "email": emp.email or "",
            "telefono": emp.telefono or "",
            "ciudad": emp.ciudad or "",
            "direccion": emp.direccion or "",
            "activo": emp.activo,
            "created_at": emp.created_at,
            "admin_nombre": admin_usr.nombre if admin_usr else "No asignado",
            "admin_username": admin_usr.username if admin_usr else "",
            "plan_nombre": plan.nombre if plan else "Plan Básico",
            "plan_codigo": plan.codigo if plan else "BASICO",
            "estado_suscripcion": estado_susc,
            "fecha_fin_suscripcion": susc.fecha_fin if susc else None,
            "dias_restantes": dias_restantes,
            "fe_habilitada": cfg.fe_habilitada if cfg else False,
            "fe_ambiente": cfg.fe_ambiente if cfg else "SANDBOX",
        })

    if estado:
        lista = [e for e in lista if e["estado_suscripcion"] == estado]

    return lista

@router.post("/empresas/{empresa_id}/extender-prueba")
async def extender_prueba_empresa(
    empresa_id: int,
    datos: ExtenderPruebaRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    res_s = await db.execute(
        select(Suscripcion)
        .where(Suscripcion.empresa_id == empresa_id)
        .order_by(Suscripcion.id.desc())
    )
    susc = res_s.scalars().first()
    if not susc:
        raise HTTPException(status_code=404, detail="Suscripción no encontrada para esta empresa")

    now = datetime.now(timezone.utc)
    base_date = susc.fecha_fin if susc.fecha_fin > now else now
    susc.fecha_fin = base_date + timedelta(days=datos.dias)
    susc.estado = "PRUEBA_GRATIS"
    await db.commit()
    await db.refresh(susc)

    return {"exito": True, "mensaje": f"Se extendió la prueba por {datos.dias} días exitosamente", "nueva_fecha_fin": susc.fecha_fin}

@router.post("/empresas/{empresa_id}/cambiar-plan")
async def cambiar_plan_empresa(
    empresa_id: int,
    datos: CambiarPlanRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    # Buscar plan
    res_p = await db.execute(select(PlanSuscripcion).where(PlanSuscripcion.codigo == datos.plan_codigo))
    plan = res_p.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan {datos.plan_codigo} no existe")

    res_s = await db.execute(
        select(Suscripcion)
        .where(Suscripcion.empresa_id == empresa_id)
        .order_by(Suscripcion.id.desc())
    )
    susc = res_s.scalars().first()
    now = datetime.now(timezone.utc)

    if susc:
        susc.plan_id = plan.id
        susc.estado = datos.estado
        susc.fecha_fin = now + timedelta(days=30 * max(1, datos.meses))
    else:
        susc = Suscripcion(
            empresa_id=empresa_id,
            plan_id=plan.id,
            estado=datos.estado,
            fecha_inicio=now,
            fecha_fin=now + timedelta(days=30 * max(1, datos.meses)),
            tipo_periodo="MENSUAL"
        )
        db.add(susc)

    await db.commit()
    return {"exito": True, "mensaje": f"Plan actualizado a {plan.nombre} ({datos.estado})"}

@router.post("/empresas/{empresa_id}/toggle-activo")
async def toggle_activo_empresa(
    empresa_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    res_e = await db.execute(select(Empresa).where(Empresa.id == empresa_id))
    emp = res_e.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    emp.activo = not emp.activo
    # Bloquear o desbloquear usuarios de esa empresa
    await db.execute(
        select(Usuario).where(Usuario.empresa_id == empresa_id)
    )
    res_u = await db.execute(select(Usuario).where(Usuario.empresa_id == empresa_id))
    for u in res_u.scalars().all():
        u.bloqueado = not emp.activo

    await db.commit()
    estado_txt = "activada" if emp.activo else "suspendida"
    return {"exito": True, "activo": emp.activo, "mensaje": f"Empresa {emp.nombre} {estado_txt}"}

@router.get("/logs-fallos")
async def logs_fallos_plataforma(
    limite: int = 50,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    # Buscar facturas con fallos DIAN o anulaciones recientes
    res_fac = await db.execute(
        select(Factura)
        .where(or_(Factura.dian_estado == "RECHAZADA", Factura.estado == "ANULADA"))
        .order_by(Factura.id.desc())
        .limit(limite)
    )
    facturas_fallidas = res_fac.scalars().all()

    logs = []
    for f in facturas_fallidas:
        logs.append({
            "tipo": "DIAN_RECHAZADA" if f.dian_estado == "RECHAZADA" else "FACTURA_ANULADA",
            "factura_id": f.id,
            "factura_numero": f.numero,
            "fecha": f.fecha,
            "total": float(f.total),
            "detalle_error": f.dian_errores or f.motivo_anulacion or "Error no especificado",
            "estado": f.dian_estado if f.dian_estado == "RECHAZADA" else f.estado,
        })

    return logs

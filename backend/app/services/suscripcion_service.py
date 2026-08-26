import json
import re
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.suscripcion import PlanSuscripcion, Empresa, Suscripcion
from app.models.usuario import Rol, Usuario
from app.models.configuracion import ConfiguracionEmpresa
from app.core.security import hash_password, create_access_token, create_refresh_token
from app.schemas.suscripcion import RegistroEmpresaRequest

PLANES_INICIALES = [
    {
        "codigo": "BASICO",
        "nombre": "Plan Emprendedor",
        "descripcion": "Ideal para pequeños comercios y negocios que inician su punto de venta.",
        "precio_mensual": Decimal("35000"),
        "precio_anual": Decimal("350000"), # 2 meses gratis
        "limite_productos": 1000,
        "limite_usuarios": 2,
        "limite_facturas_mes": 1000,
        "permite_multisede": False,
        "permite_importador_pdf": False,
        "permite_fracciones": True,
        "caracteristicas": json.dumps([
            "1 Punto de Venta / Caja",
            "Hasta 2 Usuarios (Cajero y Admin)",
            "Control de Inventario y Stock Mínimo",
            "Impresión Térmica 58mm y 80mm",
            "Reportes de Ventas y Cuadre de Caja",
            "Soporte por WhatsApp y Correo"
        ]),
        "destacado": False,
        "orden": 1
    },
    {
        "codigo": "PRO",
        "nombre": "Plan Pro Farmacias & Ferreterías",
        "descripcion": "La solución completa para droguerías, farmacias y comercios con venta por fracciones.",
        "precio_mensual": Decimal("65000"),
        "precio_anual": Decimal("650000"),
        "limite_productos": 0, # Ilimitado
        "limite_usuarios": 5,
        "limite_facturas_mes": 0,
        "permite_multisede": False,
        "permite_importador_pdf": True,
        "permite_fracciones": True,
        "caracteristicas": json.dumps([
            "Todo lo del Plan Básico",
            "Productos y Ventas Ilimitadas",
            "Venta Fraccionada (Caja / Blíster / Unidad)",
            "Búsqueda Inteligente por Sustancia Genérica",
            "Importador Automático de Facturas PDF (LOINPRO/DIAN)",
            "Importador Oficial Coopidrogas .DAT y Excel",
            "Control de Lotes y Fechas de Vencimiento",
            "Envío de Tirilla POS por WhatsApp y Correo",
            "Hasta 5 Usuarios Simultáneos",
            "Soporte Técnico Prioritario"
        ]),
        "destacado": True,
        "orden": 2
    },
    {
        "codigo": "ENTERPRISE",
        "nombre": "Plan Cadenas & Multi-Sede",
        "descripcion": "Para empresas con múltiples sucursales, alta rotación y necesidades corporativas.",
        "precio_mensual": Decimal("120000"),
        "precio_anual": Decimal("1200000"),
        "limite_productos": 0,
        "limite_usuarios": 20,
        "limite_facturas_mes": 0,
        "permite_multisede": True,
        "permite_importador_pdf": True,
        "permite_fracciones": True,
        "caracteristicas": json.dumps([
            "Todo lo del Plan Pro",
            "Multi-Sucursal y Transferencias entre Sedes",
            "Usuarios y Cajas Ilimitadas",
            "Reportes Gerenciales y Auditoría Avanzada",
            "Backups Dedicados Diarios en la Nube",
            "Capacitación Personalizada del Equipo",
            "Atención Telefónica y WhatsApp 24/7"
        ]),
        "destacado": False,
        "orden": 3
    }
]

async def inicializar_planes_predeterminados(db: AsyncSession):
    """Crea los planes por defecto en la base de datos si no existen."""
    for p_def in PLANES_INICIALES:
        res = await db.execute(select(PlanSuscripcion).where(PlanSuscripcion.codigo == p_def["codigo"]))
        existente = res.scalar_one_or_none()
        if not existente:
            plan = PlanSuscripcion(**p_def)
            db.add(plan)
    await db.commit()

async def obtener_planes_publicos(db: AsyncSession) -> List[PlanSuscripcion]:
    """Retorna los planes activos ordenados."""
    res = await db.execute(
        select(PlanSuscripcion).where(PlanSuscripcion.activo == True).order_by(PlanSuscripcion.orden)
    )
    planes = res.scalars().all()
    if not planes:
        await inicializar_planes_predeterminados(db)
        res = await db.execute(
            select(PlanSuscripcion).where(PlanSuscripcion.activo == True).order_by(PlanSuscripcion.orden)
        )
        planes = res.scalars().all()
    return planes

def _crear_slug(nombre: str) -> str:
    s = re.sub(r'[^a-zA-Z0-9\s]', '', nombre).strip().lower()
    s = re.sub(r'\s+', '-', s)
    if not s:
        s = "empresa"
    return f"{s}-{secrets.token_hex(3)}"

async def registrar_nueva_empresa_y_admin(datos: RegistroEmpresaRequest, db: AsyncSession) -> dict:
    """Registra una nueva empresa, su usuario administrador y activa el periodo de prueba gratis."""
    # 1. Validar que el username no esté en uso
    username_clean = datos.admin_username.strip().lower()
    res_usr = await db.execute(select(Usuario).where(Usuario.username == username_clean))
    if res_usr.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso. Por favor elige otro.")

    # 2. Asegurar planes
    await inicializar_planes_predeterminados(db)

    # 3. Buscar plan seleccionado (o PRO por defecto)
    res_plan = await db.execute(select(PlanSuscripcion).where(PlanSuscripcion.codigo == datos.plan_codigo.upper()))
    plan = res_plan.scalar_one_or_none()
    if not plan:
        res_plan = await db.execute(select(PlanSuscripcion).where(PlanSuscripcion.codigo == "PRO"))
        plan = res_plan.scalar_one_or_none()

    # 4. Crear Empresa
    slug = _crear_slug(datos.empresa_nombre)
    empresa = Empresa(
        nombre=datos.empresa_nombre.strip(),
        nit=datos.empresa_nit.strip() if datos.empresa_nit else "",
        rubro=datos.rubro.strip().upper(),
        slug=slug,
        email=datos.admin_email.strip() if datos.admin_email else "",
        telefono=datos.empresa_telefono.strip() if datos.empresa_telefono else "",
        direccion=datos.empresa_direccion.strip() if datos.empresa_direccion else "",
        ciudad=datos.empresa_ciudad.strip() if datos.empresa_ciudad else "",
    )
    db.add(empresa)
    await db.flush()

    # 5. Asegurar Rol Administrador
    res_rol = await db.execute(select(Rol).where(Rol.nombre == "ADMINISTRADOR"))
    rol_admin = res_rol.scalar_one_or_none()
    if not rol_admin:
        permisos_admin = json.dumps({"administrador_total": True})
        rol_admin = Rol(nombre="ADMINISTRADOR", descripcion="Acceso total al sistema", permisos=permisos_admin)
        db.add(rol_admin)
        await db.flush()

    # 6. Crear Usuario Administrador
    admin = Usuario(
        nombre=datos.admin_nombre.strip(),
        username=username_clean,
        codigo_hash=hash_password(datos.admin_codigo),
        rol_id=rol_admin.id,
        empresa_id=empresa.id,
        activo=True,
    )
    db.add(admin)
    await db.flush()

    # 7. Crear Suscripción (Prueba Gratis de 14 Días)
    ahora = datetime.now(timezone.utc)
    fin_prueba = ahora + timedelta(days=14)
    suscripcion = Suscripcion(
        empresa_id=empresa.id,
        plan_id=plan.id,
        estado="PRUEBA_GRATIS",
        fecha_inicio=ahora,
        fecha_fin=fin_prueba,
        dias_gracia=3,
        tipo_periodo=datos.periodo.upper(),
        notas="Prueba gratuita de 14 días otorgada al registrarse.",
    )
    db.add(suscripcion)

    # 8. Crear o actualizar Configuración Empresa
    res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
    cfg = res_cfg.scalar_one_or_none()
    if not cfg:
        cfg = ConfiguracionEmpresa(id=1)
        db.add(cfg)
    cfg.nombre = datos.empresa_nombre
    cfg.nit = datos.empresa_nit or ""
    cfg.ciudad = datos.empresa_ciudad or ""
    cfg.telefono = datos.empresa_telefono or ""
    cfg.direccion = datos.empresa_direccion or ""
    cfg.rubro = datos.rubro or "FARMACIA"
    cfg.primer_inicio = False

    await db.commit()
    await db.refresh(admin)

    # 9. Generar Tokens de Sesión Inmediatos
    access_token = create_access_token({"sub": admin.username})
    refresh_token = create_refresh_token(admin.id)

    permisos = json.loads(rol_admin.permisos) if rol_admin and rol_admin.permisos else {"administrador_total": True}

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "usuario_id": admin.id,
        "nombre": admin.nombre,
        "username": admin.username,
        "rol": rol_admin.nombre,
        "permisos": permisos,
        "empresa": {
            "id": empresa.id,
            "nombre": empresa.nombre,
            "slug": empresa.slug,
            "rubro": empresa.rubro,
        },
        "suscripcion": {
            "plan_nombre": plan.nombre,
            "plan_codigo": plan.codigo,
            "estado": "PRUEBA_GRATIS",
            "dias_restantes": 14,
            "fecha_fin": fin_prueba.isoformat(),
        }
    }

async def obtener_estado_suscripcion_usuario(usuario: Usuario, db: AsyncSession) -> dict:
    """Consulta el estado actual de la suscripción del usuario / empresa."""
    empresa_id = usuario.empresa_id
    if not empresa_id:
        # Si no tiene empresa_id asociada (ej: instalación inicial heredada), retornamos plan activo vitalicio
        return {
            "plan_nombre": "Plan Pro Farmacias",
            "plan_codigo": "PRO",
            "estado": "ACTIVA",
            "dias_restantes": 365,
            "es_prueba": False,
            "fecha_fin": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
        }

    res = await db.execute(
        select(Suscripcion)
        .where(Suscripcion.empresa_id == empresa_id)
        .order_by(Suscripcion.created_at.desc())
    )
    suscripcion = res.scalars().first()
    if not suscripcion:
        return {
            "plan_nombre": "Sin Plan Activo",
            "plan_codigo": "NINGUNO",
            "estado": "VENCIDA",
            "dias_restantes": 0,
            "es_prueba": False,
            "fecha_fin": datetime.now(timezone.utc).isoformat(),
        }

    res_plan = await db.execute(select(PlanSuscripcion).where(PlanSuscripcion.id == suscripcion.plan_id))
    plan = res_plan.scalar_one_or_none()

    ahora = datetime.now(timezone.utc)
    fecha_fin = suscripcion.fecha_fin
    if fecha_fin.tzinfo is None:
        fecha_fin = fecha_fin.replace(tzinfo=timezone.utc)
    
    delta = fecha_fin - ahora
    dias_restantes = max(0, delta.days)

    estado = suscripcion.estado
    if dias_restantes == 0 and estado in ["PRUEBA_GRATIS", "ACTIVA"]:
        estado = "VENCIDA"

    return {
        "plan_nombre": plan.nombre if plan else "Plan Pro",
        "plan_codigo": plan.codigo if plan else "PRO",
        "estado": estado,
        "dias_restantes": dias_restantes,
        "es_prueba": suscripcion.estado == "PRUEBA_GRATIS",
        "fecha_fin": fecha_fin.isoformat(),
    }

import json
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.usuario import Rol, Usuario
from app.models.configuracion import ConfiguracionEmpresa
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.schemas.auth import LoginRequest, SetupRequest, TokenResponse

async def sistema_necesita_setup(db: AsyncSession) -> bool:
    result = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
    config = result.scalar_one_or_none()
    return config is None or config.primer_inicio

async def setup_inicial(request: SetupRequest, db: AsyncSession) -> dict:
    # Verificar que no se ha hecho setup aún
    necesita = await sistema_necesita_setup(db)
    if not necesita:
        raise HTTPException(status_code=400, detail="El sistema ya fue configurado")

    # Crear rol administrador
    permisos_admin = json.dumps({"administrador_total": True})
    rol_admin = Rol(nombre="ADMINISTRADOR", descripcion="Acceso total al sistema", permisos=permisos_admin)
    db.add(rol_admin)
    await db.flush()

    # Crear rol vendedor
    permisos_vendedor = json.dumps({
        "ver_ventas": True, "crear_ventas": True,
        "ver_clientes": True, "crear_clientes": True,
    })
    rol_vendedor = Rol(nombre="VENDEDOR", descripcion="Acceso a ventas y clientes", permisos=permisos_vendedor)
    db.add(rol_vendedor)
    await db.flush()

    # Crear usuario administrador
    admin = Usuario(
        nombre=request.admin_nombre,
        username=request.admin_username.strip().lower(),
        codigo_hash=hash_password(request.admin_codigo),
        rol_id=rol_admin.id,
    )
    db.add(admin)

    # Crear o actualizar configuración empresa
    result = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
    config = result.scalar_one_or_none()
    if config is None:
        config = ConfiguracionEmpresa(id=1)
        db.add(config)

    config.nombre = request.empresa_nombre
    config.nit = request.empresa_nit or ""
    config.telefono = request.empresa_telefono or ""
    config.ciudad = request.empresa_ciudad or ""
    config.direccion = request.empresa_direccion or ""
    config.rubro = request.rubro or "FARMACIA"
    config.pais = getattr(request, "pais", "Colombia") or "Colombia"
    config.zona_horaria = getattr(request, "zona_horaria", "America/Bogota") or "America/Bogota"
    config.primer_inicio = False

    await db.commit()
    return {"mensaje": "Sistema configurado exitosamente"}

async def login(request: LoginRequest, db: AsyncSession) -> TokenResponse:
    result = await db.execute(
        select(Usuario).where(Usuario.username == request.username, Usuario.activo == True)
    )
    usuario = result.scalar_one_or_none()

    if not usuario or not verify_password(request.codigo, usuario.codigo_hash):
        # Registrar intento fallido si el usuario existe
        if usuario:
            usuario.intentos_fallidos = (usuario.intentos_fallidos or 0) + 1
            if usuario.intentos_fallidos >= 5:
                usuario.bloqueado = True
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o código incorrecto",
        )

    if usuario.bloqueado:
        raise HTTPException(status_code=403, detail="Usuario bloqueado. Contacte al administrador.")

    # Resetear intentos fallidos
    usuario.intentos_fallidos = 0
    from datetime import datetime, timezone
    usuario.ultimo_acceso = datetime.now(timezone.utc)
    await db.commit()

    # Obtener permisos del rol
    result = await db.execute(select(Rol).where(Rol.id == usuario.rol_id))
    rol = result.scalar_one_or_none()
    permisos = json.loads(rol.permisos) if rol else {}

    # Obtener rubro de empresa
    res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
    cfg = res_cfg.scalar_one_or_none()
    rubro = cfg.rubro if cfg else "FARMACIA"

    access_token = create_access_token({"sub": usuario.username})
    refresh_token = create_refresh_token(usuario.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        usuario_id=usuario.id,
        nombre=usuario.nombre,
        username=usuario.username,
        rol=rol.nombre if rol else "",
        permisos=permisos,
        rubro=rubro,
    )

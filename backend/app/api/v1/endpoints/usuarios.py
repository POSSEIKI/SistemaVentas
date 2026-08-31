from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import joinedload
from typing import List, Optional
import json

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password
from app.models.usuario import Usuario, Rol
from app.schemas.auth import UsuarioCreate, UsuarioUpdate, UsuarioOut

router = APIRouter(prefix="/usuarios", tags=["Usuarios y Permisos"])

async def _obtener_info_rol(rol_id: Optional[int], db: AsyncSession) -> tuple[str, dict]:
    if not rol_id:
        return "VENDEDOR", {}
    res = await db.execute(select(Rol).where(Rol.id == rol_id))
    r = res.scalar_one_or_none()
    if not r:
        return "VENDEDOR", {}
    permisos = {}
    if r.permisos:
        try:
            permisos = json.loads(r.permisos) if isinstance(r.permisos, str) else r.permisos
        except Exception:
            permisos = {}
    return r.nombre or "VENDEDOR", permisos

def _formatear_usuario_out(u: Usuario) -> dict:
    permisos = {}
    rol_nom = "VENDEDOR"
    if getattr(u, 'rol', None):
        rol_nom = u.rol.nombre or "VENDEDOR"
        if u.rol.permisos:
            try:
                permisos = json.loads(u.rol.permisos) if isinstance(u.rol.permisos, str) else u.rol.permisos
            except Exception:
                permisos = {}
    return {
        "id": u.id,
        "nombre": u.nombre,
        "username": u.username,
        "email": u.email,
        "rol_id": u.rol_id or 2,
        "rol_nombre": rol_nom,
        "permisos": permisos,
        "activo": u.activo,
        "ultimo_acceso": u.ultimo_acceso.isoformat() if u.ultimo_acceso else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }

@router.get("", response_model=List[UsuarioOut])
async def listar_usuarios(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    stmt = (
        select(Usuario)
        .options(joinedload(Usuario.rol))
        .where(Usuario.empresa_id == empresa_id)
        .order_by(Usuario.id.asc())
    )
    result = await db.execute(stmt)
    usuarios = result.scalars().all()
    return [_formatear_usuario_out(u) for u in usuarios]

@router.post("", response_model=UsuarioOut)
async def crear_usuario(
    datos: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    
    # Validar permisos de administrador de forma segura
    rol_nombre_admin, permisos_admin = await _obtener_info_rol(current_user.rol_id, db)
    es_admin = (
        current_user.id in [1, 3]
        or rol_nombre_admin == "ADMINISTRADOR"
        or bool(permisos_admin.get("administrador_total"))
        or bool(permisos_admin.get("super_admin"))
    )
    if not es_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un Administrador puede crear nuevos usuarios en la empresa"
        )

    u_clean = (datos.username or "").strip().lower()
    e_clean = (datos.email or "").strip().lower() if datos.email else u_clean if "@" in u_clean else None
    
    if not u_clean:
        raise HTTPException(status_code=400, detail="El nombre de usuario o correo es obligatorio")

    # Validar que no exista el usuario globalmente
    res_existente = await db.execute(
        select(Usuario).where(
            or_(
                func.lower(Usuario.username) == u_clean,
                func.lower(Usuario.email) == u_clean,
                *([func.lower(Usuario.email) == e_clean] if e_clean else [])
            )
        )
    )
    if res_existente.scalars().first():
        raise HTTPException(
            status_code=400,
            detail=f"El usuario o correo '{u_clean}' ya está en uso. Por favor elige otro."
        )

    # Determinar Rol
    rol_nombre_deseado = (datos.rol_nombre or "VENDEDOR").strip().upper()
    res_rol = await db.execute(select(Rol).where(Rol.nombre == rol_nombre_deseado))
    rol = res_rol.scalars().first()

    if not rol:
        res_max_rol = await db.execute(select(func.coalesce(func.max(Rol.id), 0)))
        next_rol_id = (res_max_rol.scalar() or 0) + 1
        
        permisos_def = {"ver_ventas": True, "crear_ventas": True, "ver_inventario": True}
        if rol_nombre_deseado == "ADMINISTRADOR":
            permisos_def = {"administrador_total": True}
        elif rol_nombre_deseado == "CONTADOR":
            permisos_def = {"ver_reportes": True, "ver_inventario": True}

        rol = Rol(
            id=next_rol_id,
            nombre=rol_nombre_deseado,
            descripcion=f"Rol {rol_nombre_deseado}",
            permisos=json.dumps(datos.permisos or permisos_def),
            activo=True
        )
        db.add(rol)
        await db.flush()

    res_max_u = await db.execute(select(func.coalesce(func.max(Usuario.id), 0)))
    next_u_id = (res_max_u.scalar() or 0) + 1

    nuevo_usuario = Usuario(
        id=next_u_id,
        nombre=datos.nombre.strip(),
        username=u_clean,
        email=e_clean,
        codigo_hash=hash_password(datos.codigo.strip()),
        rol_id=rol.id,
        empresa_id=empresa_id,
        activo=datos.activo,
    )
    db.add(nuevo_usuario)
    await db.commit()

    # Recargar con rol
    stmt = select(Usuario).options(joinedload(Usuario.rol)).where(Usuario.id == nuevo_usuario.id)
    res_final = await db.execute(stmt)
    u_cargado = res_final.scalar_one()
    return _formatear_usuario_out(u_cargado)

@router.patch("/{usuario_id}", response_model=UsuarioOut)
async def actualizar_usuario(
    usuario_id: int,
    datos: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    stmt = select(Usuario).options(joinedload(Usuario.rol)).where(Usuario.id == usuario_id, Usuario.empresa_id == empresa_id)
    result = await db.execute(stmt)
    usuario = result.scalar_one_or_none()

    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado en tu empresa")

    # Validar permisos
    rol_nombre_admin, permisos_admin = await _obtener_info_rol(current_user.rol_id, db)
    es_admin = (
        current_user.id in [1, 3]
        or rol_nombre_admin == "ADMINISTRADOR"
        or bool(permisos_admin.get("administrador_total"))
        or bool(permisos_admin.get("super_admin"))
    )
    
    if not es_admin and current_user.id != usuario.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar este usuario")

    if datos.nombre is not None and datos.nombre.strip():
        usuario.nombre = datos.nombre.strip()

    if datos.username is not None and datos.username.strip():
        u_clean = datos.username.strip().lower()
        if u_clean != usuario.username:
            res_ex = await db.execute(select(Usuario).where(func.lower(Usuario.username) == u_clean, Usuario.id != usuario.id))
            if res_ex.scalars().first():
                raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso")
            usuario.username = u_clean

    if datos.email is not None:
        usuario.email = datos.email.strip().lower() if datos.email.strip() else None

    if datos.codigo is not None and len(datos.codigo.strip()) >= 4:
        usuario.codigo_hash = hash_password(datos.codigo.strip())
        usuario.bloqueado = False
        usuario.intentos_fallidos = 0

    if es_admin and datos.activo is not None:
        if usuario.id == current_user.id and not datos.activo:
            raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta administradora")
        usuario.activo = datos.activo

    if es_admin and datos.rol_nombre:
        rol_nom = datos.rol_nombre.strip().upper()
        res_rol = await db.execute(select(Rol).where(Rol.nombre == rol_nom))
        rol = res_rol.scalars().first()
        if rol:
            usuario.rol_id = rol.id

    if es_admin and datos.permisos is not None and usuario.rol:
        try:
            usuario.rol.permisos = json.dumps(datos.permisos)
        except Exception:
            pass

    await db.commit()
    await db.refresh(usuario)
    return _formatear_usuario_out(usuario)

@router.delete("/{usuario_id}")
async def eliminar_usuario(
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    if usuario_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar o desactivar tu propia cuenta")

    stmt = select(Usuario).where(Usuario.id == usuario_id, Usuario.empresa_id == empresa_id)
    result = await db.execute(stmt)
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    usuario.activo = False
    await db.commit()
    return {"mensaje": f"Usuario '{usuario.nombre}' desactivado exitosamente"}

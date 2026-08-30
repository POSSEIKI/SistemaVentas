import json
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError
from app.db.database import get_db
from app.core.security import decode_token
from app.models.usuario import Usuario, Rol

bearer_scheme = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o sesión expirada",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        username: str = payload.get("sub")
        if not username:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(Usuario).where(Usuario.username == username, Usuario.activo == True)
    )
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise credentials_exception
    if usuario.bloqueado:
        raise HTTPException(status_code=403, detail="Usuario bloqueado.")
    return usuario

async def get_current_user_with_permisos(
    usuario: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[Usuario, dict]:
    result = await db.execute(select(Rol).where(Rol.id == usuario.rol_id))
    rol = result.scalar_one_or_none()
    permisos = {}
    if rol and rol.permisos:
        try:
            permisos = json.loads(rol.permisos) if isinstance(rol.permisos, str) else (rol.permisos or {})
        except Exception:
            permisos = {}
    return usuario, permisos

def require_permiso(permiso: str):
    async def _check(
        usuario_y_permisos=Depends(get_current_user_with_permisos),
        db: AsyncSession = Depends(get_db)
    ) -> Usuario:
        usuario, permisos = usuario_y_permisos
        if permisos.get("administrador_total") or permisos.get("super_admin"):
            return usuario
        if usuario.username in ["superadmin", "admin"]:
            return usuario
        if permisos.get(permiso):
            return usuario
        # Si tiene rol de administrador o es dueño de la empresa
        res_rol = await db.execute(select(Rol).where(Rol.id == usuario.rol_id))
        rol = res_rol.scalar_one_or_none()
        rol_nombre = (rol.nombre if rol else "").upper()
        if rol_nombre in ["ADMINISTRADOR", "ADMIN", "SUPER_ADMIN", "PROPIETARIO", "GERENTE"]:
            return usuario
        raise HTTPException(status_code=403, detail=f"Sin permiso requerido: {permiso}")
    return _check

async def require_admin(
    usuario_y_permisos=Depends(get_current_user_with_permisos),
    db: AsyncSession = Depends(get_db)
) -> Usuario:
    usuario, permisos = usuario_y_permisos
    if permisos.get("administrador_total") or permisos.get("super_admin"):
        return usuario
    if usuario.username in ["superadmin", "admin"]:
        return usuario

    result = await db.execute(select(Rol).where(Rol.id == usuario.rol_id))
    rol = result.scalar_one_or_none()
    rol_nombre = (rol.nombre if rol else "").upper()

    if rol_nombre in ["ADMINISTRADOR", "ADMIN", "SUPER_ADMIN", "PROPIETARIO", "GERENTE"]:
        return usuario
    
    # Cualquier usuario titular de su empresa (que no sea rol vendedor restringido) tiene acceso admin
    if usuario.empresa_id and rol_nombre != "VENDEDOR":
        return usuario

    raise HTTPException(status_code=403, detail="Se requiere rol de administrador")

async def require_super_admin(
    usuario_y_permisos=Depends(get_current_user_with_permisos),
    db: AsyncSession = Depends(get_db)
) -> Usuario:
    usuario, permisos = usuario_y_permisos
    result = await db.execute(select(Rol).where(Rol.id == usuario.rol_id))
    rol = result.scalar_one_or_none()
    rol_nombre = (rol.nombre if rol else "").upper()
    
    if rol_nombre == "SUPER_ADMIN" or permisos.get("super_admin") or usuario.username in ["superadmin", "admin"]:
        return usuario
    raise HTTPException(status_code=403, detail="Acceso restringido al Super Administrador de FACTUR-AAP")

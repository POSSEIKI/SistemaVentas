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
    permisos = json.loads(rol.permisos) if rol else {}
    return usuario, permisos

def require_permiso(permiso: str):
    async def _check(usuario_y_permisos=Depends(get_current_user_with_permisos)) -> Usuario:
        usuario, permisos = usuario_y_permisos
        if permisos.get("administrador_total"):
            return usuario
        if not permisos.get(permiso):
            raise HTTPException(status_code=403, detail=f"Sin permiso: {permiso}")
        return usuario
    return _check

async def require_admin(usuario_y_permisos=Depends(get_current_user_with_permisos)) -> Usuario:
    usuario, permisos = usuario_y_permisos
    if not permisos.get("administrador_total"):
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador")
    return usuario

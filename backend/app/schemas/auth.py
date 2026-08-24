from pydantic import BaseModel, field_validator
from typing import Optional

class LoginRequest(BaseModel):
    username: str
    codigo: str

    @field_validator("username")
    @classmethod
    def normalizar_username(cls, v):
        return v.strip().lower()

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    usuario_id: int
    nombre: str
    username: str
    rol: str
    permisos: dict
    rubro: Optional[str] = "FARMACIA"

class SetupRequest(BaseModel):
    admin_nombre: str
    admin_username: str
    admin_codigo: str
    empresa_nombre: str
    empresa_nit: Optional[str] = ""
    empresa_telefono: Optional[str] = ""
    empresa_ciudad: Optional[str] = ""
    empresa_direccion: Optional[str] = ""
    rubro: Optional[str] = "FARMACIA"

    @field_validator("admin_codigo")
    @classmethod
    def validar_codigo(cls, v):
        if len(v.strip()) < 4:
            raise ValueError("El código debe tener al menos 4 caracteres")
        return v

class UsuarioCreate(BaseModel):
    nombre: str
    username: str
    codigo: str
    rol_id: int

class UsuarioOut(BaseModel):
    id: int
    nombre: str
    username: str
    rol_id: int
    rol_nombre: Optional[str] = None
    activo: bool
    model_config = {"from_attributes": True}

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
    empresa_id: Optional[int] = 1
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
    pais: Optional[str] = "Colombia"
    zona_horaria: Optional[str] = "America/Bogota"

    @field_validator("admin_codigo")
    @classmethod
    def validar_codigo(cls, v):
        if len(v.strip()) < 4:
            raise ValueError("El código debe tener al menos 4 caracteres")
        return v

class UsuarioCreate(BaseModel):
    nombre: str
    username: str
    email: Optional[str] = None
    codigo: str
    rol_nombre: Optional[str] = "VENDEDOR"  # ADMINISTRADOR | VENDEDOR | CAJERO | CONTADOR
    rol_id: Optional[int] = None
    permisos: Optional[dict] = None
    activo: bool = True

    @field_validator("codigo")
    @classmethod
    def validar_codigo(cls, v):
        if len(v.strip()) < 4:
            raise ValueError("La contraseña o PIN debe tener al menos 4 caracteres")
        return v

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    codigo: Optional[str] = None
    rol_nombre: Optional[str] = None
    rol_id: Optional[int] = None
    permisos: Optional[dict] = None
    activo: Optional[bool] = None

class UsuarioOut(BaseModel):
    id: int
    nombre: str
    username: str
    email: Optional[str] = None
    rol_id: int
    rol_nombre: Optional[str] = None
    permisos: Optional[dict] = None
    activo: bool
    ultimo_acceso: Optional[str] = None
    created_at: Optional[str] = None
    model_config = {"from_attributes": True}

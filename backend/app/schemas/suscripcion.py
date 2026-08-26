from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

class PlanPublicoOut(BaseModel):
    id: int
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    precio_mensual: Decimal
    precio_anual: Decimal
    limite_productos: int
    limite_usuarios: int
    limite_facturas_mes: int
    permite_multisede: bool
    permite_importador_pdf: bool
    permite_fracciones: bool
    caracteristicas: str # JSON list
    destacado: bool
    orden: int

    class Config:
        from_attributes = True

class RegistroEmpresaRequest(BaseModel):
    # Datos de la Empresa
    empresa_nombre: str = Field(..., min_length=2, max_length=200)
    empresa_nit: Optional[str] = ""
    empresa_ciudad: Optional[str] = ""
    empresa_telefono: Optional[str] = ""
    empresa_direccion: Optional[str] = ""
    rubro: str = Field(default="FARMACIA") # FARMACIA | FERRETERIA | MINIMARKET | COMERCIO_GENERAL

    # Datos del Administrador
    admin_nombre: str = Field(..., min_length=2, max_length=100)
    admin_username: str = Field(..., min_length=3, max_length=50)
    admin_email: Optional[str] = ""
    admin_codigo: str = Field(..., min_length=4, max_length=50) # PIN o Password

    # Plan Inicial Seleccionado
    plan_codigo: str = Field(default="PRO")
    periodo: str = Field(default="MENSUAL") # MENSUAL | ANUAL

class SuscripcionOut(BaseModel):
    id: int
    plan_nombre: str
    plan_codigo: str
    estado: str
    fecha_inicio: datetime
    fecha_fin: datetime
    dias_restantes: int
    tipo_periodo: str
    es_prueba: bool

    class Config:
        from_attributes = True

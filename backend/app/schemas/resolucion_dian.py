from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class ResolucionDianBase(BaseModel):
    tipo_documento: str = "POS" # POS | FACTURA_ELECTRONICA | POS_ELECTRONICO
    numero_resolucion: str
    prefijo: str = "POS"
    rango_desde: int = 1
    rango_hasta: int = 10000
    consecutivo_actual: int = 0
    fecha_expedicion: date
    fecha_vencimiento: date
    vigencia_meses: int = 24
    clave_tecnica: Optional[str] = None
    activa: bool = True
    texto_resolucion: Optional[str] = None

class ResolucionDianCreate(ResolucionDianBase):
    pass

class ResolucionDianUpdate(BaseModel):
    tipo_documento: Optional[str] = None
    numero_resolucion: Optional[str] = None
    prefijo: Optional[str] = None
    rango_desde: Optional[int] = None
    rango_hasta: Optional[int] = None
    consecutivo_actual: Optional[int] = None
    fecha_expedicion: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    vigencia_meses: Optional[int] = None
    clave_tecnica: Optional[str] = None
    activa: Optional[bool] = None
    texto_resolucion: Optional[str] = None

class ResolucionDianOut(ResolucionDianBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, func
from app.db.database import Base

class ConfiguracionEmpresa(Base):
    __tablename__ = "configuracion_empresa"
    id = Column(Integer, primary_key=True, default=1)
    nombre = Column(String(200), default="Mi Empresa")
    nit = Column(String(20), default="")
    direccion = Column(String(300), default="")
    telefono = Column(String(20), default="")
    email = Column(String(100), default="")
    ciudad = Column(String(100), default="")
    regimen = Column(String(20), default="SIMPLIFICADO")
    logo_url = Column(String(500), default="")
    mensaje_factura = Column(String(300), default="Gracias por su compra")
    moneda_simbolo = Column(String(5), default="$")
    moneda_decimales = Column(Integer, default=0)
    factura_prefijo = Column(String(10), default="FV")
    iva_porcentaje = Column(Numeric(5, 2), default=0)
    iva_incluido = Column(Boolean, default=True)
    domicilio_corta = Column(Numeric(10, 2), default=3000)
    domicilio_media = Column(Numeric(10, 2), default=5000)
    domicilio_larga = Column(Numeric(10, 2), default=8000)
    primer_inicio = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

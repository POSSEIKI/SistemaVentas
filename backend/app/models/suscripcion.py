from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import relationship
from app.db.database import Base

class PlanSuscripcion(Base):
    __tablename__ = "planes_suscripcion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True) # BASICO | PRO | ENTERPRISE
    nombre = Column(String(100), nullable=False)
    descripcion = Column(String(300))
    precio_mensual = Column(Numeric(12, 2), nullable=False, default=0)
    precio_anual = Column(Numeric(12, 2), nullable=False, default=0)
    
    # Límites y capacidades
    limite_productos = Column(Integer, default=1000) # 0 = Ilimitado
    limite_usuarios = Column(Integer, default=2)
    limite_facturas_mes = Column(Integer, default=500) # 0 = Ilimitado
    permite_multisede = Column(Boolean, default=False)
    permite_importador_pdf = Column(Boolean, default=True)
    permite_fracciones = Column(Boolean, default=True)
    
    caracteristicas = Column(Text, default="[]") # JSON con lista de bullet points
    activo = Column(Boolean, default=True, nullable=False)
    destacado = Column(Boolean, default=False)
    orden = Column(Integer, default=1)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    suscripciones = relationship("Suscripcion", back_populates="plan")


class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(200), nullable=False)
    nit = Column(String(30), default="")
    rubro = Column(String(50), default="FARMACIA") # FARMACIA | FERRETERIA | MINIMARKET | OTRO
    slug = Column(String(100), unique=True, index=True) # subdominio o identificador unico
    email = Column(String(100))
    telefono = Column(String(30))
    direccion = Column(String(300))
    ciudad = Column(String(100))
    logo_url = Column(String(500))
    activo = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    suscripciones = relationship("Suscripcion", back_populates="empresa", cascade="all, delete-orphan")
    usuarios = relationship("Usuario", back_populates="empresa")


class Suscripcion(Base):
    __tablename__ = "suscripciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(Integer, ForeignKey("planes_suscripcion.id"), nullable=False)
    
    # PRUEBA_GRATIS | ACTIVA | VENCIDA | CANCELADA
    estado = Column(String(30), default="PRUEBA_GRATIS", nullable=False, index=True)
    
    fecha_inicio = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fecha_fin = Column(DateTime(timezone=True), nullable=False)
    dias_gracia = Column(Integer, default=3)
    renovacion_automatica = Column(Boolean, default=False)
    tipo_periodo = Column(String(20), default="MENSUAL") # MENSUAL | ANUAL | PRUEBA
    
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    empresa = relationship("Empresa", back_populates="suscripciones")
    plan = relationship("PlanSuscripcion", back_populates="suscripciones")

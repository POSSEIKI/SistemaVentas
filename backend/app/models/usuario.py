from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Rol(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(50), unique=True, nullable=False)
    descripcion = Column(String(200))
    permisos = Column(Text, default="{}")
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    usuarios = relationship("Usuario", back_populates="rol")

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(150), nullable=True, index=True)
    codigo_hash = Column(String(255), nullable=False)
    rol_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="SET NULL"), nullable=True)
    activo = Column(Boolean, default=True, nullable=False)
    ultimo_acceso = Column(DateTime(timezone=True))
    intentos_fallidos = Column(Integer, default=0, nullable=False)
    bloqueado = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    rol = relationship("Rol", back_populates="usuarios")
    empresa = relationship("Empresa", back_populates="usuarios")
    sesiones = relationship("Sesion", back_populates="usuario")
    facturas = relationship("Factura", back_populates="usuario", foreign_keys="[Factura.usuario_id]")

class Sesion(Base):
    __tablename__ = "sesiones"
    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    inicio = Column(DateTime(timezone=True), server_default=func.now())
    fin = Column(DateTime(timezone=True))
    activa = Column(Boolean, default=True, nullable=False)
    usuario = relationship("Usuario", back_populates="sesiones")

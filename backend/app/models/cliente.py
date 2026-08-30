from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Cliente(Base):
    __tablename__ = "clientes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=True, index=True)
    nombre = Column(String(200), nullable=False, index=True)
    nit = Column(String(20), index=True)
    tipo_doc = Column(String(10), default="CC", nullable=False)
    direccion = Column(String(300))
    telefono = Column(String(20))
    email = Column(String(100))
    ciudad = Column(String(100))
    notas = Column(Text)
    cupo_credito = Column(Numeric(12, 2), default=0)
    saldo_pendiente = Column(Numeric(12, 2), default=0)
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    facturas = relationship("Factura", back_populates="cliente")

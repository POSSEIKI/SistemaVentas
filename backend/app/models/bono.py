from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import relationship
from app.db.database import Base

class BonoCliente(Base):
    __tablename__ = "bonos_cliente"
    id = Column(Integer, primary_key=True, autoincrement=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False, index=True)
    factura_origen_id = Column(Integer, ForeignKey("facturas.id", ondelete="SET NULL"))
    monto_inicial = Column(Numeric(12, 2), nullable=False, default=0)
    saldo_disponible = Column(Numeric(12, 2), nullable=False, default=0)
    motivo = Column(Text)
    tipo_reembolso = Column(String(20), default="BONO", nullable=False)  # BONO | EFECTIVO
    estado = Column(String(20), default="ACTIVO", nullable=False)        # ACTIVO | REDIMIDO | ANULADO
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cliente = relationship("Cliente", backref="bonos")
    factura_origen = relationship("Factura", foreign_keys=[factura_origen_id])
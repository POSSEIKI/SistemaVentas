from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, Text, func
from app.db.database import Base

class ResolucionDian(Base):
    __tablename__ = "resoluciones_dian"

    id = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=True, index=True)
    tipo_documento = Column(String(50), default="POS", nullable=False) # POS | FACTURA_ELECTRONICA | POS_ELECTRONICO
    numero_resolucion = Column(String(100), nullable=False)
    prefijo = Column(String(10), default="POS", nullable=False)
    rango_desde = Column(Integer, default=1, nullable=False)
    rango_hasta = Column(Integer, default=10000, nullable=False)
    consecutivo_actual = Column(Integer, default=0, nullable=False)
    fecha_expedicion = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date, nullable=False)
    vigencia_meses = Column(Integer, default=24, nullable=False)
    clave_tecnica = Column(String(255), nullable=True)
    activa = Column(Boolean, default=True, nullable=False)
    texto_resolucion = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Factura(Base):
    __tablename__ = "facturas"
    id = Column(Integer, primary_key=True, autoincrement=True)
    numero = Column(String(20), unique=True, nullable=False, index=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    descuento_valor = Column(Numeric(12, 2), nullable=False, default=0)
    iva_valor = Column(Numeric(12, 2), nullable=False, default=0)
    domicilio_valor = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    forma_pago = Column(String(20), nullable=False)
    valor_recibido = Column(Numeric(12, 2), default=0)
    cambio = Column(Numeric(12, 2), default=0)
    observaciones = Column(Text)
    estado = Column(String(20), default="EMITIDA", nullable=False)
    anulada_por = Column(Integer, ForeignKey("usuarios.id"))
    anulada_en = Column(DateTime(timezone=True))
    motivo_anulacion = Column(Text)
    # Campos de Facturación Electrónica DIAN / Factus
    cufe = Column(String(255), nullable=True, index=True)
    qr_cadena = Column(Text, nullable=True)
    qr_imagen_base64 = Column(Text, nullable=True)
    dian_estado = Column(String(30), default="NO_ENVIADA", nullable=False) # NO_ENVIADA | VALIDADA | RECHAZADA | PENDIENTE
    dian_xml_url = Column(Text, nullable=True)
    dian_pdf_url = Column(Text, nullable=True)
    dian_errores = Column(Text, nullable=True)
    dian_numero_oficial = Column(String(50), nullable=True)
    resolucion_id = Column(Integer, ForeignKey("resoluciones_dian.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    cliente = relationship("Cliente", back_populates="facturas")
    usuario = relationship("Usuario", back_populates="facturas", foreign_keys=[usuario_id])
    lineas = relationship("FacturaDetalle", back_populates="factura", cascade="all, delete-orphan")

class FacturaDetalle(Base):
    __tablename__ = "factura_detalle"
    id = Column(Integer, primary_key=True, autoincrement=True)
    factura_id = Column(Integer, ForeignKey("facturas.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    cantidad = Column(Numeric(12, 3), nullable=False)
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    descuento_porcentaje = Column(Numeric(5, 2), default=0)
    descuento_valor = Column(Numeric(12, 2), default=0)
    iva_porcentaje = Column(Numeric(5, 2), default=0)
    iva_valor = Column(Numeric(12, 2), default=0)
    subtotal = Column(Numeric(12, 2), nullable=False)
    total_linea = Column(Numeric(12, 2), nullable=False)
    presentacion = Column(String(20), default="UNIDAD")  # CAJA | BLISTER | UNIDAD | DIRECTO
    factor_multiplicador = Column(Numeric(12, 3), default=1)
    es_encargo = Column(Boolean, default=False, nullable=False)
    factura = relationship("Factura", back_populates="lineas")
    producto = relationship("Producto", back_populates="detalle_facturas")

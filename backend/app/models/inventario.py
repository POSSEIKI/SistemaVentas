from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Proveedor(Base):
    __tablename__ = "proveedores"
    id = Column(Integer, primary_key=True, autoincrement=True)
    razon_social = Column(String(200), nullable=False)
    nit = Column(String(20), unique=True)
    contacto = Column(String(100))
    telefono = Column(String(20))
    email = Column(String(100))
    direccion = Column(String(300))
    ciudad = Column(String(100))
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    compras = relationship("Compra", back_populates="proveedor")

class Compra(Base):
    __tablename__ = "compras"
    id = Column(Integer, primary_key=True, autoincrement=True)
    numero = Column(String(20), unique=True, nullable=False)
    fecha = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"))
    numero_factura_proveedor = Column(String(50))
    subtotal = Column(Numeric(12, 2), default=0)
    iva_valor = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), default=0)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    observaciones = Column(Text)
    estado = Column(String(20), default="RECIBIDA", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    proveedor = relationship("Proveedor", back_populates="compras")
    lineas = relationship("CompraDetalle", back_populates="compra", cascade="all, delete-orphan")

class CompraDetalle(Base):
    __tablename__ = "compra_detalle"
    id = Column(Integer, primary_key=True, autoincrement=True)
    compra_id = Column(Integer, ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    cantidad = Column(Numeric(12, 3), nullable=False)
    costo_unitario = Column(Numeric(12, 2), nullable=False)
    iva_porcentaje = Column(Numeric(5, 2), default=0)
    iva_valor = Column(Numeric(12, 2), default=0)
    subtotal = Column(Numeric(12, 2), nullable=False)
    precio_sugerido = Column(Numeric(12, 2))
    compra = relationship("Compra", back_populates="lineas")
    producto = relationship("Producto")

class MovimientoInventario(Base):
    __tablename__ = "movimientos_inventario"
    id = Column(Integer, primary_key=True, autoincrement=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False, index=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    tipo = Column(String(20), nullable=False)  # ENTRADA|SALIDA|AJUSTE|DEVOLUCION
    cantidad = Column(Numeric(12, 3), nullable=False)
    stock_anterior = Column(Numeric(12, 3), nullable=False)
    stock_nuevo = Column(Numeric(12, 3), nullable=False)
    referencia_tipo = Column(String(20))
    referencia_id = Column(Integer)
    costo_unitario = Column(Numeric(12, 2))
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    observacion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    producto = relationship("Producto", back_populates="movimientos")

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Categoria(Base):
    __tablename__ = "categorias"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), unique=True, nullable=False)
    descripcion = Column(String(300))
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    productos = relationship("Producto", back_populates="categoria")

class UnidadMedida(Base):
    __tablename__ = "unidades_medida"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(50), unique=True, nullable=False)
    abreviatura = Column(String(10), unique=True, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    productos = relationship("Producto", back_populates="unidad_medida")

class Producto(Base):
    __tablename__ = "productos"
    id = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=True, index=True)
    codigo = Column(String(50), nullable=False, index=True)
    codigo_barras = Column(String(50), index=True)
    codigo_barras_blister = Column(String(50), index=True)
    codigo_barras_unidad = Column(String(50), index=True)
    nombre = Column(String(200), nullable=False, index=True)
    descripcion = Column(Text)
    categoria_id = Column(Integer, ForeignKey("categorias.id"))
    unidad_medida_id = Column(Integer, ForeignKey("unidades_medida.id"), default=1)
    precio_venta = Column(Numeric(12, 2), nullable=False, default=0)
    precio_costo = Column(Numeric(12, 2), nullable=False, default=0)
    iva_porcentaje = Column(Numeric(5, 2), nullable=False, default=0)
    afecta_inventario = Column(Boolean, default=True, nullable=False)
    es_servicio = Column(Boolean, default=False, nullable=False)
    stock_minimo = Column(Numeric(12, 3), nullable=False, default=0)
    stock_actual = Column(Numeric(12, 3), nullable=False, default=0)
    imagen_url = Column(String(500))
    activo = Column(Boolean, default=True, nullable=False)

    # Fraccionamiento y Multi-Presentación
    maneja_fracciones = Column(Boolean, default=False, nullable=False)
    contenido_caja = Column(Integer, default=1, nullable=False)
    contenido_blister = Column(Integer, default=0, nullable=False)
    precio_caja = Column(Numeric(12, 2), default=0, nullable=False)
    precio_blister = Column(Numeric(12, 2), default=0, nullable=False)
    precio_unidad = Column(Numeric(12, 2), default=0, nullable=False)

    # Atributos adicionales de búsqueda y clasificación
    laboratorio = Column(String(100))
    principio_activo = Column(String(200))
    ubicacion = Column(String(50))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    categoria = relationship("Categoria", back_populates="productos")
    unidad_medida = relationship("UnidadMedida", back_populates="productos")
    detalle_facturas = relationship("FacturaDetalle", back_populates="producto")
    movimientos = relationship("MovimientoInventario", back_populates="producto")

from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

# ─── Productos ───────────────────────────────────────────────────────────────

class ProductoCreate(BaseModel):
    codigo: str
    nombre: str
    categoria_id: Optional[int] = None
    unidad_medida_id: Optional[int] = 1
    precio_venta: Decimal = Decimal("0")
    precio_costo: Decimal = Decimal("0")
    iva_porcentaje: Decimal = Decimal("0")
    afecta_inventario: bool = True
    es_servicio: bool = False
    stock_minimo: Decimal = Decimal("0")
    stock_actual: Decimal = Decimal("0")
    descripcion: Optional[str] = None
    codigo_barras: Optional[str] = None
    codigo_barras_blister: Optional[str] = None
    codigo_barras_unidad: Optional[str] = None

    # Fraccionamiento y Multi-Presentación
    maneja_fracciones: bool = False
    contenido_caja: int = 1
    contenido_blister: int = 0
    precio_caja: Decimal = Decimal("0")
    precio_blister: Decimal = Decimal("0")
    precio_unidad: Decimal = Decimal("0")

    # Clasificación
    laboratorio: Optional[str] = None
    principio_activo: Optional[str] = None
    ubicacion: Optional[str] = None

class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria_id: Optional[int] = None
    unidad_medida_id: Optional[int] = None
    precio_venta: Optional[Decimal] = None
    precio_costo: Optional[Decimal] = None
    iva_porcentaje: Optional[Decimal] = None
    stock_minimo: Optional[Decimal] = None
    stock_actual: Optional[Decimal] = None
    activo: Optional[bool] = None
    descripcion: Optional[str] = None
    codigo_barras: Optional[str] = None
    codigo_barras_blister: Optional[str] = None
    codigo_barras_unidad: Optional[str] = None

    maneja_fracciones: Optional[bool] = None
    contenido_caja: Optional[int] = None
    contenido_blister: Optional[int] = None
    precio_caja: Optional[Decimal] = None
    precio_blister: Optional[Decimal] = None
    precio_unidad: Optional[Decimal] = None

    laboratorio: Optional[str] = None
    principio_activo: Optional[str] = None
    ubicacion: Optional[str] = None

class ProductoOut(BaseModel):
    id: int
    codigo: str
    codigo_barras: Optional[str] = None
    codigo_barras_blister: Optional[str] = None
    codigo_barras_unidad: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    precio_venta: Decimal
    precio_costo: Decimal
    iva_porcentaje: Decimal
    stock_actual: Decimal
    stock_minimo: Decimal
    afecta_inventario: bool
    es_servicio: bool
    activo: bool
    categoria_id: Optional[int] = None
    categoria_nombre: Optional[str] = None
    unidad_medida_id: Optional[int] = None
    unidad_abreviatura: Optional[str] = None

    maneja_fracciones: bool = False
    contenido_caja: int = 1
    contenido_blister: int = 0
    precio_caja: Decimal = Decimal("0")
    precio_blister: Decimal = Decimal("0")
    precio_unidad: Decimal = Decimal("0")

    laboratorio: Optional[str] = None
    principio_activo: Optional[str] = None
    ubicacion: Optional[str] = None
    model_config = {"from_attributes": True}

class PaginatedProductosOut(BaseModel):
    items: List[ProductoOut]
    total: int
    pagina: int
    limite: int
    total_paginas: int

# ─── Clientes ─────────────────────────────────────────────────────────────────

class ClienteCreate(BaseModel):
    nombre: str
    nit: Optional[str] = None
    tipo_doc: str = "CC"
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    ciudad: Optional[str] = None
    notas: Optional[str] = None

class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    nit: Optional[str] = None
    tipo_doc: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    ciudad: Optional[str] = None
    notas: Optional[str] = None
    activo: Optional[bool] = None

class ClienteOut(BaseModel):
    id: int
    nombre: str
    nit: Optional[str] = None
    tipo_doc: str
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    ciudad: Optional[str] = None
    notas: Optional[str] = None
    activo: bool
    model_config = {"from_attributes": True}

# ─── Facturas ─────────────────────────────────────────────────────────────────

class LineaFacturaCreate(BaseModel):
    producto_id: int
    cantidad: Decimal
    precio_unitario: Decimal
    descuento_porcentaje: Decimal = Decimal("0")
    presentacion: str = "UNIDAD"  # CAJA | BLISTER | UNIDAD | DIRECTO
    factor_multiplicador: Decimal = Decimal("1")
    es_encargo: bool = False

class FacturaCreate(BaseModel):
    cliente_id: int
    lineas: List[LineaFacturaCreate]
    forma_pago: str  # EFECTIVO|TARJETA|CREDITO|CONTRAENTREGA|BONO
    valor_recibido: Decimal = Decimal("0")
    domicilio_valor: Decimal = Decimal("0")
    observaciones: Optional[str] = None
    bono_codigo: Optional[str] = None
    bono_monto_aplicado: Optional[Decimal] = Decimal("0")

class LineaFacturaOut(BaseModel):
    id: int
    producto_id: int
    producto_nombre: Optional[str] = None
    cantidad: Decimal
    precio_unitario: Decimal
    descuento_porcentaje: Decimal
    descuento_valor: Decimal
    iva_porcentaje: Decimal
    iva_valor: Decimal
    subtotal: Decimal
    total_linea: Decimal
    presentacion: str = "UNIDAD"
    factor_multiplicador: Decimal = Decimal("1")
    es_encargo: bool = False
    model_config = {"from_attributes": True}

class FacturaOut(BaseModel):
    id: int
    numero: str
    cliente_id: int
    cliente_nombre: Optional[str] = None
    usuario_id: int
    subtotal: Decimal
    descuento_valor: Decimal
    iva_valor: Decimal
    domicilio_valor: Decimal
    total: Decimal
    forma_pago: str
    valor_recibido: Decimal
    cambio: Decimal
    estado: str
    observaciones: Optional[str] = None
    lineas: List[LineaFacturaOut] = []
    model_config = {"from_attributes": True}

class AnularFacturaRequest(BaseModel):
    motivo: str

class DevolucionFacturaRequest(BaseModel):
    motivo: str
    tipo_reembolso: str = "BONO"  # "BONO" | "EFECTIVO"

class BonoClienteOut(BaseModel):
    id: int
    codigo: str
    cliente_id: int
    cliente_nombre: Optional[str] = None
    monto_inicial: Decimal
    saldo_disponible: Decimal
    motivo: Optional[str] = None
    tipo_reembolso: str
    estado: str
    model_config = {"from_attributes": True}

# ─── Compras ──────────────────────────────────────────────────────────────────

class LineaCompraCreate(BaseModel):
    producto_id: int
    cantidad: Decimal
    costo_unitario: Decimal
    iva_porcentaje: Decimal = Decimal("0")
    precio_sugerido: Optional[Decimal] = None
    maneja_fracciones: Optional[bool] = None
    contenido_caja: Optional[int] = None
    contenido_blister: Optional[int] = None
    precio_caja: Optional[Decimal] = None
    precio_blister: Optional[Decimal] = None
    precio_unidad: Optional[Decimal] = None
    codigo_barras: Optional[str] = None
    codigo_barras_blister: Optional[str] = None
    codigo_barras_unidad: Optional[str] = None

class CompraCreate(BaseModel):
    proveedor_id: Optional[int] = None
    numero_factura_proveedor: Optional[str] = None
    lineas: List[LineaCompraCreate]
    observaciones: Optional[str] = None

# ─── Proveedores ──────────────────────────────────────────────────────────────

class ProveedorBase(BaseModel):
    razon_social: str
    nit: Optional[str] = None
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None

class ProveedorCreate(ProveedorBase):
    pass

class ProveedorUpdate(BaseModel):
    razon_social: Optional[str] = None
    nit: Optional[str] = None
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    activo: Optional[bool] = None

class ProveedorOut(ProveedorBase):
    id: int
    activo: bool
    model_config = {"from_attributes": True}

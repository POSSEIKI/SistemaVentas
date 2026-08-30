from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, func
from app.db.database import Base

class ConfiguracionEmpresa(Base):
    __tablename__ = "configuracion_empresa"
    id = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=True, index=True)
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
    domicilio_tarifa_base = Column(Numeric(10, 2), default=4000)
    domicilio_costo_por_km = Column(Numeric(10, 2), default=1500)
    domicilio_gratis_desde = Column(Numeric(12, 2), default=0)
    rubro = Column(String(50), default="FARMACIA")
    margen_ganancia_predeterminado = Column(Numeric(5, 2), default=30.00)
    modo_redondeo = Column(String(30), default="CENTENA_100")
    formato_impresion = Column(String(20), default="80MM")
    resolucion_dian = Column(String(300), default="")
    pais = Column(String(100), default="Colombia")
    zona_horaria = Column(String(100), default="America/Bogota")
    primer_inicio = Column(Boolean, default=True)
    # Facturación Electrónica DIAN / Factus
    fe_habilitada = Column(Boolean, default=False)
    fe_proveedor = Column(String(50), default="FACTUS")
    fe_ambiente = Column(String(20), default="SANDBOX") # SANDBOX | PRODUCCION
    fe_client_id = Column(String(255), default="")
    fe_client_secret = Column(String(255), default="")
    fe_token = Column(String(1000), default="")
    fe_rango_id = Column(String(50), default="")
    fe_tipo_documento = Column(String(50), default="POS_ELECTRONICO") # POS_ELECTRONICO | FACTURA_ELECTRONICA
    fe_municipio_id = Column(String(20), default="980") # Código DANE municipio (default Bogotá 980)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


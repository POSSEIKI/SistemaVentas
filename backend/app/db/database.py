from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

connect_args = {}
if "localhost" not in settings.DATABASE_URL and "127.0.0.1" not in settings.DATABASE_URL:
    connect_args["ssl"] = "require"

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession,
    expire_on_commit=False, autocommit=False, autoflush=False,
)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db() -> None:
    import asyncio
    max_retries = 5
    for attempt in range(1, max_retries + 1):
        try:
            async with engine.begin() as conn:
                from app.models import (  # noqa
                    usuario, producto, cliente, factura, inventario, configuracion, suscripcion, resolucion_dian,
                )
                await conn.run_sync(Base.metadata.create_all)

                # Migraciones seguras para columnas añadidas a tablas existentes
                from sqlalchemy import text
                await conn.execute(text("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL;"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE;"))
                await conn.execute(text("ALTER TABLE productos ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE;"))
                await conn.execute(text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE;"))
                await conn.execute(text("ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE;"))
                await conn.execute(text("ALTER TABLE compras ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE;"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE;"))
                await conn.execute(text("ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE;"))
                await conn.execute(text("ALTER TABLE resoluciones_dian ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE;"))

                # Asignar empresa_id = 1 a datos históricos sin empresa asignada
                await conn.execute(text("UPDATE productos SET empresa_id = 1 WHERE empresa_id IS NULL;"))
                await conn.execute(text("UPDATE clientes SET empresa_id = 1 WHERE empresa_id IS NULL;"))
                await conn.execute(text("UPDATE proveedores SET empresa_id = 1 WHERE empresa_id IS NULL;"))
                await conn.execute(text("UPDATE compras SET empresa_id = 1 WHERE empresa_id IS NULL;"))
                await conn.execute(text("UPDATE facturas SET empresa_id = 1 WHERE empresa_id IS NULL;"))
                await conn.execute(text("UPDATE movimientos_inventario SET empresa_id = 1 WHERE empresa_id IS NULL;"))
                await conn.execute(text("UPDATE resoluciones_dian SET empresa_id = 1 WHERE empresa_id IS NULL;"))
                await conn.execute(text("UPDATE configuracion_empresa SET empresa_id = 1 WHERE empresa_id IS NULL;"))

                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS pais VARCHAR(100) DEFAULT 'Colombia';"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS zona_horaria VARCHAR(100) DEFAULT 'America/Bogota';"))
                # Columnas Facturación Electrónica DIAN / Factus
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS fe_habilitada BOOLEAN DEFAULT FALSE;"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS fe_proveedor VARCHAR(50) DEFAULT 'FACTUS';"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS fe_ambiente VARCHAR(20) DEFAULT 'SANDBOX';"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS fe_client_id VARCHAR(255) DEFAULT '';"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS fe_client_secret VARCHAR(255) DEFAULT '';"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS fe_token VARCHAR(1000) DEFAULT '';"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS fe_rango_id VARCHAR(50) DEFAULT '';"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS fe_tipo_documento VARCHAR(50) DEFAULT 'POS_ELECTRONICO';"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS fe_municipio_id VARCHAR(20) DEFAULT '980';"))
                # Columnas de Domicilios y Tarifas en configuracion_empresa
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS domicilio_tarifa_base NUMERIC(10, 2) DEFAULT 4000;"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS domicilio_costo_por_km NUMERIC(10, 2) DEFAULT 1500;"))
                await conn.execute(text("ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS domicilio_gratis_desde NUMERIC(12, 2) DEFAULT 0;"))
                # Columnas en facturas para CUFE y QR
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS cufe VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS qr_cadena TEXT;"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS qr_imagen_base64 TEXT;"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS dian_estado VARCHAR(30) DEFAULT 'NO_ENVIADA';"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS dian_xml_url TEXT;"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS dian_pdf_url TEXT;"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS dian_errores TEXT;"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS dian_numero_oficial VARCHAR(50);"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS resolucion_id INTEGER REFERENCES resoluciones_dian(id) ON DELETE SET NULL;"))
                # Columnas de entrega a domicilio en facturas
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS domicilio_direccion VARCHAR(300);"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS domicilio_telefono VARCHAR(50);"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS domicilio_notas TEXT;"))
                await conn.execute(text("ALTER TABLE facturas ADD COLUMN IF NOT EXISTS domicilio_distancia_km NUMERIC(6, 2);"))
            
            # Inicializar planes, unidades de medida y categorias por defecto
            try:
                from app.services.suscripcion_service import inicializar_planes_predeterminados
                from app.models.producto import UnidadMedida, Categoria
                from sqlalchemy import select

                UNIDADES_DEF = [
                    ('Unidad', 'UND'), ('Caja', 'CJ'), ('Blíster', 'BL'), ('Frasco', 'FR'),
                    ('Ampolla', 'AMP'), ('Tubo', 'TB'), ('Sobre', 'SB'), ('Paquete', 'PQ'),
                    ('Litro', 'LT'), ('Kilo', 'KG'), ('Metro', 'MT'), ('Par', 'PR')
                ]
                CATEGORIAS_DEF = ['General']

                async with AsyncSessionLocal() as session:
                    await inicializar_planes_predeterminados(session)
                    
                    for nom, abrv in UNIDADES_DEF:
                        r = await session.execute(select(UnidadMedida).where(UnidadMedida.nombre == nom))
                        if not r.scalar_one_or_none():
                            session.add(UnidadMedida(nombre=nom, abreviatura=abrv, activo=True))

                    for nom in CATEGORIAS_DEF:
                        r = await session.execute(select(Categoria).where(Categoria.nombre == nom))
                        if not r.scalar_one_or_none():
                            session.add(Categoria(nombre=nom, activo=True))

                    from app.models.cliente import Cliente
                    r_c1 = await session.execute(select(Cliente).where(Cliente.id == 1))
                    if not r_c1.scalar_one_or_none():
                        session.add(Cliente(
                            id=1,
                            nombre='CLIENTE MOSTRADOR (CONSUMIDOR FINAL)',
                            nit='222222222222',
                            tipo_doc='CC',
                            direccion='Mostrador',
                            telefono='0000000',
                            email='',
                            activo=True
                        ))

                    # Seed Rol SUPER_ADMIN y Usuario superadmin
                    from app.models.usuario import Usuario, Rol
                    from app.core.security import hash_password
                    import json

                    r_rol = await session.execute(select(Rol).where(Rol.nombre == "SUPER_ADMIN"))
                    rol_super = r_rol.scalar_one_or_none()
                    if not rol_super:
                        rol_super = Rol(
                            nombre="SUPER_ADMIN",
                            descripcion="Super Administrador Maestro de la Plataforma FACTUR-AAP",
                            permisos=json.dumps({"administrador_total": True, "super_admin": True}),
                            activo=True
                        )
                        session.add(rol_super)
                        await session.flush()

                    r_usr = await session.execute(select(Usuario).where(Usuario.username == "superadmin"))
                    if not r_usr.scalar_one_or_none():
                        session.add(Usuario(
                            nombre="Fundador FACTUR-AAP",
                            username="superadmin",
                            codigo_hash=hash_password("SuperAdmin2026*"),
                            rol_id=rol_super.id,
                            activo=True
                        ))
                    
                    await session.commit()
            except Exception as e_seed:
                logger.warning(f"No se pudieron precargar datos maestros: {e_seed}")

            logger.info("Base de datos inicializada con tablas, planes, unidades y categorias")
            return
        except Exception as e:
            logger.warning(f"Intento {attempt}/{max_retries} conectando a la BD falló ({e}). Reintentando en 1.5s...")
            if attempt == max_retries:
                logger.error("No se pudo inicializar la BD tras múltiples intentos. Continuando arranque de servidor.")
                return
            await asyncio.sleep(1.5)

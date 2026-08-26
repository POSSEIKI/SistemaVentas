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
                    usuario, producto, cliente, factura, inventario, configuracion, suscripcion,
                )
                await conn.run_sync(Base.metadata.create_all)

                # Migraciones seguras para columnas añadidas a tablas existentes
                from sqlalchemy import text
                await conn.execute(text("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL;"))
            
            # Inicializar planes por defecto si no existen
            try:
                from app.services.suscripcion_service import inicializar_planes_predeterminados
                async with AsyncSessionLocal() as session:
                    await inicializar_planes_predeterminados(session)
            except Exception as e_seed:
                logger.warning(f"No se pudieron precargar los planes: {e_seed}")

            logger.info("Base de datos inicializada con tablas y planes")
            return
        except Exception as e:
            logger.warning(f"Intento {attempt}/{max_retries} conectando a la BD falló ({e}). Reintentando en 1.5s...")
            if attempt == max_retries:
                logger.error("No se pudo inicializar la BD tras múltiples intentos. Continuando arranque de servidor.")
                return
            await asyncio.sleep(1.5)

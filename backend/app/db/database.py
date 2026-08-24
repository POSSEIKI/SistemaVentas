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
    async with engine.begin() as conn:
        from app.models import (  # noqa
            usuario, producto, cliente, factura, inventario, configuracion,
        )
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Base de datos inicializada")

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.db.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

from app.api.v1.endpoints import auth, productos, ventas, inventario, configuracion, suscripciones, resoluciones

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(productos.router, prefix=API_PREFIX)
app.include_router(ventas.router, prefix=API_PREFIX)
app.include_router(inventario.router, prefix=API_PREFIX)
app.include_router(configuracion.router, prefix=API_PREFIX)
app.include_router(suscripciones.router, prefix=API_PREFIX)
app.include_router(resoluciones.router, prefix=API_PREFIX)

@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}

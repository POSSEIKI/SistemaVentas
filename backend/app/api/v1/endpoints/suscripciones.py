from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.usuario import Usuario
from app.schemas.suscripcion import PlanPublicoOut, RegistroEmpresaRequest
from app.services import suscripcion_service

router = APIRouter(prefix="/suscripciones", tags=["Suscripciones & Planes"])

@router.get("/planes/publicos", response_model=List[PlanPublicoOut])
async def listar_planes_publicos(db: AsyncSession = Depends(get_db)):
    """Lista todos los planes de suscripción disponibles para la landing page."""
    planes = await suscripcion_service.obtener_planes_publicos(db)
    return planes

@router.post("/registro-empresa")
async def registrar_empresa(
    datos: RegistroEmpresaRequest,
    db: AsyncSession = Depends(get_db)
):
    """Permite el registro público de una nueva empresa / droguería y activa su prueba gratis de 14 días."""
    return await suscripcion_service.registrar_nueva_empresa_y_admin(datos, db)

@router.get("/mi-suscripcion")
async def obtener_mi_suscripcion(
    usuario: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retorna el estado de la suscripción de la empresa del usuario autenticado."""
    return await suscripcion_service.obtener_estado_suscripcion_usuario(usuario, db)

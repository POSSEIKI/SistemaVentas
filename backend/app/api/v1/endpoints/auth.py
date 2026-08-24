from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse, SetupRequest
from app.services import auth_service
from app.core.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.get("/setup-requerido")
async def check_setup(db: AsyncSession = Depends(get_db)):
    necesita = await auth_service.sistema_necesita_setup(db)
    return {"setup_requerido": necesita}

@router.post("/setup")
async def setup_inicial(request: SetupRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.setup_inicial(request, db)

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.login(request, db)

@router.get("/me")
async def get_me(usuario=Depends(get_current_user)):
    return {"id": usuario.id, "nombre": usuario.nombre, "username": usuario.username}

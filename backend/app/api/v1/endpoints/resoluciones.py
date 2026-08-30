from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
from datetime import date, datetime
from dateutil.relativedelta import relativedelta

from app.db.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.resolucion_dian import ResolucionDian
from app.models.configuracion import ConfiguracionEmpresa
from app.schemas.resolucion_dian import ResolucionDianCreate, ResolucionDianUpdate, ResolucionDianOut

router = APIRouter(prefix="/resoluciones", tags=["Resoluciones DIAN"])

def _generar_texto_legal(r: ResolucionDianCreate | ResolucionDian) -> str:
    fecha_exp_str = r.fecha_expedicion.strftime('%d/%m/%Y') if hasattr(r.fecha_expedicion, 'strftime') else str(r.fecha_expedicion)
    fecha_venc_str = r.fecha_vencimiento.strftime('%d/%m/%Y') if hasattr(r.fecha_vencimiento, 'strftime') else str(r.fecha_vencimiento)
    prefijo_txt = f"Prefijo {r.prefijo}" if r.prefijo else "Sin Prefijo"
    return f"Autorización DIAN N° {r.numero_resolucion} de fecha {fecha_exp_str}, {prefijo_txt} del {r.rango_desde:,} al {r.rango_hasta:,}, Vigencia {r.vigencia_meses} meses hasta {fecha_venc_str}"

@router.get("", response_model=List[ResolucionDianOut])
async def listar_resoluciones(
    tipo: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    query = select(ResolucionDian).where(ResolucionDian.empresa_id == empresa_id).order_by(ResolucionDian.activa.desc(), ResolucionDian.id.desc())
    if tipo:
        query = query.where(ResolucionDian.tipo_documento == tipo)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/activa", response_model=Optional[ResolucionDianOut])
async def get_resolucion_activa(
    tipo: str = "POS",
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    empresa_id = current_user.empresa_id or 1
    result = await db.execute(
        select(ResolucionDian)
        .where(
            ResolucionDian.empresa_id == empresa_id,
            ResolucionDian.activa == True,
            ResolucionDian.tipo_documento == tipo
        )
        .order_by(ResolucionDian.id.desc())
    )
    return result.scalars().first()

@router.post("", response_model=ResolucionDianOut)
async def crear_resolucion(
    datos: ResolucionDianCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    empresa_id = current_user.empresa_id or 1
    # Si viene marcada como activa, desactivar las demás del mismo tipo en esta empresa
    if datos.activa:
        await db.execute(
            update(ResolucionDian)
            .where(
                ResolucionDian.empresa_id == empresa_id,
                ResolucionDian.tipo_documento == datos.tipo_documento
            )
            .values(activa=False)
        )
    
    # Calcular texto legal si no viene
    texto = datos.texto_resolucion or _generar_texto_legal(datos)
    
    # Consecutivo inicial
    consecutivo = datos.consecutivo_actual
    if consecutivo <= 0:
        consecutivo = max(0, datos.rango_desde - 1)
        
    resolucion = ResolucionDian(
        empresa_id=empresa_id,
        tipo_documento=datos.tipo_documento,
        numero_resolucion=datos.numero_resolucion.strip(),
        prefijo=(datos.prefijo or "").strip().upper(),
        rango_desde=datos.rango_desde,
        rango_hasta=datos.rango_hasta,
        consecutivo_actual=consecutivo,
        fecha_expedicion=datos.fecha_expedicion,
        fecha_vencimiento=datos.fecha_vencimiento,
        vigencia_meses=datos.vigencia_meses,
        clave_tecnica=datos.clave_tecnica.strip() if datos.clave_tecnica else None,
        activa=datos.activa,
        texto_resolucion=texto,
    )
    db.add(resolucion)
    await db.commit()
    await db.refresh(resolucion)
    
    # Si quedó activa, sincronizar con ConfiguracionEmpresa de esta empresa
    if resolucion.activa:
        res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.empresa_id == empresa_id).order_by(ConfiguracionEmpresa.id.desc()))
        cfg = res_cfg.scalars().first()
        if not cfg and empresa_id == 1:
            res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
            cfg = res_cfg.scalars().first()
        if cfg:
            cfg.resolucion_dian = resolucion.texto_resolucion
            cfg.factura_prefijo = resolucion.prefijo
            await db.commit()
            
    return resolucion

@router.post("/{resolucion_id}/activar", response_model=ResolucionDianOut)
async def activar_resolucion(
    resolucion_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    empresa_id = current_user.empresa_id or 1
    result = await db.execute(
        select(ResolucionDian).where(
            ResolucionDian.id == resolucion_id,
            ResolucionDian.empresa_id == empresa_id
        )
    )
    resolucion = result.scalar_one_or_none()
    if not resolucion:
        raise HTTPException(status_code=404, detail="Resolución no encontrada")
        
    # Desactivar otras del mismo tipo en esta empresa
    await db.execute(
        update(ResolucionDian)
        .where(
            ResolucionDian.empresa_id == empresa_id,
            ResolucionDian.tipo_documento == resolucion.tipo_documento
        )
        .values(activa=False)
    )
    
    resolucion.activa = True
    await db.commit()
    await db.refresh(resolucion)
    
    # Sincronizar en empresa
    res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.empresa_id == empresa_id).order_by(ConfiguracionEmpresa.id.desc()))
    cfg = res_cfg.scalars().first()
    if not cfg and empresa_id == 1:
        res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
        cfg = res_cfg.scalars().first()
    if cfg:
        cfg.resolucion_dian = resolucion.texto_resolucion or _generar_texto_legal(resolucion)
        cfg.factura_prefijo = resolucion.prefijo
        await db.commit()
        
    return resolucion

@router.patch("/{resolucion_id}", response_model=ResolucionDianOut)
async def actualizar_resolucion(
    resolucion_id: int,
    datos: ResolucionDianUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    empresa_id = current_user.empresa_id or 1
    result = await db.execute(
        select(ResolucionDian).where(
            ResolucionDian.id == resolucion_id,
            ResolucionDian.empresa_id == empresa_id
        )
    )
    resolucion = result.scalar_one_or_none()
    if not resolucion:
        raise HTTPException(status_code=404, detail="Resolución no encontrada")
        
    dict_datos = datos.model_dump(exclude_unset=True)
    if dict_datos.get("activa") is True:
        await db.execute(
            update(ResolucionDian)
            .where(
                ResolucionDian.empresa_id == empresa_id,
                ResolucionDian.tipo_documento == resolucion.tipo_documento,
                ResolucionDian.id != resolucion_id
            )
            .values(activa=False)
        )
        
    for k, v in dict_datos.items():
        setattr(resolucion, k, v)
        
    resolucion.texto_resolucion = _generar_texto_legal(resolucion)
    await db.commit()
    await db.refresh(resolucion)
    
    if resolucion.activa:
        res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.empresa_id == empresa_id).order_by(ConfiguracionEmpresa.id.desc()))
        cfg = res_cfg.scalars().first()
        if not cfg and empresa_id == 1:
            res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
            cfg = res_cfg.scalars().first()
        if cfg:
            cfg.resolucion_dian = resolucion.texto_resolucion
            cfg.factura_prefijo = resolucion.prefijo
            await db.commit()
            
    return resolucion

@router.delete("/{resolucion_id}")
async def eliminar_resolucion(
    resolucion_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    empresa_id = current_user.empresa_id or 1
    result = await db.execute(
        select(ResolucionDian).where(
            ResolucionDian.id == resolucion_id,
            ResolucionDian.empresa_id == empresa_id
        )
    )
    resolucion = result.scalar_one_or_none()
    if not resolucion:
        raise HTTPException(status_code=404, detail="Resolución no encontrada")
        
    await db.delete(resolucion)
    await db.commit()
    return {"mensaje": "Resolución eliminada"}

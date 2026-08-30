import logging
import json
import httpx
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload

from app.models.configuracion import ConfiguracionEmpresa
from app.models.factura import Factura, FacturaDetalle
from app.models.cliente import Cliente

logger = logging.getLogger(__name__)

URL_SANDBOX = "https://api-sandbox.factus.com.co"
URL_PRODUCCION = "https://api.factus.com.co"

def _obtener_base_url(ambiente: str) -> str:
    if (ambiente or "").upper() == "PRODUCCION":
        return URL_PRODUCCION
    return URL_SANDBOX

async def autenticar_factus(client_id: str, client_secret: str, ambiente: str = "SANDBOX") -> Dict[str, Any]:
    base_url = _obtener_base_url(ambiente)
    url = f"{base_url}/oauth/token"
    
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id.strip(),
        "client_secret": client_secret.strip(),
    }
    
    async with httpx.AsyncClient(timeout=25.0) as client:
        try:
            response = await client.post(url, data=payload)
            data = response.json()
            
            if response.status_code != 200:
                error_msg = data.get("message") or data.get("error_description") or response.text
                return {"exito": False, "mensaje": f"Error de autenticación Factus: {error_msg}"}
            
            return {
                "exito": True,
                "access_token": data.get("access_token"),
                "token_type": data.get("token_type", "Bearer"),
                "expires_in": data.get("expires_in"),
            }
        except Exception as e:
            logger.error(f"Error conectando con Factus OAuth: {str(e)}")
            return {"exito": False, "mensaje": f"No se pudo conectar con los servidores de Factus: {str(e)}"}

async def obtener_rangos_numeracion(client_id: str, client_secret: str, ambiente: str = "SANDBOX") -> Dict[str, Any]:
    auth = await autenticar_factus(client_id, client_secret, ambiente)
    if not auth["exito"]:
        return auth
    
    base_url = _obtener_base_url(ambiente)
    url = f"{base_url}/v1/numbering-ranges"
    headers = {
        "Authorization": f"Bearer {auth['access_token']}",
        "Accept": "application/json",
    }
    
    async with httpx.AsyncClient(timeout=25.0) as client:
        try:
            response = await client.get(url, headers=headers)
            data = response.json()
            
            if response.status_code != 200:
                return {"exito": False, "mensaje": data.get("message", "Error al consultar rangos")}
            
            rangos = data.get("data", [])
            return {"exito": True, "rangos": rangos}
        except Exception as e:
            return {"exito": False, "mensaje": f"Error al consultar rangos en Factus: {str(e)}"}

async def probar_conexion(client_id: str, client_secret: str, ambiente: str = "SANDBOX") -> Dict[str, Any]:
    if not client_id or not client_secret:
        return {"exito": False, "mensaje": "Debe proporcionar Client ID y Client Secret"}
    
    auth = await autenticar_factus(client_id, client_secret, ambiente)
    if not auth["exito"]:
        return auth
    
    rangos_res = await obtener_rangos_numeracion(client_id, client_secret, ambiente)
    return {
        "exito": True,
        "mensaje": f"✓ Conexión exitosa con Factus ({ambiente})",
        "rangos": rangos_res.get("rangos", []) if rangos_res.get("exito") else []
    }

def _mapear_tipo_documento_id(nit_o_cedula: str) -> str:
    limpio = (nit_o_cedula or "").strip()
    if limpio == "222222222222" or not limpio:
        return "3"
    if len(limpio) >= 9 and "-" in limpio:
        return "6"
    if len(limpio) == 9 and limpio.isdigit():
        return "6"
    return "3"

def _mapear_medio_pago(forma_pago: str) -> str:
    fp = (forma_pago or "").upper()
    if "DEBITO" in fp:
        return "49"
    if "CREDITO" in fp or "TARJETA" in fp:
        return "48"
    if "TRANSFERENCIA" in fp or "NEQUI" in fp or "DAVIPLATA" in fp:
        return "31"
    return "10"

async def enviar_factura_a_dian(factura_id: int, db: AsyncSession) -> Dict[str, Any]:
    query = (
        select(Factura)
        .options(
            joinedload(Factura.cliente),
            selectinload(Factura.lineas).joinedload(FacturaDetalle.producto)
        )
        .where(Factura.id == factura_id)
    )
    res_fac = await db.execute(query)
    factura = res_fac.scalar_one_or_none()
    
    if not factura:
        return {"exito": False, "mensaje": "Factura no encontrada"}

    res_cfg = await db.execute(
        select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.empresa_id == empresa_id).order_by(ConfiguracionEmpresa.id.desc())
    )
    cfg = res_cfg.scalars().first()
    if not cfg and empresa_id == 1:
        res_cfg = await db.execute(select(ConfiguracionEmpresa).where(ConfiguracionEmpresa.id == 1))
        cfg = res_cfg.scalars().first()
    
    if not cfg or not cfg.fe_habilitada:
        return {"exito": False, "mensaje": "La Facturación Electrónica DIAN no está habilitada en los parámetros"}
    
    if not cfg.fe_client_id or not cfg.fe_client_secret:
        return {"exito": False, "mensaje": "Faltan las credenciales de Factus (Client ID o Client Secret)"}
    
    if factura.dian_estado == "VALIDADA" and factura.cufe:
        return {
            "exito": True,
            "mensaje": "La factura ya fue validada previamente por la DIAN",
            "cufe": factura.cufe,
            "qr": factura.qr_cadena,
            "numero_dian": factura.dian_numero_oficial,
        }
    
    auth = await autenticar_factus(cfg.fe_client_id, cfg.fe_client_secret, cfg.fe_ambiente)
    if not auth["exito"]:
        factura.dian_estado = "RECHAZADA"
        factura.dian_errores = auth["mensaje"]
        await db.commit()
        return auth
    
    token = auth["access_token"]
    base_url = _obtener_base_url(cfg.fe_ambiente)
    
    cliente = factura.cliente
    nit_doc = cliente.nit if cliente and cliente.nit else "222222222222"
    nombre_cli = cliente.nombre if cliente and cliente.nombre else "CONSUMIDOR FINAL"
    email_cli = cliente.email if cliente and cliente.email else (cfg.email or "facturacion@empresa.com")
    tel_cli = cliente.telefono if cliente and cliente.telefono else (cfg.telefono or "3000000000")
    dir_cli = cliente.direccion if cliente and cliente.direccion else (cfg.direccion or "Calle Principal")
    doc_id = _mapear_tipo_documento_id(nit_doc)
    
    items_payload = []
    for l in (factura.lineas or []):
        prod = l.producto
        iva_pct = float(l.iva_porcentaje or 0)
        costo_linea = float(l.precio_unitario)
        cant = float(l.cantidad)
        desc_pct = float(l.descuento_porcentaje or 0)
        
        item = {
            "code_reference": prod.codigo if prod and prod.codigo else f"PROD-{l.producto_id}",
            "name": prod.nombre if prod else f"Artículo #{l.producto_id}",
            "quantity": cant,
            "discount_rate": desc_pct,
            "price": costo_linea,
            "tax_rate": f"{iva_pct:.2f}",
            "unit_measure_id": 70,
            "standard_code_id": 1,
            "is_excluded": 1 if iva_pct == 0 else 0,
            "tribute_id": 1,
        }
        items_payload.append(item)
    
    rango_id = int(cfg.fe_rango_id) if (cfg.fe_rango_id and str(cfg.fe_rango_id).isdigit()) else 8
    
    body = {
        "numbering_range_id": rango_id,
        "reference_code": factura.numero,
        "observation": factura.observaciones or "Venta por mostrador FACTUR-AAP",
        "payment_form": "1",
        "payment_method_code": _mapear_medio_pago(factura.forma_pago),
        "customer": {
            "identification": nit_doc.split("-")[0] if "-" in nit_doc else nit_doc,
            "dv": nit_doc.split("-")[1] if "-" in nit_doc else None,
            "company": nombre_cli if doc_id == "6" else "",
            "trade_name": nombre_cli if doc_id == "6" else "",
            "names": nombre_cli if doc_id != "6" else "",
            "address": dir_cli,
            "email": email_cli,
            "phone": tel_cli,
            "legal_organization_id": "1" if doc_id == "6" else "2",
            "tribute_id": "18" if doc_id == "6" else "21",
            "identification_document_id": doc_id,
            "municipality_id": cfg.fe_municipio_id or "980",
        },
        "items": items_payload,
    }
    
    url_val = f"{base_url}/v1/bills/validate"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    
    async with httpx.AsyncClient(timeout=35.0) as client:
        try:
            response = await client.post(url_val, json=body, headers=headers)
            res_json = response.json()
            
            if response.status_code in [200, 201]:
                data_bill = res_json.get("data", {}).get("bill", {})
                cufe = data_bill.get("cufe") or data_bill.get("qr")
                qr_url = data_bill.get("qr")
                qr_img = data_bill.get("qr_image")
                num_dian = data_bill.get("number")
                pdf_url = data_bill.get("public_url")
                
                factura.cufe = cufe
                factura.qr_cadena = qr_url
                factura.qr_imagen_base64 = qr_img
                factura.dian_numero_oficial = num_dian
                factura.dian_pdf_url = pdf_url
                factura.dian_estado = "VALIDADA"
                factura.dian_errores = None
                await db.commit()
                
                return {
                    "exito": True,
                    "mensaje": "✓ Factura validada y aceptada exitosamente por la DIAN",
                    "cufe": cufe,
                    "qr": qr_url,
                    "qr_imagen": qr_img,
                    "numero_dian": num_dian,
                    "pdf_url": pdf_url,
                }
            else:
                errores = res_json.get("data", {}).get("errors") or res_json.get("errors") or res_json.get("message")
                err_str = json.dumps(errores, ensure_ascii=False) if isinstance(errores, (dict, list)) else str(errores)
                
                factura.dian_estado = "RECHAZADA"
                factura.dian_errores = err_str
                await db.commit()
                
                return {
                    "exito": False,
                    "mensaje": f"La DIAN / Factus rechazó el documento: {err_str}",
                    "errores": errores,
                }
        except Exception as e:
            factura.dian_estado = "PENDIENTE"
            factura.dian_errores = f"Error de comunicación: {str(e)}"
            await db.commit()
            return {"exito": False, "mensaje": f"Error de red al conectar con la DIAN: {str(e)}"}

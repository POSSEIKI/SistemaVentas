# 🚀 Guía de Despliegue en la Web (Cloud Hosting & Dominios)

Esta guía explica paso a paso cómo montar **SistemaVentas Cloud** en internet para acceder desde cualquier computador, tablet o celular 24/7 sin consumir recursos de tu PC.

---

## 📌 Arquitectura del Sistema
- **Landing Page Pública (`/`)**: Portal comercial de bienvenida, características, planes y precios.
- **Registro de Clientes (`/registro`)**: Formulario para que nuevas droguerías/negocios creen su cuenta y activen su prueba gratis de 14 días.
- **Acceso (`/login`)**: Inicio de sesión para administradores y cajeros.
- **Sistema POS / ERP (`/ventas`)**: Panel de ventas, inventario, compras, facturación térmica y reportes.

---

## 🌟 Opción 1: Despliegue en la Nube (PaaS - Muy Fácil y Económico)

Puedes usar servicios en la nube administrados sin necesidad de configurar servidores Linux:

### 1. Base de Datos PostgreSQL (Gratis / Bajo costo)
Puedes crear una base de datos PostgreSQL en cualquiera de estos proveedores:
- **Supabase** (https://supabase.com) -> Crear nuevo proyecto -> Obtener la `Connection String (URI)`.
- **Neon** (https://neon.tech) o **Render Postgres** (https://render.com).

### 2. Backend FastAPI (Render o Railway)
1. Sube tu proyecto a un repositorio privado en **GitHub**.
2. En **Render** (https://render.com), haz clic en **New + > Web Service**.
3. Conecta tu repositorio de GitHub y selecciona la carpeta `backend`.
4. Configuración:
   - **Environment**: `Docker` (usará automáticamente `backend/Dockerfile`).
   - **Plan**: Starter o Free.
5. Agrega las **Variables de Entorno (Environment Variables)**:
   - `DATABASE_URL`: La URL de tu base de datos PostgreSQL (ej. `postgresql+asyncpg://...`)
   - `SECRET_KEY`: Una clave secreta de 64 caracteres.
   - `ALLOWED_ORIGINS`: `*` o la URL de tu frontend.
6. Haz clic en **Deploy Web Service**. Render te dará una URL pública como `https://sistemaventas-api.onrender.com`.

### 3. Frontend React (Vercel o Render)
1. En **Vercel** (https://vercel.com) o **Render**, conecta tu repositorio de GitHub.
2. Selecciona la carpeta `frontend`.
3. Configuración de Build:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Variable de Entorno:
   - `VITE_API_URL`: `https://sistemaventas-api.onrender.com/api/v1` (la URL de tu backend).
5. Haz clic en **Deploy**. ¡Tu frontend ya estará en vivo con HTTPS automático!

---

## 🖥️ Opción 2: Despliegue en Servidor VPS Propio (Docker Compose + SSL)

Si tienes un servidor VPS en **DigitalOcean, Hetzner, AWS Lightsail, Linode o Contabo**:

### 1. Requisitos Previos en el VPS
Conéctate por SSH a tu servidor y asegúrate de tener Docker y Docker Compose instalados:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
```

### 2. Clonar el Repositorio
```bash
git clone https://github.com/tu-usuario/SistemaVentas.git
cd SistemaVentas
```

### 3. Configurar Variables de Producción
Copia el archivo de ejemplo:
```bash
cp .env.production.example .env
nano .env
```
Edita los valores:
```env
DOMAIN=tudominio.com
ACME_EMAIL=tu_correo@gmail.com
POSTGRES_USER=pos_user
POSTGRES_PASSWORD=tu_password_segura_2026
POSTGRES_DB=sistema_ventas
SECRET_KEY=tu_clave_secreta_super_segura_2026
ALLOWED_ORIGINS=https://tudominio.com,https://app.tudominio.com
```

### 4. Configurar tu Dominio (DNS)
En tu proveedor de dominio (Cloudflare, GoDaddy, Namecheap):
- Crea un registro **A** apuntando `@` (dominio principal) a la IP de tu VPS.
- Crea un registro **A** apuntando `app` y `www` a la IP de tu VPS.

### 5. Iniciar la Aplicación en Producción
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**¡Listo!** El servidor **Caddy** generará automáticamente los certificados SSL (HTTPS con candado verde) de Let's Encrypt para tu dominio y subdominios, y tu sistema estará funcionando 24/7 sin gastar recursos de tu computadora.

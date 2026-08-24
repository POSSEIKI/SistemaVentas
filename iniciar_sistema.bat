@echo off
title SistemaVentas - Servidor Local
color 0A

echo ========================================================
echo         INICIANDO SISTEMAVENTAS (ERP / POS)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Iniciando Servidor Backend (FastAPI)...
start "Backend - FastAPI" cmd /k "cd /d %~dp0backend && .\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

echo [2/2] Iniciando Servidor Frontend (React + Vite)...
start "Frontend - Vite" cmd /k "cd /d %~dp0frontend && set PATH=%%PATH%%;C:\Program Files\nodejs && node .\node_modules\vite\bin\vite.js --host 0.0.0.0 --port 5173"

echo.
echo ========================================================
echo  Sistema iniciado con exito!
echo.
echo  - Acceso en tu PC:       http://localhost:5173
echo  - Acceso en Celular/WiFi: http://192.168.1.48:5173
echo ========================================================
echo.
pause

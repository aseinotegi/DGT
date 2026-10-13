@echo off
rem Doble clic para dejar REA escuchando en http://127.0.0.1:8787
cd /d "%~dp0"
if not exist node_modules\rea-agents (
  powershell -ExecutionPolicy Bypass -File "%~dp0instalar.ps1" || exit /b 1
)
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8787"
node servidor.mjs

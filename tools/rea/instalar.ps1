# Instala REA en esta carpeta (node_modules local, sin tocar el sistema).
# Uso:  powershell -ExecutionPolicy Bypass -File .\instalar.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js no esta instalado. Instalalo con:" -ForegroundColor Yellow
  Write-Host "  winget install OpenJS.NodeJS.LTS"
  Write-Host "y abre una terminal nueva antes de repetir este script."
  exit 1
}

$v = [version]((node -v).TrimStart("v"))
$ok = ($v.Major -eq 22 -and $v.Minor -ge 19) -or ($v.Major -eq 24 -and $v.Minor -ge 11) -or ($v.Major -ge 26)
if (-not $ok) {
  Write-Host "REA necesita Node 22.19+, 24.11+ o 26+. Tienes $v." -ForegroundColor Yellow
  Write-Host "Actualiza con:  winget upgrade OpenJS.NodeJS.LTS"
  exit 1
}

Write-Host "Node $v OK. Instalando rea-agents..." -ForegroundColor Cyan
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$browsers = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ }
if ($browsers) { Write-Host "Navegador: $($browsers[0])" -ForegroundColor Green }
else { Write-Host "No encuentro Chrome ni Edge: define REA_BROWSER con la ruta del .exe" -ForegroundColor Yellow }

npx rea --version
Write-Host ""
Write-Host "Listo. Prueba:" -ForegroundColor Green
Write-Host "  node analizar.mjs ejemplo.com"
Write-Host "  node servidor.mjs      (y abre http://127.0.0.1:8787)"

# REA en local (Windows)

Herramienta para analizar una web con [REA](https://github.com/morluto/rea)
(`rea-agents`) desde tu PC: le das un host y genera un informe con scripts,
peticiones de red, endpoints y rutas candidatos, frameworks detectados,
consola/errores y una captura de pantalla.

Todo se ejecuta en local: el navegador lo lanza la herramienta con un perfil
temporal y el servidor solo escucha en `127.0.0.1`.

> Analiza solo webs propias o sobre las que tengas autorización.

## Requisitos

- Windows 10/11
- Node.js 22.19+, 24.11+ o 26+ → `winget install OpenJS.NodeJS.LTS`
- Google Chrome o Microsoft Edge (Edge viene con Windows)

## Instalación

```powershell
cd tools\rea
powershell -ExecutionPolicy Bypass -File .\instalar.ps1
```

REA queda instalado en `tools\rea\node_modules` (el equivalente a un venv),
sin instalar nada global.

## Uso

### Opción 1: servidor escuchando (recomendado)

Doble clic en `iniciar-servidor.cmd`, o:

```powershell
node servidor.mjs
```

Abre <http://127.0.0.1:8787>, escribe el host (`ejemplo.com` o una URL
completa) y pulsa **Analizar**. Tarda unos 20-30 s. Marca *navegador visible*
si quieres ver lo que hace.

También tiene API:

```powershell
curl "http://127.0.0.1:8787/api/analizar?url=ejemplo.com"
```

Hace un análisis cada vez; si llega otro mientras tanto responde `409`.

### Opción 2: línea de comandos

```powershell
node analizar.mjs ejemplo.com
node analizar.mjs https://ejemplo.com/login --visible --espera-ms 8000
```

### Opción 3: desde Claude Code (agente)

Si usas Claude Code en Windows, registra REA como servidor MCP y pídele los
análisis en lenguaje natural. Así tienes además las más de 150 herramientas de
REA (binarios, APKs, apps Electron, .NET…), no solo el análisis web:

```powershell
claude mcp add rea -- node "C:\ruta\a\DGT\tools\rea\node_modules\rea-agents\scripts\rea.mjs" --mcp
```

## Qué genera

Cada análisis crea `informes\<host>-<fecha>\` con:

| Fichero          | Contenido                                                               |
| ---------------- | ----------------------------------------------------------------------- |
| `resumen.md`     | Resumen legible de todo lo siguiente                                    |
| `inspect.json`   | DOM, scripts, recursos, metadatos y nombres de claves de storage        |
| `bundle.json`    | Análisis estático del JS: chunks, endpoints, rutas, frameworks, source maps |
| `red.json`       | Todas las peticiones de la carga de la página, con consola y errores JS |
| `captura.png`    | Captura de la parte visible                                             |
| `escenario.json` | Escenario usado para la captura de red (reproducible con `npx rea capture-browser-scenario escenario.json`) |

Por diseño, REA no guarda valores de cookies, cuerpos de petición ni cabeceras:
solo sus nombres y su estructura.

## Cómo funciona

1. Lanza Chrome/Edge con un perfil temporal y depuración (CDP) en
   `127.0.0.1:9333`, y abre la URL.
2. `rea analyze-web-bundle`: análisis estático de los scripts cargados.
3. `rea inspect-web-page`: estructura de la página.
4. `rea capture-web-screenshot`: captura de pantalla.
5. `rea capture-browser-scenario`: REA abre su propio navegador y registra la
   red desde antes de navegar (`inspect-web-page` solo ve lo que ocurre después
   de conectarse).

## Variables de entorno

| Variable        | Para qué                                                  |
| --------------- | --------------------------------------------------------- |
| `REA_BROWSER`   | Ruta del navegador si no lo detecta solo                  |
| `REA_CDP_PORT`  | Puerto de depuración (por defecto `9333`)                 |
| `REA_INFORMES`  | Carpeta de informes (por defecto `tools\rea\informes`)    |
| `PORT`          | Puerto del servidor (por defecto `8787`)                  |

## Problemas típicos

- **`target_not_allowed`**: la página no llegó a cargar (host caído, `http`
  frente a `https`, certificado no válido) o redirigió a otro origen. Prueba
  con la URL final exacta.
- **"No abrió el puerto de depuración"**: el puerto 9333 está ocupado; cambia
  `REA_CDP_PORT`.
- **Webs con login**: el perfil es temporal y empieza vacío, así que solo se ve
  la parte pública. Para zonas privadas usa la opción de Claude Code o los
  escenarios de REA con acciones de login
  ([documentación](https://github.com/morluto/rea/blob/main/docs/browser-scenario-contract.md)).
- **Comprobar la instalación**: `npx rea doctor`. Que diga `healthy: false`
  por falta de Hopper/Ghidra/IDA es normal: esos motores solo hacen falta para
  binarios nativos.

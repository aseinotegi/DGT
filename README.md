# DGT V16 Live Map 🚨

Mapa en tiempo real de incidencias de tráfico en España. El sistema obtiene datos de balizas de emergencia de la DGT (Dirección General de Tráfico), los almacena en una base de datos geoespacial y los visualiza en un mapa web interactivo.

## 🏗️ Arquitectura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ DGT Nacional│     │ País Vasco  │     │  Cataluña   │
│   (v3.6)    │     │   (v1.0)    │     │   (v1.0)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │ HTTPS
                           ▼
                    ┌──────────────┐
                    │   Backend    │ FastAPI + APScheduler
                    │  (Python)    │ Sync cada 60s
                    └──────┬───────┘
                           │ SQL
                           ▼
                    ┌──────────────┐
                    │  PostgreSQL  │ PostGIS
                    │    + GIS     │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐     ┌──────────────┐
                    │    Nginx     │◄────│   Frontend   │
                    │   (Proxy)    │     │   (React)    │
                    └──────┬───────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Browser    │
                    └──────────────┘
```

## 🚀 Inicio Rápido

### Requisitos

- Docker & Docker Compose
- 2GB RAM disponible

### Levantar el entorno

```bash
# Clonar o navegar al directorio
cd DGT

# Copiar variables de entorno
cp .env.example .env

# Construir y levantar todos los servicios
docker-compose up -d --build

# Ver logs en tiempo real
docker-compose logs -f
```

### Acceso

- **Mapa Web**: http://localhost
- **API Health**: http://localhost/api/health
- **API Beacons (GeoJSON)**: http://localhost/api/v1/beacons
- **API Stats**: http://localhost/api/v1/beacons/stats

## 📊 Fuentes de Datos

| Región | Formato | URL |
|--------|---------|-----|
| Nacional | DATEX II v3.6 | [nap.dgt.es](https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml) |
| País Vasco | DATEX II v1.0 | [infocar.dgt.es/dt-gv](https://infocar.dgt.es/datex2/dt-gv/SituationPublication/all/content.xml) |
| Cataluña | DATEX II v1.0 | [infocar.dgt.es/sct](https://infocar.dgt.es/datex2/sct/SituationPublication/all/content.xml) |

## 🛠️ Stack Tecnológico

### Backend
- **Python 3.11** con **UV** (gestor de paquetes ultrarrápido)
- **FastAPI** - Framework web moderno
- **SQLModel** - ORM con tipado
- **GeoAlchemy2** - Extensión geoespacial
- **APScheduler** - Tareas programadas
- **lxml** - Parsing XML
- **httpx** - Cliente HTTP async

### Base de Datos
- **PostgreSQL 15** con **PostGIS** 3.3

### Frontend
- **React 18** + **TypeScript**
- **Vite** - Build tool
- **React-Leaflet** - Mapas interactivos

### Infraestructura
- **Docker** + **Docker Compose**
- **Nginx** - Reverse proxy

## 📁 Estructura del Proyecto

```
DGT/
├── docker-compose.yml      # Orquestación de servicios
├── .env.example            # Variables de entorno
├── README.md
├── backend/
│   ├── Dockerfile          # UV + Python 3.11
│   ├── pyproject.toml      # Dependencias
│   ├── main.py             # FastAPI app
│   ├── config.py           # Configuración
│   ├── models.py           # Modelos SQLModel
│   ├── parser.py           # Parser DATEX II
│   └── worker.py           # ETL concurrente
├── frontend/
│   ├── Dockerfile          # Multi-stage build
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── index.css       # Dark theme
│       └── components/
│           └── BeaconMap.tsx
└── nginx/
    ├── Dockerfile
    └── nginx.conf          # Reverse proxy config
```

## 🔧 Comandos Útiles

```bash
# Parar servicios
docker-compose down

# Ver estado de contenedores
docker-compose ps

# Reconstruir un servicio específico
docker-compose up -d --build backend

# Ver logs de un servicio
docker-compose logs -f backend

# Limpiar todo (incluyendo volúmenes)
docker-compose down -v
```

## 📝 API Endpoints

### GET /api/health
Health check del backend.

### GET /api/v1/beacons
Devuelve todas las incidencias activas en formato GeoJSON.

```json
{
  "type": "FeatureCollection",
  "features": [...],
  "metadata": {
    "total_count": 150,
    "sources": {
      "nacional": 100,
      "pais_vasco": 30,
      "cataluna": 20
    }
  }
}
```

### GET /api/v1/beacons/stats
Estadísticas agregadas por fuente y tipo de incidencia.

## 🎨 Características del Frontend

- **Dark Theme** moderno con acentos de color
- **Markers por color** según fuente de datos:
  - 🔵 Azul: DGT Nacional
  - 🟢 Verde: País Vasco
  - 🟡 Amarillo: Cataluña
- **Auto-refresh** cada 60 segundos
- **Popups** con detalles de incidencia
- **Responsive** para móvil y desktop

## 📄 Licencia

MIT License

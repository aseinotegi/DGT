# Mapa de Balizas V16 - España

Visualización en tiempo real de vehículos detenidos en carreteras españolas, con sistema de detección de personas vulnerables.

Más proyectos míos en **[andersein.com](https://andersein.com)**.

**Acceso**: [mapabalizasv16.info](https://mapabalizasv16.info)

---

## Funcionalidades

### 1. Mapa en Tiempo Real

El sistema muestra la ubicación exacta de vehículos detenidos (balizas V16) en toda España. Los datos se actualizan automáticamente cada 60 segundos desde tres fuentes oficiales de la DGT:

- **Nacional**: Todas las carreteras estatales
- **País Vasco**: Red autonómica vasca
- **Cataluña**: Red autonómica catalana

Cada marcador en el mapa incluye:
- Carretera y punto kilométrico
- Municipio y provincia
- Tiempo desde la activación
- Enlace directo a Google Maps

### 2. Persistencia de Incidencias

Todas las balizas detectadas se almacenan en una base de datos PostgreSQL con información geoespacial. Esto permite:

- **Historial completo**: Registro de todas las incidencias pasadas
- **Duración de incidencias**: Tiempo que cada baliza estuvo activa
- **Análisis temporal**: Patrones por hora del día, día de la semana, etc.
- **Estadísticas por zona**: Carreteras más conflictivas

### 3. Detección de Personas Vulnerables

El sistema analiza automáticamente cada baliza activa para identificar conductores que podrían estar en situación de riesgo. Accesible desde el botón flotante en el mapa o en `/peligro`.

#### Metodología de Puntuación (0-100 puntos)

Cada baliza recibe una puntuación de vulnerabilidad basada en cuatro factores:

| Factor | Peso | Descripción |
|--------|------|-------------|
| **Aislamiento** | 30% | Distancia a núcleos urbanos. Mayor puntuación si está lejos de municipios |
| **Exposición temporal** | 25% | Tiempo que lleva activa la baliza. A partir de 30 minutos aumenta el riesgo |
| **Horario nocturno** | 25% | Entre 22:00 y 06:00 se considera horario de mayor vulnerabilidad |
| **Tipo de vía** | 20% | Autopistas y autovías implican mayor dificultad de auxilio |

#### Niveles de Riesgo

- **Crítico (75-100)**: Alerta máxima - posible persona en peligro
- **Alto (50-74)**: Situación preocupante que requiere atención
- **Medio (25-49)**: Riesgo moderado
- **Bajo (0-24)**: Situación normal

#### Factores de Riesgo Detectados

El sistema identifica y muestra factores específicos como:
- "Zona aislada sin población cercana"
- "Más de 2 horas activo"
- "Horario nocturno (mayor vulnerabilidad)"
- "Vía de alta velocidad"

### 4. Filtrado de Errores

Las balizas que llevan más de 15 horas activas se marcan como "posible error" con opacidad reducida. Esto evita falsos positivos causados por balizas mal desactivadas en el sistema de la DGT.

### 5. Página de Detalle de Vulnerabilidad

La ruta `/peligro` ofrece:
- Listado de todas las balizas con puntuación elevada
- Vista detallada por baliza con desglose de puntuación
- Factores de riesgo específicos
- Enlace directo a Google Maps para asistencia

---

## Fuentes de Datos

Los datos provienen del sistema oficial DATEX II de la Dirección General de Tráfico (DGT):

| Región | Formato | Actualización |
|--------|---------|---------------|
| Nacional | DATEX II v3.6 | 60 segundos |
| País Vasco | DATEX II v1.0 | 60 segundos |
| Cataluña | DATEX II v1.0 | 60 segundos |

---

## Tecnologías

- **Backend**: Python (FastAPI)
- **Base de datos**: PostgreSQL con extensión geoespacial
- **Frontend**: React + Leaflet
- **Hosting**: Railway

---

## API Pública

Base URL: `https://dgt-production.up.railway.app`

### Endpoints

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/health` | Health check del servicio |
| `GET /api/v1/beacons` | Todas las balizas activas en formato GeoJSON |
| `GET /api/v1/beacons/stats` | Estadísticas generales por fuente y tipo de incidente |
| `GET /api/v1/beacons/history` | Historial de balizas inactivas |
| `GET /api/v1/stats` | Estadísticas de balizas V16 (tiempo medio, provincias, tipos de vía) |
| `GET /api/v1/stats/trends` | Tendencias históricas (distribución horaria, tendencia diaria) |
| `GET /api/v1/alerts/vulnerable` | Alertas de balizas con alta puntuación de vulnerabilidad |
| `GET /api/v1/sync/logs` | Logs de sincronización con la DGT |

### Parámetros

**`/api/v1/stats`**
- `days` (int): Rango temporal. `0` = tiempo real, `7` = última semana, `30` = último mes

**`/api/v1/stats/trends`**
- `days` (int): Número de días a incluir en las tendencias (por defecto 7)

**`/api/v1/beacons/history`**
- `limit` (int): Máximo de registros a devolver (por defecto 100)
- `include_active` (bool): Incluir balizas activas (por defecto false)

**`/api/v1/alerts/vulnerable`**
- `min_score` (float): Puntuación mínima de vulnerabilidad (0-100, por defecto 50)

---

## Autor

Desarrollado por **Ander Sein**

🌐 [mapabalizasv16.info](https://mapabalizasv16.info)

---

## Licencia

MIT License - © 2026 Ander Sein

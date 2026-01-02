# 📊 Análisis de Enriquecimiento de Datos DGT DATEX II

## Objetivo
Analizar cada campo disponible en el XML de incidencias DGT para identificar oportunidades de **enriquecimiento, correlación y construcción de métricas** mediante fuentes públicas.

---

## 🔴 NIVEL 1: Identificadores y Trazabilidad

### 1.1 `situation/@id` - ID de Situación
| Aspecto | Detalle |
|---------|---------|
| **Valor actual** | Número único (ej: `6129`, `73792`) |
| **Trazabilidad** | ✅ **ALTA** - Permite trackear evolución de incidencias |
| **Enriquecimiento** | Crear histórico propio para análisis temporal |
| **Métricas posibles** | Duración media por tipo, reincidencia por zona |
| **Acción** | Persistir en BBDD con timestamps de primera/última aparición |

### 1.2 `situationRecord/@id` - ID de Registro
| Aspecto | Detalle |
|---------|---------|
| **Valor actual** | Número único del registro específico |
| **Trazabilidad** | ✅ Permite versionar cambios dentro de una situación |
| **Relación** | 1 situación puede tener N registros |
| **Acción** | Guardar historial de versiones |

### 1.3 `situationRecord/@version` - Versión del Registro
| Aspecto | Detalle |
|---------|---------|
| **Valor actual** | Número incremental (1, 2, 3...) |
| **Uso** | Detectar actualizaciones de estado |
| **Métrica** | Frecuencia de actualización por tipo de incidencia |

---

## 🟠 NIVEL 2: Información Temporal

### 2.1 `situationRecordCreationTime` - Fecha Creación
| Aspecto | Detalle |
|---------|---------|
| **Formato** | ISO 8601 con zona horaria |
| **Enriquecimiento posible** | |
| 📅 **Calendario festivos** | [datos.gob.es - Festivos](https://datos.gob.es/es/catalogo/l01280796-dias-festivos) |
| 🌤️ **Datos meteorológicos** | [AEMET OpenData](https://opendata.aemet.es/) |
| 📊 **Intensidad tráfico** | [DGT - Aforos](https://www.dgt.es/conoce-el-trafico/las-carreteras/mapas-de-trafico/) |
| **Métricas** | Correlación incidencias vs festivos, clima, intensidad |

### 2.2 `overallStartTime` - Inicio de Validez
| Aspecto | Detalle |
|---------|---------|
| **Uso** | Momento real de inicio de la incidencia |
| **Correlación** | Hora punta, día semana, estacionalidad |
| **Fuentes complementarias** | |
| 🚗 **Aforos DGT** | Intensidad de tráfico por estación |
| 📆 **Operaciones especiales** | [DGT Operaciones](https://www.dgt.es/nuestros-servicios/tu-seguridad-en-la-carretera/operaciones-de-trafico/) |

### 2.3 `overallEndTime` - Fin de Validez (cuando existe)
| Aspecto | Detalle |
|---------|---------|
| **Métrica clave** | Duración = EndTime - StartTime |
| **Análisis** | Tiempo medio resolución por tipo, provincia, carretera |

---

## 🟡 NIVEL 3: Geolocalización

### 3.1 `latitude` / `longitude` - Coordenadas
| Aspecto | Detalle |
|---------|---------|
| **Valor** | Coordenadas WGS84 (from/to para segmentos) |
| **Enriquecimiento geoespacial** | |
| 🗺️ **OpenStreetMap** | Contexto urbano/rural, POIs cercanos |
| 📍 **Google Places API** | Servicios cercanos (gasolineras, talleres) |
| 🏥 **Hospitales/emergencias** | Distancia a servicios de emergencia |
| 🌊 **Datos topográficos** | [IGN - Centro de Descargas](https://centrodedescargas.cnig.es/) |
| **Métricas** | Puntos negros, clustering de incidencias |

### 3.2 `roadName` - Nombre de Carretera
| Aspecto | Detalle |
|---------|---------|
| **Valor** | Código carretera (A-8, N-634, GR-5202) |
| **Clasificación** | Autopista (A/AP), Nacional (N), Autonómica, Provincial |
| **Enriquecimiento** | |
| 📊 **Catálogo carreteras** | [Ministerio Transportes](https://www.mitma.gob.es/carreteras) |
| 🚗 **IMD (Intensidad Media Diaria)** | [DGT Mapas Tráfico](https://www.dgt.es/conoce-el-trafico/las-carreteras/mapas-de-trafico/) |
| 🔧 **Estado carreteras** | Información de conservación |
| **Métricas** | Incidencias/km por tipo de vía, correlación con IMD |

### 3.3 `kilometerPoint` - Punto Kilométrico
| Aspecto | Detalle |
|---------|---------|
| **Valor** | PK exacto (ej: 19.0, 145.5) |
| **Uso crítico** | Identificar puntos negros específicos |
| **Enriquecimiento** | |
| ⚠️ **Puntos negros DGT** | [Catálogo accidentes](https://www.dgt.es/conoce-el-trafico/) |
| 🚦 **Elementos vía** | Túneles, puentes, cruces |
| 📸 **Radares** | Proximidad a puntos de control |
| **Métrica** | Densidad incidencias por tramo kilométrico |

### 3.4 `roadDestination` - Destino
| Aspecto | Detalle |
|---------|---------|
| **Valor** | Ciudad/dirección (ej: "IRUN", "CORUÑA") |
| **Uso** | Sentido de la vía afectada |

---

## 🟢 NIVEL 4: Información Administrativa

### 4.1 `autonomousCommunity` - Comunidad Autónoma
| Aspecto | Detalle |
|---------|---------|
| **Valor** | Nombre completo (ej: "Andalucía", "Galicia") |
| **Enriquecimiento** | |
| 📊 **INE** | [Datos demográficos](https://www.ine.es/) |
| 💰 **Presupuestos** | Inversión en infraestructuras |
| 🚗 **Parque vehículos** | Por CCAA |
| 📋 **Competencias** | Carreteras autonómicas vs estatales |
| **Métricas** | Incidencias per cápita, por km de red |

### 4.2 `province` - Provincia
| Aspecto | Detalle |
|---------|---------|
| **Valor** | Nombre provincia |
| **Enriquecimiento** | |
| 🏛️ **Código INE** | Para cruzar con cualquier estadística oficial |
| 🌤️ **Climatología** | AEMET datos históricos por provincia |
| 🚗 **Matriculaciones** | DGT estadísticas provinciales |
| **Métricas** | Ranking provincial de incidencias |

### 4.3 `municipality` - Municipio
| Aspecto | Detalle |
|---------|---------|
| **Valor** | Nombre municipio |
| **Enriquecimiento** | |
| 📊 **Padrón municipal** | Población, densidad |
| 🏭 **Actividad económica** | Polígonos industriales, zonas comerciales |
| 🎉 **Eventos locales** | Fiestas, ferias, mercados |
| **Métricas** | Incidencias en accesos municipales |

---

## 🔵 NIVEL 5: Tipología de Incidencia

### 5.1 `causeType` - Tipo de Causa
| Valor | Descripción | Enriquecimiento |
|-------|-------------|-----------------|
| `roadMaintenance` | Mantenimiento/obras | Planes de obra públicos |
| `environmentalObstruction` | Obstáculo ambiental | Datos meteorológicos AEMET |
| `roadOrCarriagewayOrLaneManagement` | Gestión de carriles | Eventos programados |
| `accident` | Accidente | Estadísticas siniestralidad DGT |

### 5.2 `detailedCauseType` - Causa Detallada
| Valor | Correlación posible |
|-------|---------------------|
| `roadworks` | Licitaciones públicas, BOE |
| `rockfalls` | Zonas geológicas riesgo, IGME |
| `flooding` | Histórico AEMET precipitaciones |
| `snowDrift` | Cotas de nieve, puertos |

### 5.3 `roadOrCarriagewayOrLaneManagementType` - Tipo Gestión
| Valor | Impacto | Métrica |
|-------|---------|---------|
| `roadClosed` | 🔴 Crítico | Tiempo cierre, desvíos |
| `laneClosures` | 🟠 Alto | Reducción capacidad |
| `narrowLanes` | 🟡 Medio | Velocidad reducida |
| `singleAlternateLineTraffic` | 🟠 Alto | Tiempos espera |

### 5.4 `severity` - Severidad
| Valor | Peso | Uso |
|-------|------|-----|
| `low` | 1 | |
| `medium` | 2 | |
| `high` | 3 | |
| `highest` | 4 | |
| **Métrica** | Índice de severidad ponderado por zona/tiempo |

---

## 🟣 NIVEL 6: Información de Carril

### 6.1 `laneUsage` - Uso del Carril
| Valor | Significado | Impacto en capacidad |
|-------|-------------|---------------------|
| `rightLane` | Carril derecho | -33% (en vía 3 carriles) |
| `leftLane` | Carril izquierdo | -33% |
| `allLanesCompleteCarriageway` | Todos los carriles | -100% |
| **Métrica** | Reducción capacidad estimada |

### 6.2 `tpegDirectionRoad` - Dirección
| Valor | Significado |
|-------|-------------|
| `both` | Ambos sentidos |
| `positive` | Sentido creciente PK |
| `negative` | Sentido decreciente PK |

---

## 📡 FUENTES PÚBLICAS PARA ENRIQUECIMIENTO

### APIs y Datasets Oficiales

| Fuente | URL | Datos |
|--------|-----|-------|
| **AEMET OpenData** | https://opendata.aemet.es/ | Meteorología, alertas |
| **INE** | https://www.ine.es/dyngs/INEbase/ | Demografía, economía |
| **datos.gob.es** | https://datos.gob.es/ | Festivos, geografía |
| **Catastro** | https://www.catastro.meh.es/ | Información territorial |
| **IGN** | https://www.ign.es/web/ign/portal/cbg-area-cartografia | Cartografía |
| **IGME** | https://www.igme.es/ | Geología, riesgos |
| **Ministerio Transportes** | https://www.mitma.gob.es/ | Infraestructuras |
| **OSM/Overpass** | https://overpass-api.de/ | POIs, servicios |

### APIs DGT Adicionales

| Endpoint | Datos |
|----------|-------|
| Cámaras tráfico | Imágenes en tiempo real |
| Paneles variables | Mensajes actuales |
| Radares | Ubicaciones |
| Aforos | Intensidad tráfico |

---

## 🎯 MODELO DE DATOS ENRIQUECIDO PROPUESTO

```
┌─────────────────────────────────────────────────────────────────┐
│                        INCIDENCIA                                │
├─────────────────────────────────────────────────────────────────┤
│ ID Situación (PK)                                               │
│ ID Registro                                                      │
│ Versión                                                          │
├─────────────────────────────────────────────────────────────────┤
│ TEMPORAL                                                         │
│ ├── Fecha creación                                              │
│ ├── Fecha inicio                                                │
│ ├── Fecha fin                                                   │
│ ├── Duración (calculado)                                        │
│ ├── Es festivo (enriquecido)                                    │
│ ├── Es operación especial (enriquecido)                         │
│ └── Franja horaria (mañana/tarde/noche)                         │
├─────────────────────────────────────────────────────────────────┤
│ GEOESPACIAL                                                      │
│ ├── Geometría (Point/LineString)                                │
│ ├── Carretera                                                   │
│ ├── PK inicio / PK fin                                          │
│ ├── Longitud tramo (calculado)                                  │
│ ├── Tipo vía (enriquecido: autopista/nacional/autonómica)       │
│ ├── IMD (enriquecido)                                           │
│ ├── Es punto negro (enriquecido)                                │
│ └── Zona (urbana/interurbana) (enriquecido)                     │
├─────────────────────────────────────────────────────────────────┤
│ ADMINISTRATIVO                                                   │
│ ├── CCAA                                                         │
│ ├── Provincia                                                    │
│ ├── Municipio                                                    │
│ ├── Código INE municipio (enriquecido)                          │
│ └── Población municipio (enriquecido)                           │
├─────────────────────────────────────────────────────────────────┤
│ TIPOLOGÍA                                                        │
│ ├── Causa principal                                             │
│ ├── Causa detallada                                             │
│ ├── Tipo gestión                                                │
│ ├── Severidad                                                   │
│ ├── Carriles afectados                                          │
│ ├── Dirección                                                   │
│ └── Reducción capacidad (calculado)                             │
├─────────────────────────────────────────────────────────────────┤
│ METEOROLOGÍA (enriquecido AEMET)                                │
│ ├── Temperatura                                                  │
│ ├── Precipitación                                               │
│ ├── Viento                                                       │
│ ├── Visibilidad                                                 │
│ └── Alerta activa                                               │
├─────────────────────────────────────────────────────────────────┤
│ CONTEXTO (enriquecido)                                          │
│ ├── Distancia hospital más cercano                              │
│ ├── Distancia gasolinera más cercana                            │
│ ├── Cámaras DGT en zona                                         │
│ └── Histórico incidencias misma zona (30/90/365 días)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📈 MÉTRICAS DERIVADAS POSIBLES

### Operativas
- **MTTR** (Mean Time To Resolve) por tipo de incidencia
- **Densidad incidencias** por km de red
- **Índice de recurrencia** por tramo
- **Patrones temporales** (hora, día, mes)

### Analíticas
- **Correlación clima-incidencias**
- **Impacto festivos/operaciones**
- **Puntos negros emergentes**
- **Predicción probabilística**

### De Capacidad
- **Reducción capacidad acumulada** por corredor
- **Tiempo total cierre** por vía
- **Vehículos afectados** (IMD × duración)

---

## 🔄 PIPELINE DE ENRIQUECIMIENTO SUGERIDO

```
1. INGESTA (cada 60s)
   └── XML DGT → Parse → Normalizar

2. GEOCODIFICACIÓN
   ├── Reverse geocoding (si falta municipio)
   └── Cálculo geometrías (Point/LineString)

3. ENRIQUECIMIENTO ESTÁTICO (cache diario)
   ├── Festivos → datos.gob.es
   ├── Población → INE
   ├── Tipo vía → Catálogo MITMA
   └── IMD → DGT aforos

4. ENRIQUECIMIENTO DINÁMICO (tiempo real)
   ├── Meteorología → AEMET
   └── Alertas → AEMET

5. CÁLCULOS DERIVADOS
   ├── Duración (si cerrada)
   ├── Reducción capacidad
   └── Vehículos afectados

6. HISTÓRICO
   ├── Detección cambios (versión)
   ├── Cierre incidencias
   └── Métricas agregadas
```

---

## 🚀 QUICK WINS (Implementación Inmediata)

1. **Persistir IDs** → Historial de incidencias
2. **Calcular duración** → Cuando desaparece del feed
3. **Clasificar tipo vía** → Regex sobre `roadName`
4. **Agregar por CCAA/Provincia** → Estadísticas básicas
5. **Detectar puntos calientes** → Clustering geoespacial

---

## 📋 RESUMEN EJECUTIVO

| Campo | Trazable | Enriquecible | Prioridad |
|-------|----------|--------------|-----------|
| ID Situación | ✅ | - | 🔴 Alta |
| Coordenadas | ✅ | ✅ OSM, AEMET | 🔴 Alta |
| Carretera/PK | ✅ | ✅ IMD, puntos negros | 🔴 Alta |
| Timestamps | ✅ | ✅ Festivos, clima | 🔴 Alta |
| CCAA/Provincia | ✅ | ✅ INE | 🟡 Media |
| Causa/Tipo | ✅ | ✅ Obras públicas | 🟡 Media |
| Severidad | ✅ | - | 🟢 Baja |
| Carril | ✅ | - | 🟢 Baja |

---

*Documento generado para análisis de enriquecimiento de datos DGT*
*Fecha: Enero 2026*

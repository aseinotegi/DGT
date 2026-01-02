# Roadmap de Monetizacion - DGT V16

## Resumen Ejecutivo

Sistema de balizas V16 en tiempo real con potencial de monetizacion B2B y B2C.

---

## Fases de Desarrollo (Facil a Dificil)

### FASE 1: Quick Wins (1-2 semanas)

| # | Feature | Esfuerzo | Descripcion |
|---|---------|----------|-------------|
| 1.1 | Historico de incidencias | Facil | No borrar datos, guardar todo con timestamps |
| 1.2 | Endpoint de estadisticas | Facil | Totales por hora/dia/semana/carretera |
| 1.3 | Filtros en mapa | Facil | Filtrar por tipo: averia, obras, accidente |
| 1.4 | PWA + Instalable | Facil | Anadir manifest.json para instalar en movil |

---

### FASE 2: Funcionalidades Core (2-4 semanas)

| # | Feature | Esfuerzo | Descripcion |
|---|---------|----------|-------------|
| 2.1 | Buscador de carretera | Medio | Buscar "A-2" y ver incidencias en esa via |
| 2.2 | Alertas por zona | Medio | Suscribirse a alertas de una carretera |
| 2.3 | Dashboard analytics | Medio | Graficas de tendencias y puntos calientes |
| 2.4 | Exportar datos | Facil | CSV/JSON de historico para descargar |

---

### FASE 3: Monetizacion B2B (1-2 meses)

| # | Feature | Esfuerzo | Descripcion |
|---|---------|----------|-------------|
| 3.1 | API con autenticacion | Medio | API keys, rate limiting, planes |
| 3.2 | Webhooks para gruas | Medio | Notificar incidencia nueva por zona |
| 3.3 | Panel de cliente API | Alto | Dashboard para ver consumo y stats |
| 3.4 | Landing page comercial | Medio | Web de venta del servicio |

---

### FASE 4: Inteligencia Avanzada (2-3 meses)

| # | Feature | Esfuerzo | Descripcion |
|---|---------|----------|-------------|
| 4.1 | Prediccion de incidencias | Alto | ML para predecir alta siniestralidad |
| 4.2 | Mapa de calor dinamico | Medio | Visualizar densidad por zonas |
| 4.3 | Integracion Waze/Google | Alto | Publicar datos en plataformas |
| 4.4 | App movil nativa | Alto | iOS/Android con push notifications |

---

## Brainstorming: Analisis de Patrones y Fuentes de Datos

### Limitaciones actuales de los datos DGT

Los feeds publicos NO exponen:
- Numero de serie de la baliza V16
- Matricula del vehiculo
- Identificador unico del propietario

El `external_id` es el ID del registro de incidencia, no de la baliza fisica.
Cada activacion genera un nuevo ID.

### Oportunidades de analisis con datos actuales

#### 1. Historico completo de activaciones
Almacenar TODAS las activaciones (no solo las activas) para:
- Identificar puntos negros (coordenadas con activaciones recurrentes)
- Detectar patrones temporales (horas pico, dias de semana, estacionalidad)
- Medir duracion media de incidencias
- Calcular tiempo de respuesta por zona

#### 2. Modelo de zonas de riesgo
Con el historico, crear mapas de:
- Tramos con mas averias
- Horas mas peligrosas por carretera
- Municipios con mayor incidencia
- Correlacion con condiciones meteorologicas

#### 3. Fuentes publicas para cruzar datos

| Fuente | Datos disponibles | Uso potencial |
|--------|-------------------|---------------|
| AEMET (API publica) | Temperatura, lluvia, nieve, viento | Correlacionar clima con incidencias |
| DGT Carreteras | Info de vias, obras planificadas, estado | Identificar tramos problematicos |
| INE | Densidad poblacion, parque vehiculos | Contexto demografico por zona |
| Trafico DGT | Intensidad media diaria (IMD) | Correlacion trafico/incidencias |
| Catastro | Informacion geografica | Contexto urbano/rural |

#### 4. Metricas derivadas para vender

| Metrica | Cliente potencial | Valor |
|---------|-------------------|-------|
| Indice de peligrosidad por tramo | Aseguradoras | Ajuste de primas |
| Tiempo medio de resolucion | Gruas/Talleres | Planificacion de rutas |
| Prediccion de demanda por hora | Servicios de asistencia | Optimizacion de recursos |
| Mapa de puntos negros | Ayuntamientos, DGT autonomicas | Seguridad vial |
| Alertas predictivas | Apps de navegacion | Integracion API |

#### 5. Ideas de producto a largo plazo

- **Informe mensual de siniestralidad**: PDF automatizado por provincia/carretera
- **API de prediccion**: Probabilidad de incidencia en X tramo a Y hora
- **Dashboard para flotas**: Panel para empresas de transporte
- **Widget embebible**: Para webs de trafico/noticias
- **Alertas Telegram/WhatsApp**: Bot con notificaciones personalizadas

---

## Machine Learning y Analitica Predictiva

### Objetivo
Predecir incidencias antes de que ocurran y generar insights de valor.

### Requisitos previos (CRITICO)

1. **Historico de datos**: Minimo 3-6 meses de datos almacenados
2. **Datos enriquecidos**: Cruzar con meteorologia, trafico, calendario
3. **Infraestructura**: Base de datos optimizada para queries analiticas

### Modelos a implementar (orden recomendado)

#### NIVEL 1: Estadistica descriptiva (Semana 1-2)
Sin ML, solo agregaciones y visualizacion.

| Analisis | Descripcion | Valor |
|----------|-------------|-------|
| Distribucion horaria | Incidencias por hora del dia | Patrones de uso |
| Distribucion semanal | Dias con mas activaciones | Planificacion |
| Top carreteras | Vias con mas incidencias | Puntos negros |
| Duracion media | Tiempo activo por tipo | Eficiencia |

#### NIVEL 2: Correlaciones (Mes 1-2)
Cruzar con fuentes externas.

| Variable X | Variable Y | Hipotesis |
|------------|------------|-----------|
| Lluvia (AEMET) | Incidencias | Mas lluvia = mas averias |
| Temperatura | Incidencias | Extremos = mas problemas |
| IMD (trafico) | Incidencias | Mas coches = mas eventos |
| Hora punta | Incidencias | Correlacion con trafico |
| Dia festivo | Incidencias | Cambio de patron |

#### NIVEL 3: Modelos predictivos (Mes 2-4)
Machine Learning supervisado.

| Modelo | Input | Output | Uso |
|--------|-------|--------|-----|
| Random Forest | Hora, dia, meteo, carretera | Probabilidad incidencia | Alertas preventivas |
| Time Series (Prophet) | Historico por hora | Prediccion proximas 24h | Planificacion gruas |
| Clustering (K-Means) | Coordenadas, tipo, duracion | Segmentos de incidencias | Patrones geograficos |
| Anomaly Detection | Todas las variables | Score de anomalia | Detectar outliers |

### Stack tecnologico propuesto

| Componente | Tecnologia | Motivo |
|------------|------------|--------|
| Almacenamiento | PostgreSQL + TimescaleDB | Series temporales optimizadas |
| ETL | Apache Airflow o Prefect | Orquestacion de pipelines |
| ML | scikit-learn, Prophet | Modelos probados, facil deploy |
| Visualizacion | Metabase o Grafana | Dashboards sin codigo |
| API predicciones | FastAPI (ya tenemos) | Endpoint /predict |

### Pipeline de datos propuesto

```
[DGT XML] --> [Parser] --> [PostgreSQL]
                              |
                              v
[AEMET API] --> [ETL] --> [Tabla enriquecida]
                              |
                              v
                      [Entrenamiento ML]
                              |
                              v
                      [Modelo guardado]
                              |
                              v
                      [API /predict]
```

### Fases de implementacion ML

| Fase | Duracion | Entregable |
|------|----------|------------|
| 0. Historico | 1 semana | Tabla beacon_history sin borrado |
| 1. ETL AEMET | 1 semana | Datos meteo por municipio/hora |
| 2. Dashboard basico | 1 semana | Graficas en Metabase |
| 3. Modelo v1 | 2 semanas | Random Forest baseline |
| 4. API predict | 1 semana | Endpoint con prediccion |
| 5. Validacion | 2 semanas | Metricas de precision |

### Metricas de exito

| Metrica | Objetivo minimo |
|---------|-----------------|
| Precision prediccion | >70% |
| Recall (detectar incidentes) | >80% |
| Tiempo anticipacion | >15 minutos |
| Latencia API predict | <200ms |

### Casos de uso comerciales

1. **Aseguradoras**: "En la A-6 km 23 hay 40% mas riesgo los viernes a las 18h"
2. **Gruas**: "Prediccion de 3 incidencias en zona Norte proxima hora"
3. **Ayuntamientos**: "Tramo X necesita mejora de senalizacion"
4. **Apps navegacion**: "Ruta alternativa: riesgo elevado en A-2"

---

## Modelo de Precios Propuesto

### API SaaS
| Plan | Limite | Precio |
|------|--------|--------|
| Free | 100 req/dia | 0 euros |
| Starter | 10,000 req/dia | 49 euros/mes |
| Pro | 100,000 req/dia | 199 euros/mes |
| Enterprise | Ilimitado | 499+ euros/mes |

### Alertas para Gruas/Talleres
| Plan | Cobertura | Precio |
|------|-----------|--------|
| Local | Radio 20km | 29 euros/mes |
| Provincial | 1 provincia | 79 euros/mes |
| Nacional | Todo Espana | 199 euros/mes |

---

## Proximos Pasos Recomendados

1. Implementar historico de datos (1.1) - BASE PARA TODO
2. Estadisticas y filtros (1.2, 1.3)
3. Alertas por zona (2.2)
4. API con auth + webhooks (3.1, 3.2)
5. Integracion AEMET para correlacion meteorologica

---

## Potencial de Ingresos

| Mes | Clientes API | Gruas/Talleres | MRR |
|-----|--------------|----------------|-----|
| 3 | 5 | 20 | 1,225 euros |
| 6 | 15 | 50 | 4,175 euros |
| 12 | 40 | 150 | 13,550 euros |

MRR = Monthly Recurring Revenue (estimacion conservadora)

# Prioridades de Desarrollo - DGT V16

Lista ordenada de mayor valor/facilidad a menor valor/dificultad.

---

## PRIORIDAD ALTA (Hacer primero)

| # | Feature | Esfuerzo | Valor | Por que |
|---|---------|----------|-------|---------|
| 1 | **Historico de incidencias** | 1-2 dias | CRITICO | Base para TODO el analisis posterior |
| 2 | **Calcular duracion** | 1 dia | Alto | Metrica clave: tiempo resolucion |
| 3 | **Endpoint estadisticas** | 1 dia | Alto | API vendible inmediatamente |
| 4 | **Clasificar tipo via** | 1 dia | Medio | Regex sobre roadName (A/AP/N/...) |
| 5 | **Filtros en mapa** | 2 dias | Alto | Mejora UX, diferenciacion |

**Total estimado: 1 semana**

---

## PRIORIDAD MEDIA (Semanas 2-4)

| # | Feature | Esfuerzo | Valor | Por que |
|---|---------|----------|-------|---------|
| 6 | **Agregar por CCAA/Provincia** | 2 dias | Medio | Estadisticas regionales |
| 7 | **Detectar puntos calientes** | 3 dias | Alto | Clustering geoespacial |
| 8 | **Buscador de carretera** | 2 dias | Medio | Buscar "A-2" en el mapa |
| 9 | **Exportar datos CSV/JSON** | 1 dia | Medio | Usuarios descargan historico |
| 10 | **PWA + Instalable** | 1 dia | Bajo | manifest.json para movil |

**Total estimado: 2 semanas**

---

## PRIORIDAD MEDIA-BAJA (Mes 2)

| # | Feature | Esfuerzo | Valor | Por que |
|---|---------|----------|-------|---------|
| 11 | **Alertas por zona** | 1 semana | Alto | Suscripcion a carretera |
| 12 | **API con autenticacion** | 1 semana | Alto | API keys, rate limiting |
| 13 | **Webhooks para gruas** | 1 semana | Alto | Notificaciones push |
| 14 | **Integracion AEMET** | 1 semana | Medio | Correlacion meteo |
| 15 | **Dashboard analytics** | 2 semanas | Medio | Graficas tendencias |

**Total estimado: 1 mes**

---

## PRIORIDAD BAJA (Mes 3+)

| # | Feature | Esfuerzo | Valor | Por que |
|---|---------|----------|-------|---------|
| 16 | Mapa de calor dinamico | 1 semana | Medio | Visualizacion densidad |
| 17 | Panel cliente API | 2 semanas | Medio | Dashboard consumo |
| 18 | Landing page comercial | 1 semana | Bajo | Web venta servicio |
| 19 | Bot Telegram/WhatsApp | 2 semanas | Medio | Alertas personalizadas |
| 20 | Widget embebible | 1 semana | Bajo | Para webs trafico |

---

## LARGO PLAZO (6+ meses)

| # | Feature | Esfuerzo | Valor | Por que |
|---|---------|----------|-------|---------|
| 21 | Modelo ML predictivo | 2+ meses | Muy Alto | Requiere 3-6 meses datos |
| 22 | API prediccion | 1 mes | Alto | Endpoint /predict |
| 23 | Integracion Waze/Google | 2+ meses | Alto | Acuerdos comerciales |
| 24 | App movil nativa | 3+ meses | Medio | iOS/Android |
| 25 | Informe PDF automatico | 1 mes | Medio | Siniestralidad mensual |

---

## PROXIMO PASO INMEDIATO

**Implementar #1: Historico de incidencias**

Cambios necesarios:
1. Crear tabla `beacon_history` (no borrar, solo marcar inactivo)
2. Modificar `worker.py` para guardar historial
3. Añadir campo `deleted_at` a beacons
4. Crear endpoint `/api/v1/beacons/history`

Este es el fundamento para TODO lo demas: estadisticas, ML, alertas, etc.

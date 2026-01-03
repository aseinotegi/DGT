🚨 Cuando los datos públicos revelan más de lo que deberían

Hace poco descubrí el fantástico trabajo de Héctor Julián Alijas con su mapa de balizas V16. Me pareció brillante: una visualización en tiempo real de vehículos detenidos en las carreteras españolas.

Quiero dejar claro que no pretendo pisar el trabajo de Héctor. Él ha hecho un trabajo excelente con el tratamiento y visualización de los datos de la DGT. Yo simplemente me inspiré en su iniciativa y quise explorar una dimensión diferente: la detección de vulnerabilidades.

Como ejercicio de investigación, desarrollé un sistema que analiza cada baliza activa considerando:

- Distancia a núcleos urbanos (aislamiento)
- Tiempo que lleva encendida (exposición)  
- Franja horaria (22:00-06:00 = mayor riesgo)
- Tipo de vía (autopista = difícil auxilio)

Con estos cuatro factores, el sistema asigna una puntuación de vulnerabilidad de 0 a 100. Y aquí está el problema: funciona. Demasiado bien.

Pude identificar automáticamente conductores solos, de noche, en carreteras secundarias aisladas, con más de una hora esperando ayuda. Exactamente el perfil que buscaría alguien con malas intenciones.

Los datos de la DGT son públicos, sin autenticación, sin rate-limit, actualizados cada minuto. Cualquiera puede obtener la ubicación exacta de personas en situación de vulnerabilidad en tiempo real.

Este tipo de iniciativas de datos abiertos son fantásticas, pero sin un control óptimo pueden ponernos en peligro. No es una crítica, es una reflexión sobre cómo equilibrar transparencia y seguridad ciudadana.

Puedes verlo aquí: https://mapabalizasv16.info/

Gracias de nuevo a Héctor por el proyecto original que me hizo reflexionar sobre todo esto.

#SeguridadVial #Privacidad #DatosAbiertos #Ciberseguridad
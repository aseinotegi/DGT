🚨 Cuando los datos públicos revelan más de lo que deberían

Hace poco descubrí el fantástico trabajo de Héctor Julián Alijas con su mapa de balizas V16. Me pareció brillante: una visualización en tiempo real de vehículos detenidos en las carreteras españolas. Enhorabuena, Héctor, por la iniciativa y la ejecución técnica.

Como ejercicio de investigación, desarrollé un sistema de detección de personas potencialmente vulnerables. El algoritmo analiza cada baliza activa considerando:

- Distancia a núcleos urbanos (aislamiento)
- Tiempo que lleva encendida (exposición)  
- Franja horaria (22:00-06:00 = mayor riesgo)
- Tipo de vía (autopista = difícil auxilio)

Con estos cuatro factores, el sistema asigna una puntuación de vulnerabilidad de 0 a 100. Y aquí está el problema: funciona. Demasiado bien.

Pude identificar automáticamente conductores solos, de noche, en carreteras secundarias aisladas, con más de una hora esperando ayuda. Exactamente el perfil que buscaría alguien con malas intenciones.

Los datos de la DGT son públicos, sin autenticación, sin rate-limit, actualizados cada minuto. Cualquiera puede obtener la ubicación exacta de personas en situación de vulnerabilidad en tiempo real.

Esto no es una crítica al sistema de balizas V16, que salva vidas. Es una llamada de atención sobre cómo equilibrar transparencia y seguridad. Quizá un delay de 15 minutos, coordenadas aproximadas o algún tipo de control de acceso podrían mitigar estos riesgos sin perder utilidad.

Gracias de nuevo a Héctor por el proyecto original que me hizo reflexionar sobre todo esto.

#SeguridadVial #Privacidad #DatosAbiertos #Ciberseguridad
# Infraestructura

Aqui viven adaptadores concretos que conectan puertos de aplicacion con tecnologias reales.

Implementaciones actuales:

- `createInMemoryScoreRepository`
- `createBrowserStorageScoreRepository`

Adaptadores previstos para siguientes iteraciones:

- game loop basado en `requestAnimationFrame`
- loader de niveles
- reloj real
- generador aleatorio real
- event bus concreto

Esta capa puede depender de `application` y `domain`, pero nunca al reves.

# Infraestructura

Aqui iran adaptadores concretos como:

- game loop basado en `requestAnimationFrame`
- loader de niveles
- persistencia de score
- reloj real
- generador aleatorio real
- event bus concreto

Esta capa puede depender de `application` y `domain`, pero nunca al reves.

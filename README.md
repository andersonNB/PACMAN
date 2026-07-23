# Pac-Man-like Architecture Practice

Este proyecto arranca como un motor de simulacion 2D desacoplado de cualquier tecnologia visual.

## Objetivo

Practicar:

- Clean Architecture
- DDD pragmatico
- modelado de dominio
- game loop determinista
- estrategias de enemigos
- maquinas de estado
- testing de logica pura

## Estado actual

Esta primera entrega incluye:

- documentacion de dominio y arquitectura en [docs/architecture.md](/C:/PROYECTOS-PERSONALES/PACMAN/docs/architecture.md)
- contratos base de `domain` y `application`
- estructura inicial por capas

No incluye aun:

- gameplay completo
- renderizado
- game loop real
- persistencia real
- tests automatizados

## Estructura

```text
src/
  application/
  domain/
  infrastructure/
  presentation/
docs/
```

## Regla principal

La logica del juego no depende de React, Next.js, Canvas, DOM ni `requestAnimationFrame`.

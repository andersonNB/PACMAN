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

El proyecto incluye un motor de simulacion determinista, demo jugable en Canvas, loop de timestep fijo, input de teclado, ranking local y pruebas unitarias de dominio y aplicacion.

El laberinto del navegador usa un layout arcade declarativo con tunel lateral, casa de fantasmas y cuatro fantasmas con roles diferenciados.

## Ejecutar el demo

```powershell
npm run demo:browser
```

Abre `http://127.0.0.1:4173`. Usa flechas o `WASD` para moverte, `Espacio` para pausar, `R` para reiniciar y `Tab` para el overlay de debug.

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

## Fase 27: fruit temporal

- `fruitVisibleDurationMs` define cuanto permanece visible el bonus fruit tras activarse.
- La simulacion fija descuenta el temporizador; al expirar, el fruit no vuelve a aparecer en el nivel.
- El snapshot diferencia una expiracion de una recoleccion para evitar feedback visual o puntos falsos.

## Fase 35: laberinto arcade

- El demo visual usa un tablero 21x19 con cuatro spawns de enemigos, tunel lateral y ghost house central.
- El nivel sigue siendo una definicion declarativa consumida por el dominio; el renderer no contiene rutas ni colisiones codificadas.

## Fase 36: cierre visual de nivel

- Durante `levelCompleted`, el laberinto alterna entre azul y blanco mientras el dominio resuelve el temporizador hacia `Victory`.
- Los actores se ocultan durante el destello para reproducir la transicion visual del arcade sin acoplar el renderer a la simulacion.

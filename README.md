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

Abre `http://127.0.0.1:4173`. Usa la cruceta, flechas o `WASD` para moverte, `Espacio` para pausar, `R` para reiniciar y `G` para debug. Los botones tambien permiten iniciar, pausar y reiniciar; `Tab` mueve el foco entre ellos.

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

## Fase 37: retorno rapido a casa

- Los fantasmas que fueron comidos regresan a la casa a una velocidad configurable, independiente de los multiplicadores `Frightened` y Elroy.
- El demo usa `1.55x` para hacer visible el retorno de los ojos al centro del laberinto.

## Fase 38: reentrada de fantasmas

- Al llegar a casa, el fantasma recupera su cuerpo, espera 1.5 segundos y vuelve a salir.
- `returningHomeReleaseDelayMs` configura esa espera; `G` muestra la cuenta regresiva `reentry` en debug.
- La pausa congela el temporizador y reiniciar elimina cualquier espera pendiente.

## Fase 39: rutas fiables hacia la casa

- Los ojos y los fantasmas que salen de casa calculan rutas minimas con BFS, respetando paredes, accesos y tuneles.
- Durante el retorno pueden invertir direccion para seguir la ruta; si la casa es inaccesible, se detienen.
- En el demo, come un fantasma con un potenciador para observar su regreso y nueva salida.

## Fase 40: controles tactiles y accesibles

- Cruceta y botones de Start, Pause/Resume, Restart y Debug bajo el tablero, disponibles con raton o pantalla tactil.
- El canvas conserva su proporcion en movil y el HUD se adapta a dos columnas en pantallas pequenas.
- `Tab` permite navegar por los controles; `Enter` o `Espacio` activan el boton enfocado. El atajo de debug pasa a `G`.

## Fase 41: gestos de deslizamiento

- Desliza un dedo o lapiz sobre el tablero para solicitar una direccion, incluso durante READY para anticipar el primer movimiento.
- Se ignoran toques, movimientos menores a 24 pixeles y diagonales ambiguas. La direccion se solicita al levantar el dedo.
- El desplazamiento de la pagina se bloquea solo dentro del tablero; fuera de el puedes seguir haciendo scroll.

## Fase 42: pausa segura en segundo plano

- Cambiar de pestana o salir de la ventana pausa Running y READY; al volver pulsa Resume para continuar.
- La cuenta regresiva READY conserva su tiempo y la direccion solicitada durante la pausa.
- El loop descarta el tiempo en segundo plano, evitando saltos y movimientos acumulados al regresar.

## Fase 43: validacion de mapas jugables

- El demo valida el nivel antes de iniciar: debe haber pellets, todos los consumibles deben ser accesibles y los spawns de fantasmas deben estar conectados al laberinto.
- Un mapa invalido muestra un mensaje con el tipo de problema y coordenadas de celda (desde cero), sin arrancar el loop.
- La carga rechaza multiples spawns del jugador. El mapa arcade actual supera la validacion.

## Fase 44: ranking resistente a errores de almacenamiento

- El juego puede iniciar aunque el navegador bloquee `localStorage`.
- Si leer o guardar falla, conserva el ranking en memoria durante la sesion y muestra un aviso junto a High Scores.
- Cuando el almacenamiento funciona, las puntuaciones siguen disponibles al recargar como antes.

## Fase 45: inversion de direccion entre celdas

- Solicitar la direccion opuesta hace que el jugador invierta en el siguiente tick, sin esperar al centro de la celda ni cambiar su posicion de golpe.
- Los giros de 90 grados siguen almacenados hasta una interseccion valida.
- La inversion y la continuidad del movimiento tambien funcionan al cruzar la union del tunel lateral.

## Fase 46: movimiento continuo de fantasmas

- Los fantasmas llegan al centro de las esquinas sin frenarse en el borde de la celda durante ticks pequenos.
- Las consultas de movimiento usan la celda de origen del trayecto y normalizan la union de tuneles.
- El regreso y salida de los cuatro fantasmas se verifican en el mapa real con ticks de 100 ms, iguales a los del demo.

## Fase 47: expiracion consistente del potenciador

- Cuando el temporizador llega a cero, los fantasmas recuperan el modo global y su velocidad normal antes de moverse y resolver colisiones.
- Ya no hay un tick adicional en el que puedan comerse tras expirar el efecto.
- Recoger otro pellet renueva la proteccion y reinicia el combo antes de evaluar una colision en ese tick.

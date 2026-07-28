import { advanceGameSession, createGameSession, pauseGameSession, requestDirectionForSession, restartGameSession, resumeGameSession, startGameSession, toGameSnapshot, type SessionConfig } from "../application/game-session.js";
import { createBoard } from "../domain/board.js";
import { createDeterministicRandom } from "../domain/enemy.js";
import type { GameState } from "../domain/entities.js";
import { worldToTilePosition } from "../domain/player.js";
import type { Direction } from "../domain/value-objects.js";
import type { LevelDefinition } from "../domain/board.js";

const FIXED_TICK_MS = 100;
const TILE_SIZE = 34;
const HUD_HEIGHT = 110;

const COLORS = {
  background: "#07111f",
  backgroundAccent: "#0d223d",
  wall: "#3b86ff",
  wallGlow: "rgba(95, 162, 255, 0.35)",
  pellet: "#ffd86b",
  player: "#ffd400",
  tunnel: "#173b6f",
  path: "#08111e",
  text: "#f4f8ff",
  muted: "#96afcc",
  chase: "#ff5e7e",
  patrol: "#50e4ff",
  random: "#ff9b3d",
  frightened: "#2f63ff"
} as const;

export type BrowserDemoConfig = Readonly<{
  root: HTMLElement;
  level: LevelDefinition;
  sessionConfig: SessionConfig;
}>;

export const startBrowserDemo = (config: BrowserDemoConfig): void => {
  const board = createBoard(config.level);
  let state = createInitialState();
  let previousState = state;
  let accumulator = 0;
  let lastFrameTime = performance.now();
  let animationFrameId = 0;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (context === null) {
    throw new Error("Canvas 2D context is not available.");
  }

  canvas.width = board.width * TILE_SIZE;
  canvas.height = board.height * TILE_SIZE;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  canvas.style.maxWidth = "100%";
  canvas.style.borderRadius = "18px";
  canvas.style.boxShadow = "0 32px 70px rgba(0, 0, 0, 0.45)";
  canvas.style.border = "1px solid rgba(136, 196, 255, 0.22)";

  const frame = createFrameElement(canvas, config.root);
  const statusValue = frame.querySelector("[data-role='status-value']");
  const scoreValue = frame.querySelector("[data-role='score-value']");
  const livesValue = frame.querySelector("[data-role='lives-value']");
  const hintValue = frame.querySelector("[data-role='hint-value']");

  if (!(statusValue instanceof HTMLElement) || !(scoreValue instanceof HTMLElement) || !(livesValue instanceof HTMLElement) || !(hintValue instanceof HTMLElement)) {
    throw new Error("Browser demo frame is missing required HUD elements.");
  }

  const nextRandom = createDeterministicRandom([0.17, 0.82, 0.39, 0.63, 0.28, 0.91]);

  const onKeyDown = (event: KeyboardEvent): void => {
    const direction = mapKeyToDirection(event.key);

    if (direction !== null) {
      event.preventDefault();
      state = requestDirectionForSession(state, direction);
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      state = state.status === "paused" ? resumeGameSession(state) : pauseGameSession(state);
      return;
    }

    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      state = restartGameSession(state);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (state.status === "idle") {
        state = startGameSession(state);
        return;
      }

      if (state.status === "gameOver" || state.status === "victory") {
        state = startGameSession(restartGameSession(state));
      }
    }
  };

  const render = (alpha: number): void => {
    const snapshot = toGameSnapshot(state);
    const previousSnapshot = toGameSnapshot(previousState);

    statusValue.textContent = humanizeStatus(snapshot.status);
    scoreValue.textContent = String(snapshot.score);
    livesValue.textContent = String(snapshot.lives);
    hintValue.textContent = snapshot.status === "idle"
      ? "Press Enter to start"
      : "Arrows/WASD to move • Space pause • R restart";

    context.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard(context, board);
    drawCollectibles(context, snapshot.collectibles);
    drawEnemies(context, previousSnapshot, snapshot, alpha);
    drawPlayer(context, previousSnapshot, snapshot, alpha);
    drawStatusOverlay(context, snapshot.status, canvas.width, canvas.height);
  };

  const step = (time: number): void => {
    const frameDelta = Math.min(time - lastFrameTime, 250);
    lastFrameTime = time;
    accumulator += frameDelta;

    while (accumulator >= FIXED_TICK_MS) {
      previousState = state;
      state = advanceGameSession(state, FIXED_TICK_MS, nextRandom);
      accumulator -= FIXED_TICK_MS;
    }

    render(accumulator / FIXED_TICK_MS);
    animationFrameId = window.requestAnimationFrame(step);
  };

  document.addEventListener("keydown", onKeyDown);
  render(0);
  animationFrameId = window.requestAnimationFrame(step);

  window.addEventListener("beforeunload", () => {
    document.removeEventListener("keydown", onKeyDown);
    window.cancelAnimationFrame(animationFrameId);
  }, { once: true });

  function createInitialState(): GameState {
    return createGameSession(board, config.sessionConfig);
  }
};

const createFrameElement = (canvas: HTMLCanvasElement, root: HTMLElement): HTMLElement => {
  root.innerHTML = "";

  const shell = document.createElement("div");
  shell.style.minHeight = "100vh";
  shell.style.display = "grid";
  shell.style.placeItems = "center";
  shell.style.padding = "40px 20px";

  const panel = document.createElement("section");
  panel.style.width = "min(960px, 100%)";
  panel.style.display = "grid";
  panel.style.gap = "18px";
  panel.style.padding = "26px";
  panel.style.border = "1px solid rgba(136, 196, 255, 0.22)";
  panel.style.borderRadius = "28px";
  panel.style.background = "rgba(6, 16, 30, 0.82)";
  panel.style.backdropFilter = "blur(16px)";
  panel.style.boxShadow = "0 32px 80px rgba(0, 0, 0, 0.4)";

  const title = document.createElement("div");
  title.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-end;flex-wrap:wrap;">
      <div>
        <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#96afcc;">Phase 7 Visual Adapter</div>
        <h1 style="margin:8px 0 0;font-size:clamp(28px, 5vw, 52px);line-height:0.95;">PACMAN<br/>Architecture Demo</h1>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3, minmax(90px, 1fr));gap:12px;min-width:min(100%, 360px);">
        <div style="padding:12px 14px;border-radius:16px;background:rgba(18,35,62,0.7);border:1px solid rgba(136,196,255,0.18);">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#96afcc;">Status</div>
          <div data-role="status-value" style="margin-top:6px;font-size:18px;font-weight:700;">Idle</div>
        </div>
        <div style="padding:12px 14px;border-radius:16px;background:rgba(18,35,62,0.7);border:1px solid rgba(136,196,255,0.18);">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#96afcc;">Score</div>
          <div data-role="score-value" style="margin-top:6px;font-size:18px;font-weight:700;">0</div>
        </div>
        <div style="padding:12px 14px;border-radius:16px;background:rgba(18,35,62,0.7);border:1px solid rgba(136,196,255,0.18);">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#96afcc;">Lives</div>
          <div data-role="lives-value" style="margin-top:6px;font-size:18px;font-weight:700;">0</div>
        </div>
      </div>
    </div>
  `;

  const hint = document.createElement("div");
  hint.setAttribute("data-role", "hint-value");
  hint.style.padding = "12px 14px";
  hint.style.borderRadius = "16px";
  hint.style.color = "#96afcc";
  hint.style.background = "linear-gradient(90deg, rgba(13,34,61,0.95), rgba(8,17,30,0.95))";
  hint.style.border = "1px solid rgba(136,196,255,0.18)";
  hint.textContent = "Press Enter to start";

  panel.append(title, canvas, hint);
  shell.append(panel);
  root.append(shell);

  return panel;
};

const drawBoard = (context: CanvasRenderingContext2D, board: ReturnType<typeof createBoard>): void => {
  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, board.width * TILE_SIZE, board.height * TILE_SIZE);

  for (const tile of board.tiles) {
    const x = tile.position.column * TILE_SIZE;
    const y = tile.position.row * TILE_SIZE;

    if (tile.kind === "wall") {
      context.fillStyle = COLORS.wallGlow;
      context.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      context.fillStyle = COLORS.wall;
      roundRect(context, x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12, 9);
      context.fill();
      continue;
    }

    context.fillStyle = tile.kind === "tunnel" ? COLORS.tunnel : COLORS.path;
    context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }
};

const drawCollectibles = (
  context: CanvasRenderingContext2D,
  collectibles: ReturnType<typeof toGameSnapshot>["collectibles"]
): void => {
  collectibles.forEach((collectible) => {
    if (!collectible.active) {
      return;
    }

    const radius = collectible.kind === "powerPellet" ? 5 : 3;
    const centerX = collectible.tile.column * TILE_SIZE + TILE_SIZE / 2;
    const centerY = collectible.tile.row * TILE_SIZE + TILE_SIZE / 2;

    context.beginPath();
    context.fillStyle = COLORS.pellet;
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fill();
  });
};

const drawPlayer = (
  context: CanvasRenderingContext2D,
  previousSnapshot: ReturnType<typeof toGameSnapshot>,
  currentSnapshot: ReturnType<typeof toGameSnapshot>,
  alpha: number
): void => {
  const position = interpolatePosition(previousSnapshot.player.position, currentSnapshot.player.position, alpha);
  const mouthAngle = currentSnapshot.status === "paused" ? 0.12 : 0.25 + Math.abs(Math.sin(performance.now() / 90)) * 0.16;
  const directionAngle = directionToAngle(currentSnapshot.player.currentDirection);
  const radius = TILE_SIZE * 0.36;

  context.beginPath();
  context.moveTo(position.x * TILE_SIZE, position.y * TILE_SIZE);
  context.fillStyle = COLORS.player;
  context.arc(
    position.x * TILE_SIZE,
    position.y * TILE_SIZE,
    radius,
    directionAngle + mouthAngle,
    directionAngle - mouthAngle + Math.PI * 2
  );
  context.closePath();
  context.fill();
};

const drawEnemies = (
  context: CanvasRenderingContext2D,
  previousSnapshot: ReturnType<typeof toGameSnapshot>,
  currentSnapshot: ReturnType<typeof toGameSnapshot>,
  alpha: number
): void => {
  currentSnapshot.enemies.forEach((enemy) => {
    const previousEnemy = previousSnapshot.enemies.find((candidate) => candidate.id === enemy.id) ?? enemy;
    const position = interpolatePosition(previousEnemy.position, enemy.position, alpha);
    const color = enemy.behaviorMode === "frightened"
      ? COLORS.frightened
      : enemy.id.endsWith("1")
        ? COLORS.chase
        : enemy.id.endsWith("2")
          ? COLORS.patrol
          : COLORS.random;

    drawGhost(context, position.x * TILE_SIZE, position.y * TILE_SIZE, color);
  });
};

const drawGhost = (context: CanvasRenderingContext2D, centerX: number, centerY: number, color: string): void => {
  const width = TILE_SIZE * 0.74;
  const height = TILE_SIZE * 0.72;
  const left = centerX - width / 2;
  const top = centerY - height / 2;
  const bottom = top + height;

  context.beginPath();
  context.moveTo(left, bottom);
  context.lineTo(left, top + height * 0.46);
  context.quadraticCurveTo(left, top, centerX, top);
  context.quadraticCurveTo(left + width, top, left + width, top + height * 0.46);
  context.lineTo(left + width, bottom);
  context.lineTo(left + width * 0.82, bottom - 5);
  context.lineTo(left + width * 0.64, bottom);
  context.lineTo(left + width * 0.5, bottom - 5);
  context.lineTo(left + width * 0.36, bottom);
  context.lineTo(left + width * 0.18, bottom - 5);
  context.closePath();
  context.fillStyle = color;
  context.fill();

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(centerX - 7, centerY - 2, 5, 0, Math.PI * 2);
  context.arc(centerX + 7, centerY - 2, 5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#07111f";
  context.beginPath();
  context.arc(centerX - 6, centerY - 1, 2.2, 0, Math.PI * 2);
  context.arc(centerX + 6, centerY - 1, 2.2, 0, Math.PI * 2);
  context.fill();
};

const drawStatusOverlay = (
  context: CanvasRenderingContext2D,
  status: ReturnType<typeof toGameSnapshot>["status"],
  width: number,
  height: number
): void => {
  if (status === "running") {
    return;
  }

  const label = humanizeStatus(status);
  context.fillStyle = "rgba(4, 9, 18, 0.56)";
  context.fillRect(0, 0, width, height);
  context.fillStyle = COLORS.text;
  context.font = '700 32px "Trebuchet MS", sans-serif';
  context.textAlign = "center";
  context.fillText(label, width / 2, height / 2);
};

const roundRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void => {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
};

const interpolatePosition = (
  previous: { x: number; y: number },
  current: { x: number; y: number },
  alpha: number
): { x: number; y: number } => ({
  x: previous.x + (current.x - previous.x) * alpha,
  y: previous.y + (current.y - previous.y) * alpha
});

const mapKeyToDirection = (key: string): Direction | null => {
  if (key === "ArrowUp" || key.toLowerCase() === "w") {
    return "up";
  }

  if (key === "ArrowDown" || key.toLowerCase() === "s") {
    return "down";
  }

  if (key === "ArrowLeft" || key.toLowerCase() === "a") {
    return "left";
  }

  if (key === "ArrowRight" || key.toLowerCase() === "d") {
    return "right";
  }

  return null;
};

const directionToAngle = (direction: Direction): number => {
  if (direction === "up") {
    return -Math.PI / 2;
  }

  if (direction === "down") {
    return Math.PI / 2;
  }

  if (direction === "left") {
    return Math.PI;
  }

  return 0;
};

const humanizeStatus = (status: ReturnType<typeof toGameSnapshot>["status"]): string => {
  if (status === "idle") {
    return "Idle";
  }

  if (status === "running") {
    return "Running";
  }

  if (status === "paused") {
    return "Paused";
  }

  if (status === "playerDying") {
    return "Player Dying";
  }

  if (status === "levelCompleted") {
    return "Level Completed";
  }

  if (status === "gameOver") {
    return "Game Over";
  }

  return "Victory";
};

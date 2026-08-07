import {
  advanceGameSession,
  createGameSession,
  pauseGameSession,
  requestDirectionForSession,
  restartGameSession,
  resumeGameSession,
  startGameSession,
  toGameSnapshot,
  type SessionConfig
} from "../application/game-session.js";
import type { ScoreEntry, ScoreRepository } from "../application/ports.js";
import { createBoard, type LevelDefinition } from "../domain/board.js";
import { createDeterministicRandom } from "../domain/enemy.js";
import type { GameState } from "../domain/entities.js";
import type { Direction } from "../domain/value-objects.js";

const FIXED_TICK_MS = 100;
const TILE_SIZE = 34;

const COLORS = {
  background: "#07111f",
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
  frightened: "#2f63ff",
  debug: "rgba(150, 175, 204, 0.22)"
} as const;

export type BrowserDemoConfig = Readonly<{
  root: HTMLElement;
  level: LevelDefinition;
  sessionConfig: SessionConfig;
  scoreRepository?: ScoreRepository;
  playerName?: string;
}>;

export const startBrowserDemo = (config: BrowserDemoConfig): void => {
  const board = createBoard(config.level);
  let state = createInitialState();
  let previousState = state;
  let accumulator = 0;
  let lastFrameTime = performance.now();
  let animationFrameId = 0;
  let scoreWasPersisted = false;
  let debugEnabled = false;

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
  const statusValue = getElement(frame, "status-value");
  const scoreValue = getElement(frame, "score-value");
  const livesValue = getElement(frame, "lives-value");
  const hintValue = getElement(frame, "hint-value");
  const rankingValue = getElement(frame, "ranking-value");
  const debugValue = getElement(frame, "debug-value");

  const nextRandom = createDeterministicRandom([0.17, 0.82, 0.39, 0.63, 0.28, 0.91]);

  void refreshRanking();

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
      previousState = state;
      scoreWasPersisted = false;
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      debugEnabled = !debugEnabled;
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
        previousState = state;
        scoreWasPersisted = false;
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
      : "Arrows/WASD move | Space pause | R restart | Tab debug";
    debugValue.innerHTML = createDebugText(snapshot, debugEnabled);

    context.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard(context, board);
    drawCollectibles(context, snapshot.collectibles);
    drawEnemies(context, previousSnapshot, snapshot, alpha);
    drawPlayer(context, previousSnapshot, snapshot, alpha);

    if (debugEnabled) {
      drawDebugGrid(context, board.width, board.height);
    }

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

    const status = state.status;

    if (!scoreWasPersisted && (status === "gameOver" || status === "victory")) {
      scoreWasPersisted = true;
      void persistScore();
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

  async function persistScore(): Promise<void> {
    if (config.scoreRepository === undefined) {
      return;
    }

    await config.scoreRepository.save({
      playerName: config.playerName ?? "Player",
      score: state.score.value,
      achievedAtIso: new Date().toISOString()
    });

    await refreshRanking();
  }

  async function refreshRanking(): Promise<void> {
    if (config.scoreRepository === undefined) {
      rankingValue.innerHTML = "<div>No score repository configured.</div>";
      return;
    }

    const entries = await config.scoreRepository.listTop(5);
    rankingValue.innerHTML = renderRanking(entries);
  }
};

const getElement = (root: HTMLElement, role: string): HTMLElement => {
  const element = root.querySelector(`[data-role='${role}']`);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Browser demo frame is missing required element '${role}'.`);
  }

  return element;
};

const createFrameElement = (canvas: HTMLCanvasElement, root: HTMLElement): HTMLElement => {
  root.innerHTML = "";

  const shell = document.createElement("div");
  shell.style.minHeight = "100vh";
  shell.style.display = "grid";
  shell.style.placeItems = "center";
  shell.style.padding = "40px 20px";

  const panel = document.createElement("section");
  panel.style.width = "min(1180px, 100%)";
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
        <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#96afcc;">Phase 11 Scatter / Chase Cycle</div>
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

  const content = document.createElement("div");
  content.style.display = "grid";
  content.style.gridTemplateColumns = "minmax(0, 1.7fr) minmax(280px, 0.9fr)";
  content.style.gap = "18px";

  const leftColumn = document.createElement("div");
  leftColumn.style.display = "grid";
  leftColumn.style.gap = "18px";

  const rightColumn = document.createElement("div");
  rightColumn.style.display = "grid";
  rightColumn.style.gap = "18px";

  const hint = document.createElement("div");
  hint.setAttribute("data-role", "hint-value");
  hint.style.padding = "12px 14px";
  hint.style.borderRadius = "16px";
  hint.style.color = COLORS.muted;
  hint.style.background = "linear-gradient(90deg, rgba(13,34,61,0.95), rgba(8,17,30,0.95))";
  hint.style.border = "1px solid rgba(136,196,255,0.18)";
  hint.textContent = "Press Enter to start";

  const rankingCard = createSideCard("High Scores", "Top scores persisted by infrastructure adapters.");
  const rankingValue = document.createElement("div");
  rankingValue.setAttribute("data-role", "ranking-value");
  rankingValue.style.display = "grid";
  rankingValue.style.gap = "8px";
  rankingValue.style.color = COLORS.text;
  rankingValue.innerHTML = "<div>Loading...</div>";
  rankingCard.append(rankingValue);

  const debugCard = createSideCard("Debug Overlay", "Snapshot-derived diagnostics outside the game domain.");
  const debugValue = document.createElement("div");
  debugValue.setAttribute("data-role", "debug-value");
  debugValue.style.fontFamily = '"Consolas", "Courier New", monospace';
  debugValue.style.fontSize = "13px";
  debugValue.style.lineHeight = "1.6";
  debugValue.style.color = COLORS.muted;
  debugCard.append(debugValue);

  leftColumn.append(canvas, hint);
  rightColumn.append(rankingCard, debugCard);
  content.append(leftColumn, rightColumn);
  panel.append(title, content);
  shell.append(panel);
  root.append(shell);

  return panel;
};

const createSideCard = (title: string, description: string): HTMLElement => {
  const card = document.createElement("section");
  card.style.padding = "16px";
  card.style.borderRadius = "18px";
  card.style.background = "rgba(18,35,62,0.7)";
  card.style.border = "1px solid rgba(136,196,255,0.18)";
  card.style.display = "grid";
  card.style.gap = "10px";

  const heading = document.createElement("div");
  heading.innerHTML = `
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#96afcc;">${escapeHtml(title)}</div>
    <div style="margin-top:6px;color:#c9dbf2;font-size:13px;">${escapeHtml(description)}</div>
  `;

  card.append(heading);
  return card;
};

const renderRanking = (entries: readonly ScoreEntry[]): string => {
  if (entries.length === 0) {
    return "<div>No scores yet. Finish a run to persist the first entry.</div>";
  }

  return entries
    .map((entry, index) =>
      `<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:12px;background:rgba(8,17,30,0.7);border:1px solid rgba(136,196,255,0.1);">
        <span>${index + 1}. ${escapeHtml(entry.playerName)}</span>
        <strong>${entry.score}</strong>
      </div>`
    )
    .join("");
};

const createDebugText = (
  snapshot: ReturnType<typeof toGameSnapshot>,
  debugEnabled: boolean
): string => {
  if (!debugEnabled) {
    return "Press Tab to toggle simulation diagnostics.";
  }

  return [
    `tick: ${snapshot.tick}`,
    `status: ${snapshot.status}`,
    `frightened: ${snapshot.frightenedTimerMs === null ? "off" : `${snapshot.frightenedTimerMs}ms`}`,
    `chain: ${snapshot.frightenedChainCount}`,
    `mode: ${snapshot.globalEnemyMode} (${snapshot.globalEnemyModeTimerMs}ms)`,
    `player: (${snapshot.player.position.x.toFixed(2)}, ${snapshot.player.position.y.toFixed(2)})`,
    `direction: ${snapshot.player.currentDirection} -> ${snapshot.player.requestedDirection}`,
    `active collectibles: ${snapshot.collectibles.filter((collectible) => collectible.active).length}`,
    `enemies: ${snapshot.enemies.map((enemy) => `${enemy.id}:${enemy.behaviorMode}`).join(" | ")}`
  ]
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");
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
    const color = enemy.navigationState === "returningHome"
      ? "#dfe8ff"
      : enemy.behaviorMode === "frightened"
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

const drawDebugGrid = (context: CanvasRenderingContext2D, columns: number, rows: number): void => {
  context.save();
  context.strokeStyle = COLORS.debug;
  context.lineWidth = 1;

  for (let column = 0; column <= columns; column += 1) {
    const x = column * TILE_SIZE;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, rows * TILE_SIZE);
    context.stroke();
  }

  for (let row = 0; row <= rows; row += 1) {
    const y = row * TILE_SIZE;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(columns * TILE_SIZE, y);
    context.stroke();
  }

  context.restore();
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

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

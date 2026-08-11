import type { GameSnapshot } from "./contracts.js";
import type { Board, GameState, SessionConfigState } from "../domain/entities.js";
import { createCollectiblesFromBoard, collectAtPlayerTile, type CollectibleConfig } from "../domain/collectibles.js";
import {
  advanceEnemy,
  createEnemies,
  detectEnemyCollision,
  getDefaultEnemyBehaviorMode,
  markEnemyAsReturningHome,
  releaseEnemyFromHome,
  setEnemyBehaviorMode,
  type RandomNumberSource
} from "../domain/enemy.js";
import { createPlayer, advancePlayer, requestPlayerDirection } from "../domain/player.js";
import type { Direction } from "../domain/value-objects.js";

export type SessionConfig = Readonly<{
  playerSpeedUnitsPerSecond: number;
  enemySpeedUnitsPerSecond: number;
  frightenedDurationMs: number;
  enemyReleaseScheduleMs: readonly number[];
  enemyModeSchedule: readonly Readonly<{
    mode: "scatter" | "chase";
    durationMs: number;
  }>[];
  initialLives: number;
  scoring: CollectibleConfig & Readonly<{
    enemyPoints: number;
  }>;
  respawnDelayMs: number;
  levelCompletedDelayMs: number;
}>;

export const createGameSession = (board: Board, config: SessionConfig): GameState =>
  createInitialGameState(board, toSessionConfigState(config));

export const startGameSession = (state: GameState): GameState =>
  state.status === "idle"
    ? {
        ...state,
        status: "running"
      }
    : state;

export const pauseGameSession = (state: GameState): GameState =>
  state.status === "running"
    ? {
        ...state,
        status: "paused"
      }
    : state;

export const resumeGameSession = (state: GameState): GameState =>
  state.status === "paused"
    ? {
        ...state,
        status: "running"
      }
    : state;

export const restartGameSession = (state: GameState): GameState =>
  createInitialGameState(state.board, state.sessionConfig);

export const requestDirectionForSession = (state: GameState, direction: Direction): GameState => ({
  ...state,
  player: requestPlayerDirection(state.player, direction)
});

export const advanceGameSession = (
  state: GameState,
  deltaMs: number,
  nextRandom: RandomNumberSource = Math.random
): GameState => {
  if (state.status === "paused" || state.status === "idle" || state.status === "gameOver" || state.status === "victory") {
    return state;
  }

  if (state.status === "playerDying") {
    return advancePlayerDyingState(state, deltaMs);
  }

  if (state.status === "levelCompleted") {
    return advanceLevelCompletedState(state, deltaMs);
  }

  const previousPlayerPosition = state.player.position;
  const previousEnemyPositions = new Map(state.enemies.map((enemy) => [enemy.id, enemy.position] as const));

  const player = advancePlayer({
    board: state.board,
    player: state.player,
    deltaMs
  });

  const collectionResult = collectAtPlayerTile({
    collectibles: state.collectibles,
    playerPosition: player.position
  });

  const frightenedTimerMs = resolveFrightenedTimer(state, deltaMs, collectionResult.frightenedTriggered);
  const modeProgression = resolveGlobalEnemyMode(state, deltaMs, frightenedTimerMs);
  const releaseProgression = resolveEnemyRelease(state, deltaMs);
  const enemiesWithMode = applyGlobalEnemyMode(releaseProgression.enemies, modeProgression.mode);

  const enemiesWithCurrentMode = collectionResult.frightenedTriggered
    ? enemiesWithMode.map((enemy) => setEnemyBehaviorMode(enemy, "frightened"))
    : enemiesWithMode;

  const enemies = enemiesWithCurrentMode.map((enemy) =>
    advanceEnemy({
      board: state.board,
      enemy,
      playerPosition: player.position,
      deltaMs,
      nextRandom
    })
  );

  const collidedEnemies = enemies.filter((enemy) =>
    detectEnemyCollision({
      playerPosition: player.position,
      previousPlayerPosition,
      enemy,
      previousEnemyPosition: previousEnemyPositions.get(enemy.id) ?? enemy.position
    })
  );

  const dangerousCollisions = collidedEnemies.filter(
    (enemy) => enemy.navigationState === "outside" && enemy.behaviorMode !== "frightened"
  );

  if (dangerousCollisions.length > 0) {
    const remainingLives = state.lives.value - 1;

    return {
      ...state,
      player: createPlayer({
        spawnTile: state.board.playerSpawn,
        velocity: state.player.velocity
      }),
      enemies: createEnemies(state.board, state.enemies[0]?.velocity ?? { unitsPerSecond: 1 }),
      lives: { value: Math.max(remainingLives, 0) },
      status: remainingLives <= 0 ? "gameOver" : "playerDying",
      phaseTimerMs: remainingLives <= 0 ? null : state.sessionConfig.respawnDelayMs,
      frightenedTimerMs: null,
      frightenedChainCount: 0,
      nextEnemyReleaseIndex: 1,
      enemyReleaseTimerMs: state.sessionConfig.enemyReleaseScheduleMs[0] ?? null,
      tick: state.tick + 1
    };
  }

  const frightenedCollisionIds = new Set(
    collidedEnemies
      .filter((enemy) => enemy.behaviorMode === "frightened")
      .map((enemy) => enemy.id)
  );
  const frightenedCollisionCount = frightenedCollisionIds.size;
  const enemiesAfterCollision = enemies.map((enemy) =>
    frightenedCollisionIds.has(enemy.id) ? markEnemyAsReturningHome(enemy) : enemy
  );
  const normalizedEnemies = normalizeEnemyModes(enemiesAfterCollision, frightenedTimerMs);
  const frightenedChainCount = resolveFrightenedChainCount(
    state,
    frightenedCollisionCount,
    frightenedTimerMs,
    collectionResult.frightenedTriggered
  );
  const frightenedEnemyScore = computeFrightenedEnemyScore(
    state.sessionConfig.scoring.enemyPoints,
    collectionResult.frightenedTriggered ? 0 : state.frightenedChainCount,
    frightenedCollisionCount
  );

  return {
    ...state,
    player,
    enemies: normalizedEnemies,
    collectibles: collectionResult.collectibles,
    score: {
      value:
        state.score.value
        + collectionResult.scoreDelta
        + frightenedEnemyScore
    },
    status: collectionResult.nextStatus === null ? state.status : collectionResult.nextStatus,
    phaseTimerMs:
      collectionResult.nextStatus === "levelCompleted" ? state.sessionConfig.levelCompletedDelayMs : state.phaseTimerMs,
    frightenedTimerMs,
    frightenedChainCount,
    globalEnemyMode: modeProgression.mode,
    globalEnemyModeIndex: modeProgression.index,
    globalEnemyModeTimerMs: modeProgression.timerMs,
    nextEnemyReleaseIndex: releaseProgression.nextEnemyReleaseIndex,
    enemyReleaseTimerMs: releaseProgression.enemyReleaseTimerMs,
    tick: state.tick + 1
  };
};

export const toGameSnapshot = (state: GameState): GameSnapshot => ({
  status: state.status,
  tick: state.tick,
  score: state.score.value,
  lives: state.lives.value,
  frightenedTimerMs: state.frightenedTimerMs,
  frightenedChainCount: state.frightenedChainCount,
  globalEnemyMode: state.globalEnemyMode,
  globalEnemyModeTimerMs: state.globalEnemyModeTimerMs,
  enemyReleaseTimerMs: state.enemyReleaseTimerMs,
  player: {
    position: state.player.position,
    currentDirection: state.player.currentDirection,
    requestedDirection: state.player.requestedDirection
  },
  enemies: state.enemies.map((enemy) => ({
    id: enemy.id,
    position: enemy.position,
    currentDirection: enemy.currentDirection,
    behaviorMode: enemy.behaviorMode,
    navigationState: enemy.navigationState
  })),
  collectibles: state.collectibles.map((collectible) => ({
    id: collectible.id,
    kind: collectible.kind,
    tile: collectible.tile,
    active: collectible.active
  }))
});

const advancePlayerDyingState = (state: GameState, deltaMs: number): GameState => {
  const remainingTimerMs = Math.max((state.phaseTimerMs ?? 0) - deltaMs, 0);

  if (remainingTimerMs > 0) {
    return {
      ...state,
      phaseTimerMs: remainingTimerMs,
      tick: state.tick + 1
    };
  }

  return {
    ...state,
    player: createPlayer({
      spawnTile: state.board.playerSpawn,
      velocity: state.player.velocity
    }),
    enemies: createEnemies(state.board, {
      unitsPerSecond: state.sessionConfig.enemySpeedUnitsPerSecond
    }),
    status: "running",
    phaseTimerMs: null,
    frightenedTimerMs: null,
    frightenedChainCount: 0,
    globalEnemyMode: state.sessionConfig.enemyModeSchedule[0]?.mode ?? "scatter",
    globalEnemyModeIndex: 0,
    globalEnemyModeTimerMs: state.sessionConfig.enemyModeSchedule[0]?.durationMs ?? 0,
    nextEnemyReleaseIndex: 1,
    enemyReleaseTimerMs: state.sessionConfig.enemyReleaseScheduleMs[0] ?? null,
    tick: state.tick + 1
  };
};

const advanceLevelCompletedState = (state: GameState, deltaMs: number): GameState => {
  const remainingTimerMs = Math.max((state.phaseTimerMs ?? 0) - deltaMs, 0);

  if (remainingTimerMs > 0) {
    return {
      ...state,
      phaseTimerMs: remainingTimerMs,
      tick: state.tick + 1
    };
  }

  return {
    ...state,
    status: "victory",
    phaseTimerMs: null,
    frightenedTimerMs: null,
    frightenedChainCount: 0,
    globalEnemyMode: state.globalEnemyMode,
    globalEnemyModeIndex: state.globalEnemyModeIndex,
    globalEnemyModeTimerMs: state.globalEnemyModeTimerMs,
    nextEnemyReleaseIndex: state.nextEnemyReleaseIndex,
    enemyReleaseTimerMs: state.enemyReleaseTimerMs,
    tick: state.tick + 1
  };
};

const createInitialGameState = (board: Board, sessionConfig: SessionConfigState): GameState => ({
  board,
  player: createPlayer({
    spawnTile: board.playerSpawn,
    velocity: { unitsPerSecond: sessionConfig.playerSpeedUnitsPerSecond }
  }),
  enemies: createEnemies(board, {
    unitsPerSecond: sessionConfig.enemySpeedUnitsPerSecond
  }),
  collectibles: createCollectiblesFromBoard(board, {
    dotPoints: sessionConfig.scoring.dotPoints,
    powerPelletPoints: sessionConfig.scoring.powerPelletPoints
  }),
  score: { value: 0 },
  lives: { value: sessionConfig.initialLives },
  status: "idle",
  tick: 0,
  phaseTimerMs: null,
  frightenedTimerMs: null,
  frightenedChainCount: 0,
  globalEnemyMode: sessionConfig.enemyModeSchedule[0]?.mode ?? "scatter",
  globalEnemyModeIndex: 0,
  globalEnemyModeTimerMs: sessionConfig.enemyModeSchedule[0]?.durationMs ?? 0,
  nextEnemyReleaseIndex: 1,
  enemyReleaseTimerMs: sessionConfig.enemyReleaseScheduleMs[0] ?? null,
  sessionConfig
});

const toSessionConfigState = (config: SessionConfig): SessionConfigState => ({
  initialLives: config.initialLives,
  playerSpeedUnitsPerSecond: config.playerSpeedUnitsPerSecond,
  enemySpeedUnitsPerSecond: config.enemySpeedUnitsPerSecond,
  frightenedDurationMs: config.frightenedDurationMs,
  enemyReleaseScheduleMs: config.enemyReleaseScheduleMs,
  enemyModeSchedule: config.enemyModeSchedule,
  scoring: {
    dotPoints: config.scoring.dotPoints,
    powerPelletPoints: config.scoring.powerPelletPoints,
    enemyPoints: config.scoring.enemyPoints
  },
  respawnDelayMs: config.respawnDelayMs,
  levelCompletedDelayMs: config.levelCompletedDelayMs
});

const resolveFrightenedTimer = (
  state: GameState,
  deltaMs: number,
  frightenedTriggered: boolean
): number | null => {
  if (frightenedTriggered) {
    return state.sessionConfig.frightenedDurationMs;
  }

  if (state.frightenedTimerMs === null) {
    return null;
  }

  const nextTimer = Math.max(state.frightenedTimerMs - deltaMs, 0);
  return nextTimer > 0 ? nextTimer : null;
};

const normalizeEnemyModes = (
  enemies: readonly ReturnType<typeof setEnemyBehaviorMode>[],
  frightenedTimerMs: number | null
): readonly ReturnType<typeof setEnemyBehaviorMode>[] =>
  enemies.map((enemy) =>
    enemy.navigationState === "returningHome"
      ? enemy
      : frightenedTimerMs === null && enemy.behaviorMode === "frightened"
      ? setEnemyBehaviorMode(enemy, getDefaultEnemyBehaviorMode(enemy))
      : enemy
  );

const resolveFrightenedChainCount = (
  state: GameState,
  frightenedCollisionCount: number,
  frightenedTimerMs: number | null,
  frightenedTriggered: boolean
): number => {
  if (frightenedTimerMs === null) {
    return 0;
  }

  const baseChainCount = frightenedTriggered ? 0 : state.frightenedChainCount;
  return baseChainCount + frightenedCollisionCount;
};

const computeFrightenedEnemyScore = (
  baseEnemyPoints: number,
  chainStart: number,
  frightenedCollisionCount: number
): number => {
  let total = 0;

  for (let index = 0; index < frightenedCollisionCount; index += 1) {
    total += baseEnemyPoints * (2 ** (chainStart + index));
  }

  return total;
};

const resolveGlobalEnemyMode = (
  state: GameState,
  deltaMs: number,
  frightenedTimerMs: number | null
): Readonly<{
  mode: "scatter" | "chase";
  index: number;
  timerMs: number;
}> => {
  if (frightenedTimerMs !== null || state.sessionConfig.enemyModeSchedule.length === 0) {
    return {
      mode: state.globalEnemyMode,
      index: state.globalEnemyModeIndex,
      timerMs: state.globalEnemyModeTimerMs
    };
  }

  let index = state.globalEnemyModeIndex;
  let timerMs = state.globalEnemyModeTimerMs - deltaMs;

  while (timerMs <= 0 && state.sessionConfig.enemyModeSchedule.length > 0) {
    index = (index + 1) % state.sessionConfig.enemyModeSchedule.length;
    timerMs += state.sessionConfig.enemyModeSchedule[index]?.durationMs ?? 0;
  }

  const mode = state.sessionConfig.enemyModeSchedule[index]?.mode ?? state.globalEnemyMode;

  return {
    mode,
    index,
    timerMs
  };
};

const applyGlobalEnemyMode = (
  enemies: readonly ReturnType<typeof setEnemyBehaviorMode>[],
  globalEnemyMode: "scatter" | "chase"
): readonly ReturnType<typeof setEnemyBehaviorMode>[] =>
  enemies.map((enemy) =>
    enemy.navigationState === "returningHome" || enemy.behaviorMode === "frightened"
      ? enemy
      : setEnemyBehaviorMode(enemy, globalEnemyMode)
  );

const resolveEnemyRelease = (
  state: GameState,
  deltaMs: number
): Readonly<{
  enemies: readonly ReturnType<typeof setEnemyBehaviorMode>[];
  nextEnemyReleaseIndex: number;
  enemyReleaseTimerMs: number | null;
}> => {
  if (state.nextEnemyReleaseIndex >= state.enemies.length || state.enemyReleaseTimerMs === null) {
    return {
      enemies: state.enemies,
      nextEnemyReleaseIndex: state.nextEnemyReleaseIndex,
      enemyReleaseTimerMs: null
    };
  }

  let enemies = [...state.enemies];
  let nextEnemyReleaseIndex = state.nextEnemyReleaseIndex;
  let enemyReleaseTimerMs: number | null = state.enemyReleaseTimerMs - deltaMs;

  while (enemyReleaseTimerMs <= 0 && nextEnemyReleaseIndex < enemies.length) {
    enemies = enemies.map((enemy, index) =>
      index === nextEnemyReleaseIndex ? setEnemyBehaviorMode(releaseEnemyFromHome(enemy), state.globalEnemyMode) : enemy
    );
    nextEnemyReleaseIndex += 1;

    if (nextEnemyReleaseIndex >= enemies.length) {
      enemyReleaseTimerMs = null;
      break;
    }

    enemyReleaseTimerMs += state.sessionConfig.enemyReleaseScheduleMs[nextEnemyReleaseIndex - 1] ?? 0;
  }

  return {
    enemies,
    nextEnemyReleaseIndex,
    enemyReleaseTimerMs
  };
};

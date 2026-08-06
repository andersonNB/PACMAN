import type { GameSnapshot } from "./contracts.js";
import type { Board, GameState, SessionConfigState } from "../domain/entities.js";
import { createCollectiblesFromBoard, collectAtPlayerTile, type CollectibleConfig } from "../domain/collectibles.js";
import {
  advanceEnemy,
  createEnemies,
  detectEnemyCollision,
  getDefaultEnemyBehaviorMode,
  markEnemyAsReturningHome,
  setEnemyBehaviorMode,
  type RandomNumberSource
} from "../domain/enemy.js";
import { createPlayer, advancePlayer, requestPlayerDirection } from "../domain/player.js";
import type { Direction } from "../domain/value-objects.js";

export type SessionConfig = Readonly<{
  playerSpeedUnitsPerSecond: number;
  enemySpeedUnitsPerSecond: number;
  frightenedDurationMs: number;
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

  const enemiesWithCurrentMode = collectionResult.frightenedTriggered
    ? state.enemies.map((enemy) => setEnemyBehaviorMode(enemy, "frightened"))
    : state.enemies;

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
    (enemy) => enemy.behaviorMode !== "frightened" && enemy.navigationState !== "returningHome"
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
      tick: state.tick + 1
    };
  }

  const frightenedCollisionIds = new Set(
    collidedEnemies
      .filter((enemy) => enemy.behaviorMode === "frightened")
      .map((enemy) => enemy.id)
  );
  const frightenedCollisionCount = frightenedCollisionIds.size;
  const frightenedTimerMs = resolveFrightenedTimer(state, deltaMs, collectionResult.frightenedTriggered);
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
  sessionConfig
});

const toSessionConfigState = (config: SessionConfig): SessionConfigState => ({
  initialLives: config.initialLives,
  playerSpeedUnitsPerSecond: config.playerSpeedUnitsPerSecond,
  enemySpeedUnitsPerSecond: config.enemySpeedUnitsPerSecond,
  frightenedDurationMs: config.frightenedDurationMs,
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

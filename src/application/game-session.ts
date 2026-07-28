import type { GameSnapshot } from "./contracts.js";
import type { Board, GameState, SessionConfigState } from "../domain/entities.js";
import { createCollectiblesFromBoard, collectAtPlayerTile, type CollectibleConfig } from "../domain/collectibles.js";
import {
  advanceEnemy,
  createEnemies,
  detectEnemyCollision,
  type RandomNumberSource
} from "../domain/enemy.js";
import { createPlayer, advancePlayer, requestPlayerDirection } from "../domain/player.js";
import type { Direction } from "../domain/value-objects.js";

export type SessionConfig = Readonly<{
  playerSpeedUnitsPerSecond: number;
  enemySpeedUnitsPerSecond: number;
  initialLives: number;
  scoring: CollectibleConfig;
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

  const enemies = state.enemies.map((enemy) =>
    advanceEnemy({
      board: state.board,
      enemy,
      playerPosition: player.position,
      deltaMs,
      nextRandom
    })
  );

  const hasEnemyCollision = enemies.some((enemy) =>
    detectEnemyCollision({
      playerPosition: player.position,
      previousPlayerPosition,
      enemy,
      previousEnemyPosition: previousEnemyPositions.get(enemy.id) ?? enemy.position
    })
  );

  if (hasEnemyCollision) {
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
      tick: state.tick + 1
    };
  }

  const collectionResult = collectAtPlayerTile({
    collectibles: state.collectibles,
    playerPosition: player.position
  });

  return {
    ...state,
    player,
    enemies,
    collectibles: collectionResult.collectibles,
    score: { value: state.score.value + collectionResult.scoreDelta },
    status: collectionResult.nextStatus === null ? state.status : collectionResult.nextStatus,
    phaseTimerMs:
      collectionResult.nextStatus === "levelCompleted" ? state.sessionConfig.levelCompletedDelayMs : state.phaseTimerMs,
    tick: state.tick + 1
  };
};

export const toGameSnapshot = (state: GameState): GameSnapshot => ({
  status: state.status,
  tick: state.tick,
  score: state.score.value,
  lives: state.lives.value,
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
  sessionConfig
});

const toSessionConfigState = (config: SessionConfig): SessionConfigState => ({
  initialLives: config.initialLives,
  playerSpeedUnitsPerSecond: config.playerSpeedUnitsPerSecond,
  enemySpeedUnitsPerSecond: config.enemySpeedUnitsPerSecond,
  scoring: {
    dotPoints: config.scoring.dotPoints,
    powerPelletPoints: config.scoring.powerPelletPoints
  },
  respawnDelayMs: config.respawnDelayMs,
  levelCompletedDelayMs: config.levelCompletedDelayMs
});

import type { GameSnapshot } from "./contracts.js";
import type { Board, GameState } from "../domain/entities.js";
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
}>;

export const createGameSession = (board: Board, config: SessionConfig): GameState => ({
  board,
  player: createPlayer({
    spawnTile: board.playerSpawn,
    velocity: { unitsPerSecond: config.playerSpeedUnitsPerSecond }
  }),
  enemies: createEnemies(board, {
    unitsPerSecond: config.enemySpeedUnitsPerSecond
  }),
  collectibles: createCollectiblesFromBoard(board, config.scoring),
  score: { value: 0 },
  lives: { value: config.initialLives },
  status: "idle",
  tick: 0
});

export const startGameSession = (state: GameState): GameState =>
  state.status === "idle"
    ? {
        ...state,
        status: "running"
      }
    : state;

export const requestDirectionForSession = (state: GameState, direction: Direction): GameState => ({
  ...state,
  player: requestPlayerDirection(state.player, direction)
});

export const advanceGameSession = (
  state: GameState,
  deltaMs: number,
  nextRandom: RandomNumberSource = Math.random
): GameState => {
  if (state.status !== "running") {
    return state;
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
    status: collectionResult.nextStatus ?? state.status,
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

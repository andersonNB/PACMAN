import type {
  Direction,
  EnemyBehaviorMode,
  GameStatus,
  TilePosition
} from "./value-objects.js";

export type DomainEvent =
  | Readonly<{
      type: "DotCollected";
      collectibleId: string;
      tile: TilePosition;
      points: number;
    }>
  | Readonly<{
      type: "PowerPelletCollected";
      collectibleId: string;
      tile: TilePosition;
      frightenedDurationMs: number;
    }>
  | Readonly<{
      type: "EnemyModeChanged";
      enemyId: string;
      mode: EnemyBehaviorMode;
    }>
  | Readonly<{
      type: "EnemyEaten";
      enemyId: string;
      points: number;
    }>
  | Readonly<{
      type: "EnemyCollision";
      enemyId: string;
      lethal: boolean;
    }>
  | Readonly<{
      type: "PlayerDied";
    }>
  | Readonly<{
      type: "LifeLost";
      remainingLives: number;
    }>
  | Readonly<{
      type: "ScoreUpdated";
      score: number;
    }>
  | Readonly<{
      type: "LevelCompleted";
    }>
  | Readonly<{
      type: "GameOver";
    }>
  | Readonly<{
      type: "GameWon";
    }>;

export type ApplicationEvent =
  | Readonly<{
      type: "GameCreated";
      status: GameStatus;
    }>
  | Readonly<{
      type: "GameStarted";
    }>
  | Readonly<{
      type: "GamePaused";
    }>
  | Readonly<{
      type: "GameResumed";
    }>
  | Readonly<{
      type: "GameRestarted";
    }>
  | Readonly<{
      type: "TickCompleted";
      tick: number;
    }>
  | Readonly<{
      type: "PlayerDirectionRequested";
      direction: Direction;
    }>;

export type GameEvent = DomainEvent | ApplicationEvent;

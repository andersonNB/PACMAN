import type { GameSnapshot } from "./contracts.js";
import type { Direction } from "../domain/value-objects.js";

export type CreateGame = () => Promise<void>;
export type StartGame = () => void;
export type PauseGame = () => void;
export type ResumeGame = () => void;
export type RestartGame = () => Promise<void>;
export type RequestPlayerDirection = (direction: Direction) => void;
export type AdvanceSimulation = (deltaMs: number) => void;
export type GetSnapshot = () => GameSnapshot;

export type GameApplicationService = Readonly<{
  createGame: CreateGame;
  startGame: StartGame;
  pauseGame: PauseGame;
  resumeGame: ResumeGame;
  restartGame: RestartGame;
  requestPlayerDirection: RequestPlayerDirection;
  advanceSimulation: AdvanceSimulation;
  getSnapshot: GetSnapshot;
}>;

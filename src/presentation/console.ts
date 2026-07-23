import type { Board, Collectible, Enemy } from "../domain/entities.js";
import { worldToTilePosition } from "../domain/player.js";
import type { GameStatus, TileKind } from "../domain/value-objects.js";

const TILE_SYMBOLS: Readonly<Record<TileKind, string>> = {
  wall: "#",
  path: ".",
  tunnel: "T",
  ghostHouse: "H",
  restricted: "R"
};

export const renderBoardWithPlayer = (board: Board, playerPosition: { x: number; y: number }): string => {
  return renderBoardState({
    board,
    playerPosition,
    collectibles: [],
    enemies: [],
    status: "running",
    score: 0,
    lives: 0
  });
};

export const renderBoardState = (params: {
  board: Board;
  playerPosition: { x: number; y: number };
  collectibles: readonly Collectible[];
  enemies: readonly Enemy[];
  status: GameStatus;
  score: number;
  lives: number;
}): string => {
  const { board, playerPosition, collectibles, enemies, status, score, lives } = params;
  const playerTile = worldToTilePosition(playerPosition);
  const rows: string[] = [];

  for (let row = 0; row < board.height; row += 1) {
    let rowText = "";

    for (let column = 0; column < board.width; column += 1) {
      if (playerTile.row === row && playerTile.column === column) {
        rowText += "C";
        continue;
      }

      const enemy = enemies.find((currentEnemy) => {
        const enemyTile = worldToTilePosition(currentEnemy.position);
        return enemyTile.row === row && enemyTile.column === column;
      });

      if (enemy !== undefined) {
        rowText += "G";
        continue;
      }

      const collectible = collectibles.find(
        (currentCollectible) =>
          currentCollectible.active &&
          currentCollectible.tile.row === row &&
          currentCollectible.tile.column === column
      );

      if (collectible !== undefined) {
        rowText += collectible.kind === "powerPellet" ? "o" : ".";
        continue;
      }

      const tile = board.tiles.find(
        (currentTile) => currentTile.position.row === row && currentTile.position.column === column
      );

      rowText += tile === undefined ? " " : TILE_SYMBOLS[tile.kind];
    }

    rows.push(rowText);
  }

  return [`status=${status} score=${score} lives=${lives}`, ...rows].join("\n");
};

export const createConsolePreview = (board: Board): string =>
  renderBoardWithPlayer(board, {
    x: board.playerSpawn.column + 0.5,
    y: board.playerSpawn.row + 0.5
  });

import type { Board, Collectible } from "./entities.js";
import type { GameStatus, TilePosition } from "./value-objects.js";
import { worldToTilePosition } from "./player.js";

export type CollectibleConfig = Readonly<{
  dotPoints: number;
  powerPelletPoints: number;
  fruitPoints: number;
}>;

export type CollectibleCollectionResult = Readonly<{
  collectibles: readonly Collectible[];
  collected: readonly Collectible[];
  scoreDelta: number;
  frightenedTriggered: boolean;
  nextStatus: GameStatus | null;
}>;

export const createCollectiblesFromBoard = (
  board: Board,
  config: CollectibleConfig
): readonly Collectible[] =>
  board.tiles.flatMap((tile, index) => {
    if (tile.marker === null) {
      return [];
    }

    const points =
      tile.marker === "o" ? config.powerPelletPoints :
      tile.marker === "F" ? config.fruitPoints :
      config.dotPoints;
    const kind =
      tile.marker === "o" ? "powerPellet" :
      tile.marker === "F" ? "fruit" :
      "dot";

    return [
      {
        id: `collectible-${index}`,
        kind,
        tile: tile.position,
        points,
        active: shouldSpawnCollectible(tile.position, board)
      } satisfies Collectible
    ];
  }).filter((collectible) => collectible.active);

export const collectAtPlayerTile = (params: {
  collectibles: readonly Collectible[];
  playerPosition: { x: number; y: number };
}): CollectibleCollectionResult => {
  const playerTile = worldToTilePosition(params.playerPosition);
  const collected: Collectible[] = [];
  let scoreDelta = 0;

  const collectibles = params.collectibles.map((collectible) => {
    if (!collectible.active || !sameTile(collectible.tile, playerTile)) {
      return collectible;
    }

    collected.push({
      ...collectible,
      active: false
    });
    scoreDelta += collectible.points;

    return {
      ...collectible,
      active: false
    };
  });

  const remainingLevelCollectibles = collectibles.filter(
    (collectible) => collectible.active && collectible.kind !== "fruit"
  );

  return {
    collectibles,
    collected,
    scoreDelta,
    frightenedTriggered: collected.some((collectible) => collectible.kind === "powerPellet"),
    nextStatus: remainingLevelCollectibles.length === 0 ? "levelCompleted" : null
  };
};

const shouldSpawnCollectible = (position: TilePosition, board: Board): boolean =>
  !sameTile(position, board.playerSpawn) &&
  !board.enemySpawns.some((enemySpawn) => sameTile(enemySpawn, position));

const sameTile = (left: TilePosition, right: TilePosition): boolean =>
  left.row === right.row && left.column === right.column;

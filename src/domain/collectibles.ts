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
        active: shouldSpawnCollectible(tile.position, board),
        spawned: shouldSpawnCollectible(tile.position, board),
        spawnCount: shouldSpawnCollectible(tile.position, board) ? 1 : 0,
        collected: false,
        remainingMs: null
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
      active: false,
      collected: true
    });
    scoreDelta += collectible.points;

    return {
      ...collectible,
      active: false,
      collected: true
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

export const deferFruitSpawn = (
  collectibles: readonly Collectible[],
  fruitSpawnAfterDots: number | readonly number[] | null
): readonly Collectible[] =>
  normalizeFruitSpawnThresholds(fruitSpawnAfterDots).length === 0
    ? collectibles
    : collectibles.map((collectible) =>
        collectible.kind === "fruit"
          ? { ...collectible, active: false, spawned: false, spawnCount: 0, remainingMs: null }
          : collectible
      );

export const activateEligibleFruits = (
  collectibles: readonly Collectible[],
  fruitSpawnAfterDots: number | readonly number[] | null,
  fruitVisibleDurationMs: number | null = null,
  fruitPointsBySpawn: readonly number[] = []
): readonly Collectible[] => {
  const thresholds = normalizeFruitSpawnThresholds(fruitSpawnAfterDots);

  if (thresholds.length === 0) {
    return collectibles;
  }

  return collectibles.map((collectible) => {
    const nextThreshold = thresholds[collectible.spawnCount];

    if (
      collectible.kind !== "fruit" ||
      collectible.active ||
      nextThreshold === undefined ||
      countCollectedLevelItems(collectibles) < nextThreshold
    ) {
      return collectible;
    }

    return {
      ...collectible,
      active: true,
      spawned: true,
      spawnCount: collectible.spawnCount + 1,
      collected: false,
      remainingMs: fruitVisibleDurationMs,
      points: fruitPointsBySpawn[collectible.spawnCount] ?? collectible.points
    };
  });
};

export const advanceFruitTimers = (
  collectibles: readonly Collectible[],
  deltaMs: number
): readonly Collectible[] =>
  collectibles.map((collectible) => {
    if (collectible.kind !== "fruit" || !collectible.active || collectible.remainingMs === null) {
      return collectible;
    }

    const remainingMs = Math.max(collectible.remainingMs - Math.max(deltaMs, 0), 0);

    return remainingMs === 0
      ? { ...collectible, active: false, remainingMs }
      : { ...collectible, remainingMs };
  });

const shouldSpawnCollectible = (position: TilePosition, board: Board): boolean =>
  !sameTile(position, board.playerSpawn) &&
  !board.enemySpawns.some((enemySpawn) => sameTile(enemySpawn, position));

const sameTile = (left: TilePosition, right: TilePosition): boolean =>
  left.row === right.row && left.column === right.column;

const countCollectedLevelItems = (collectibles: readonly Collectible[]): number =>
  collectibles.filter((collectible) => collectible.kind !== "fruit" && !collectible.active).length;

const normalizeFruitSpawnThresholds = (
  fruitSpawnAfterDots: number | readonly number[] | null
): readonly number[] => {
  const rawThresholds = Array.isArray(fruitSpawnAfterDots)
    ? fruitSpawnAfterDots
    : fruitSpawnAfterDots === null
      ? []
      : [fruitSpawnAfterDots];

  return [...new Set(rawThresholds.filter((threshold) => Number.isFinite(threshold) && threshold > 0))]
    .sort((left, right) => left - right);
};

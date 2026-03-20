import { TileType } from './types';

export const MOVE_POINT_UNIT = 100;
export const BASE_MOVE_POINTS_PER_TICK = MOVE_POINT_UNIT;
export const MAX_STORED_MOVE_POINTS = MOVE_POINT_UNIT * 4;

export const TILE_TRAVERSAL_COST: Record<TileType, number> = {
  [TileType.Floor]: 1,
  [TileType.Wall]: 4,
  [TileType.Door]: 1,
  [TileType.Portal]: 1,
  [TileType.Grass]: 2,
  [TileType.Water]: 4,
  [TileType.Tree]: 4,
  [TileType.Stone]: 4,
};

export function getTileTraversalCost(type: TileType): number {
  return TILE_TRAVERSAL_COST[type] ?? 4;
}

export function getMovePointsPerTick(moveSpeed: number): number {
  return BASE_MOVE_POINTS_PER_TICK + (Number.isFinite(moveSpeed) ? Math.max(0, moveSpeed) : 0);
}

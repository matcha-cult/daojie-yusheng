import { TileType } from './types';

export const MOVE_POINT_UNIT = 100;
export const BASE_MOVE_POINTS_PER_TICK = MOVE_POINT_UNIT;
export const MAX_STORED_MOVE_POINTS = MOVE_POINT_UNIT * 4;

export const TILE_TRAVERSAL_COST: Record<TileType, number> = {
  [TileType.Floor]: 100,
  [TileType.Road]: 30,
  [TileType.Trail]: 50,
  [TileType.Wall]: 400,
  [TileType.Door]: 100,
  [TileType.Portal]: 100,
  [TileType.Grass]: 80,
  [TileType.Hill]: 120,
  [TileType.Mud]: 200,
  [TileType.Swamp]: 300,
  [TileType.Water]: 400,
  [TileType.Tree]: 400,
  [TileType.Stone]: 400,
};

export function getTileTraversalCost(type: TileType): number {
  return TILE_TRAVERSAL_COST[type] ?? 400;
}

export function getMovePointsPerTick(moveSpeed: number): number {
  return BASE_MOVE_POINTS_PER_TICK + (Number.isFinite(moveSpeed) ? Math.max(0, moveSpeed) : 0);
}

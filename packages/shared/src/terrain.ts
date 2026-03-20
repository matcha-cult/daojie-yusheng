import { TechniqueGrade, TileType } from './types';

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

export type TerrainDurabilityMaterial =
  | 'vine'
  | 'wood'
  | 'bamboo'
  | 'ironwood'
  | 'spiritWood'
  | 'stone'
  | 'runeStone'
  | 'metal'
  | 'blackIron'
  | 'skyMetal';

// 地形基础血量直接取自 value-budget 中“功法满层目标价值”的各品阶最大值。
export const TERRAIN_GRADE_BASE_HP = {
  mortal: 132,
  yellow: 192,
  mystic: 420,
  earth: 660,
  heaven: 1320,
  spirit: 2640,
  saint: 5280,
  emperor: 10560,
} satisfies Record<TechniqueGrade, number>;

export const TERRAIN_MATERIAL_MULTIPLIERS = {
  vine: 3,
  wood: 10,
  bamboo: 8,
  ironwood: 14,
  spiritWood: 18,
  stone: 50,
  runeStone: 70,
  metal: 100,
  blackIron: 120,
  skyMetal: 160,
} satisfies Record<TerrainDurabilityMaterial, number>;

export function getTerrainGradeBaseHp(grade: TechniqueGrade): number {
  return TERRAIN_GRADE_BASE_HP[grade];
}

export function getTerrainMaterialMultiplier(material: TerrainDurabilityMaterial): number {
  return TERRAIN_MATERIAL_MULTIPLIERS[material];
}

export function calculateTerrainDurability(
  grade: TechniqueGrade,
  material: TerrainDurabilityMaterial,
): number {
  return Math.max(1, Math.round(getTerrainGradeBaseHp(grade) * getTerrainMaterialMultiplier(material)));
}

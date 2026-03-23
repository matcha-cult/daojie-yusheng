/**
 * 地图与可破坏地形常量。
 */

import { TileType, type TechniqueGrade, type TerrainDurabilityMaterial } from '@mud/shared';

/** 地形耐久配置。 */
export type TerrainDurabilityProfile = {
  grade: TechniqueGrade;
  material: TerrainDurabilityMaterial;
};

/** 各类地块的默认耐久材质。 */
export const DEFAULT_TERRAIN_DURABILITY_BY_TILE: Partial<Record<TileType, TerrainDurabilityProfile>> = {
  [TileType.Wall]: { grade: 'mortal', material: 'stone' },
  [TileType.Tree]: { grade: 'mortal', material: 'wood' },
  [TileType.Stone]: { grade: 'mortal', material: 'stone' },
  [TileType.Door]: { grade: 'mortal', material: 'ironwood' },
  [TileType.Window]: { grade: 'mortal', material: 'wood' },
};

/** 不同地图主题对地形耐久的覆盖配置。 */
export const MAP_TERRAIN_DURABILITY_OVERRIDES: Partial<Record<string, Partial<Record<TileType, TerrainDurabilityProfile>>>> = {
  spawn: {
    [TileType.Wall]: { grade: 'mortal', material: 'stone' },
    [TileType.Tree]: { grade: 'mortal', material: 'wood' },
    [TileType.Stone]: { grade: 'mortal', material: 'stone' },
    [TileType.Door]: { grade: 'mortal', material: 'ironwood' },
    [TileType.Window]: { grade: 'mortal', material: 'wood' },
  },
  wildlands: {
    [TileType.Wall]: { grade: 'yellow', material: 'stone' },
    [TileType.Tree]: { grade: 'mortal', material: 'wood' },
    [TileType.Stone]: { grade: 'yellow', material: 'stone' },
  },
  bamboo_forest: {
    [TileType.Wall]: { grade: 'yellow', material: 'stone' },
    [TileType.Tree]: { grade: 'yellow', material: 'bamboo' },
    [TileType.Stone]: { grade: 'yellow', material: 'stone' },
    [TileType.Door]: { grade: 'mortal', material: 'wood' },
  },
  black_iron_mine: {
    [TileType.Wall]: { grade: 'mystic', material: 'blackIron' },
    [TileType.Stone]: { grade: 'mystic', material: 'blackIron' },
    [TileType.Door]: { grade: 'yellow', material: 'ironwood' },
  },
  ancient_ruins: {
    [TileType.Wall]: { grade: 'mystic', material: 'runeStone' },
    [TileType.Tree]: { grade: 'yellow', material: 'spiritWood' },
    [TileType.Stone]: { grade: 'mystic', material: 'runeStone' },
    [TileType.Door]: { grade: 'yellow', material: 'ironwood' },
  },
  spirit_ridge: {
    [TileType.Wall]: { grade: 'earth', material: 'stone' },
    [TileType.Tree]: { grade: 'mystic', material: 'spiritWood' },
    [TileType.Stone]: { grade: 'earth', material: 'stone' },
  },
  beast_valley: {
    [TileType.Wall]: { grade: 'earth', material: 'stone' },
    [TileType.Tree]: { grade: 'yellow', material: 'wood' },
    [TileType.Stone]: { grade: 'earth', material: 'stone' },
  },
  sky_ruins: {
    [TileType.Wall]: { grade: 'earth', material: 'skyMetal' },
    [TileType.Tree]: { grade: 'mystic', material: 'spiritWood' },
    [TileType.Stone]: { grade: 'earth', material: 'skyMetal' },
    [TileType.Door]: { grade: 'mystic', material: 'metal' },
  },
};

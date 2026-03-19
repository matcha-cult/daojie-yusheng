import {
  Attributes,
  BreakthroughItemRequirement,
  PlayerRealmStage,
  TechniqueRealm,
} from './types';

/** Tick 间隔（毫秒） */
export const TICK_INTERVAL = 1000;

/** 单 tick 最大处理时间（毫秒） */
export const TICK_BUDGET = 200;

/** 默认视野范围（半径，格子数） */
export const VIEW_RADIUS = 10;

/** 视野尺寸 */
export const VIEW_SIZE = VIEW_RADIUS * 2 + 1;

/** 地形恢复时间（秒） */
export const TERRAIN_RESTORE_TIME = 300;

/** 死亡等待时间（秒） */
export const DEATH_WAIT_TIME = 10;

/** 断线保留时间（秒） */
export const DISCONNECT_RETAIN_TIME = 120;

/** 复活后 HP 比例 */
export const RESPAWN_HP_RATIO = 0.5;

/** 死亡经验惩罚比例 */
export const DEATH_EXP_PENALTY = 0.1;

/** Redis 落盘间隔（秒） */
export const PERSIST_INTERVAL = 60;

/** 服务端默认端口 */
export const SERVER_PORT = 3000;

// ===== 修仙系统常量 =====

/** 默认背包容量 */
export const DEFAULT_INVENTORY_CAPACITY = 30;

/** 默认六维属性 */
export const DEFAULT_BASE_ATTRS = {
  constitution: 10,
  spirit: 10,
  perception: 10,
  talent: 10,
  comprehension: 10,
  luck: 10,
} as const;

/** 体质 → 最大HP 系数 */
export const HP_PER_CONSTITUTION = 10;

/** 基础最大HP */
export const BASE_MAX_HP = 50;

/** 修炼每 tick 获得经验 */
export const CULTIVATE_EXP_PER_TICK = 5;

/** 功法升级经验表（realm → expToNext） */
export const TECHNIQUE_EXP_TABLE: Record<number, number> = {
  0: 100,   // Entry → Minor
  1: 300,   // Minor → Major
  2: 1000,  // Major → Perfection
  3: 0,     // Perfection（满级）
};

type RealmConfig = {
  name: string;
  shortName: string;
  path: 'martial' | 'immortal';
  narrative: string;
  progressToNext: number;
  attrBonus: Partial<Attributes>;
  breakthroughItems: BreakthroughItemRequirement[];
  minTechniqueLevel: number;
  minTechniqueRealm?: TechniqueRealm;
};

/** 默认玩家大境界 */
export const DEFAULT_PLAYER_REALM_STAGE = PlayerRealmStage.Mortal;

/** 玩家大境界顺序 */
export const PLAYER_REALM_ORDER: PlayerRealmStage[] = [
  PlayerRealmStage.Mortal,
  PlayerRealmStage.BodyTempering,
  PlayerRealmStage.BoneForging,
  PlayerRealmStage.Meridian,
  PlayerRealmStage.Innate,
  PlayerRealmStage.QiRefining,
  PlayerRealmStage.Foundation,
];

/** 武道到修仙的大境界配置 */
export const PLAYER_REALM_CONFIG: Record<PlayerRealmStage, RealmConfig> = {
  [PlayerRealmStage.Mortal]: {
    name: '凡俗境',
    shortName: '凡俗',
    path: 'martial',
    narrative: '筋骨未开，仍在江湖门槛之外，只能以勤练夯实根基。',
    progressToNext: 60,
    attrBonus: {},
    breakthroughItems: [
      { itemId: 'rat_tail', count: 3 },
      { itemId: 'boar_tusk', count: 1 },
    ],
    minTechniqueLevel: 1,
  },
  [PlayerRealmStage.BodyTempering]: {
    name: '炼体境',
    shortName: '炼体',
    path: 'martial',
    narrative: '气血打熬周身，筋膜初固，正式迈入武道修行。',
    progressToNext: 120,
    attrBonus: { constitution: 2, perception: 1 },
    breakthroughItems: [
      { itemId: 'wolf_fang', count: 4 },
      { itemId: 'serpent_gall', count: 2 },
    ],
    minTechniqueLevel: 2,
    minTechniqueRealm: TechniqueRealm.Entry,
  },
  [PlayerRealmStage.BoneForging]: {
    name: '锻骨境',
    shortName: '锻骨',
    path: 'martial',
    narrative: '骨骼经受药力与劲力淬炼，气血承载力显著增长。',
    progressToNext: 180,
    attrBonus: { constitution: 4, spirit: 1, perception: 2 },
    breakthroughItems: [
      { itemId: 'black_iron_chunk', count: 4 },
      { itemId: 'crystal_dust', count: 3 },
    ],
    minTechniqueLevel: 4,
    minTechniqueRealm: TechniqueRealm.Minor,
  },
  [PlayerRealmStage.Meridian]: {
    name: '通脉境',
    shortName: '通脉',
    path: 'martial',
    narrative: '经脉渐通，劲力开始带有内息性质，武道正向玄门靠拢。',
    progressToNext: 260,
    attrBonus: { constitution: 6, spirit: 2, perception: 3, comprehension: 1 },
    breakthroughItems: [
      { itemId: 'black_iron_chunk', count: 6 },
      { itemId: 'rune_shard', count: 4 },
      { itemId: 'mine_signal_core', count: 1 },
    ],
    minTechniqueLevel: 6,
    minTechniqueRealm: TechniqueRealm.Minor,
  },
  [PlayerRealmStage.Innate]: {
    name: '先天境',
    shortName: '先天',
    path: 'martial',
    narrative: '内外归一，先天一炁渐显，是凡武迈向仙道的最后门槛。',
    progressToNext: 360,
    attrBonus: { constitution: 8, spirit: 4, perception: 4, talent: 2, comprehension: 2 },
    breakthroughItems: [
      { itemId: 'rune_shard', count: 6 },
      { itemId: 'spirit_iron_fragment', count: 4 },
      { itemId: 'valley_core', count: 1 },
    ],
    minTechniqueLevel: 8,
    minTechniqueRealm: TechniqueRealm.Major,
  },
  [PlayerRealmStage.QiRefining]: {
    name: '练气境',
    shortName: '练气',
    path: 'immortal',
    narrative: '可引天地灵机入体，真正踏入修仙序列，功法威能随之跃迁。',
    progressToNext: 520,
    attrBonus: { constitution: 10, spirit: 8, perception: 5, talent: 4, comprehension: 3, luck: 1 },
    breakthroughItems: [
      { itemId: 'blood_feather', count: 6 },
      { itemId: 'demon_wolf_bone', count: 6 },
      { itemId: 'spirit_iron_fragment', count: 6 },
    ],
    minTechniqueLevel: 10,
    minTechniqueRealm: TechniqueRealm.Major,
  },
  [PlayerRealmStage.Foundation]: {
    name: '筑基境',
    shortName: '筑基',
    path: 'immortal',
    narrative: '道基初成，体魄与灵识都进入更高层次，已达当前版本上限。',
    progressToNext: 0,
    attrBonus: { constitution: 14, spirit: 12, perception: 8, talent: 6, comprehension: 5, luck: 2 },
    breakthroughItems: [],
    minTechniqueLevel: 12,
    minTechniqueRealm: TechniqueRealm.Perfection,
  },
};

/** 装备槽位列表 */
export const EQUIP_SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory'] as const;

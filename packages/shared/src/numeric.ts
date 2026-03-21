import type { Attributes } from './types';
import { PlayerRealmStage } from './types';

export const ELEMENT_KEYS = ['metal', 'wood', 'water', 'fire', 'earth'] as const;
export type ElementKey = typeof ELEMENT_KEYS[number];

export type NumericValueType = 'flat' | 'ratio_value' | 'rate_bp' | 'throughput';

export interface ElementStatGroup {
  metal: number;
  wood: number;
  water: number;
  fire: number;
  earth: number;
}

export type PartialElementStatGroup = Partial<Record<ElementKey, number>>;

export const NUMERIC_SCALAR_STAT_KEYS = [
  'maxHp',
  'maxQi',
  'physAtk',
  'spellAtk',
  'physDef',
  'spellDef',
  'hit',
  'dodge',
  'crit',
  'critDamage',
  'breakPower',
  'resolvePower',
  'maxQiOutputPerTick',
  'qiRegenRate',
  'hpRegenRate',
  'cooldownSpeed',
  'auraCostReduce',
  'auraPowerRate',
  'playerExpRate',
  'techniqueExpRate',
  'realmExpPerTick',
  'techniqueExpPerTick',
  'lootRate',
  'rareLootRate',
  'viewRange',
  'moveSpeed',
] as const;

export type NumericScalarStatKey = typeof NUMERIC_SCALAR_STAT_KEYS[number];

export interface NumericStats {
  maxHp: number;
  maxQi: number;
  physAtk: number;
  spellAtk: number;
  physDef: number;
  spellDef: number;
  hit: number;
  dodge: number;
  crit: number;
  critDamage: number;
  breakPower: number;
  resolvePower: number;
  maxQiOutputPerTick: number;
  qiRegenRate: number;
  hpRegenRate: number;
  cooldownSpeed: number;
  auraCostReduce: number;
  auraPowerRate: number;
  playerExpRate: number;
  techniqueExpRate: number;
  realmExpPerTick: number;
  techniqueExpPerTick: number;
  lootRate: number;
  rareLootRate: number;
  viewRange: number;
  moveSpeed: number;
  elementDamageBonus: ElementStatGroup;
  elementDamageReduce: ElementStatGroup;
}

export interface PartialNumericStats extends Partial<Omit<NumericStats, 'elementDamageBonus' | 'elementDamageReduce'>> {
  elementDamageBonus?: PartialElementStatGroup;
  elementDamageReduce?: PartialElementStatGroup;
}

export interface NumericModifier {
  source: string;
  baseAttrs?: Partial<Attributes>;
  stats?: PartialNumericStats;
  label?: string;
  meta?: Record<string, unknown>;
}

export interface NumericRatioDivisors {
  dodge: number;
  crit: number;
  breakPower: number;
  resolvePower: number;
  cooldownSpeed: number;
  moveSpeed: number;
  elementDamageReduce: ElementStatGroup;
}

export interface RealmNumericTemplate {
  stage: PlayerRealmStage;
  stats: NumericStats;
  ratioDivisors: NumericRatioDivisors;
}

export const NUMERIC_SCALAR_STAT_VALUE_TYPES: Record<NumericScalarStatKey, NumericValueType> = {
  maxHp: 'flat',
  maxQi: 'flat',
  physAtk: 'flat',
  spellAtk: 'flat',
  physDef: 'flat',
  spellDef: 'flat',
  hit: 'flat',
  dodge: 'ratio_value',
  crit: 'ratio_value',
  critDamage: 'rate_bp',
  breakPower: 'ratio_value',
  resolvePower: 'ratio_value',
  maxQiOutputPerTick: 'throughput',
  qiRegenRate: 'rate_bp',
  hpRegenRate: 'rate_bp',
  cooldownSpeed: 'ratio_value',
  auraCostReduce: 'rate_bp',
  auraPowerRate: 'rate_bp',
  playerExpRate: 'rate_bp',
  techniqueExpRate: 'rate_bp',
  realmExpPerTick: 'throughput',
  techniqueExpPerTick: 'throughput',
  lootRate: 'rate_bp',
  rareLootRate: 'rate_bp',
  viewRange: 'flat',
  moveSpeed: 'flat',
};

export const DEFAULT_RATIO_DIVISOR = 100;

export function createElementStatGroup(initialValue = 0): ElementStatGroup {
  return {
    metal: initialValue,
    wood: initialValue,
    water: initialValue,
    fire: initialValue,
    earth: initialValue,
  };
}

export function cloneElementStatGroup(source: ElementStatGroup): ElementStatGroup {
  return {
    metal: source.metal,
    wood: source.wood,
    water: source.water,
    fire: source.fire,
    earth: source.earth,
  };
}

export function resetElementStatGroup(target: ElementStatGroup, value = 0): ElementStatGroup {
  target.metal = value;
  target.wood = value;
  target.water = value;
  target.fire = value;
  target.earth = value;
  return target;
}

export function addPartialElementStatGroup(target: ElementStatGroup, patch?: PartialElementStatGroup): ElementStatGroup {
  if (!patch) return target;
  if (patch.metal !== undefined) target.metal += patch.metal;
  if (patch.wood !== undefined) target.wood += patch.wood;
  if (patch.water !== undefined) target.water += patch.water;
  if (patch.fire !== undefined) target.fire += patch.fire;
  if (patch.earth !== undefined) target.earth += patch.earth;
  return target;
}

export function createNumericStats(): NumericStats {
  return {
    maxHp: 0,
    maxQi: 0,
    physAtk: 0,
    spellAtk: 0,
    physDef: 0,
    spellDef: 0,
    hit: 0,
    dodge: 0,
    crit: 0,
    critDamage: 0,
    breakPower: 0,
    resolvePower: 0,
    maxQiOutputPerTick: 0,
    qiRegenRate: 0,
    hpRegenRate: 0,
    cooldownSpeed: 0,
    auraCostReduce: 0,
    auraPowerRate: 0,
    playerExpRate: 0,
    techniqueExpRate: 0,
    realmExpPerTick: 0,
    techniqueExpPerTick: 0,
    lootRate: 0,
    rareLootRate: 0,
    viewRange: 0,
    moveSpeed: 0,
    elementDamageBonus: createElementStatGroup(),
    elementDamageReduce: createElementStatGroup(),
  };
}

export function cloneNumericStats(source: NumericStats): NumericStats {
  return {
    maxHp: source.maxHp,
    maxQi: source.maxQi,
    physAtk: source.physAtk,
    spellAtk: source.spellAtk,
    physDef: source.physDef,
    spellDef: source.spellDef,
    hit: source.hit,
    dodge: source.dodge,
    crit: source.crit,
    critDamage: source.critDamage,
    breakPower: source.breakPower,
    resolvePower: source.resolvePower,
    maxQiOutputPerTick: source.maxQiOutputPerTick,
    qiRegenRate: source.qiRegenRate,
    hpRegenRate: source.hpRegenRate,
    cooldownSpeed: source.cooldownSpeed,
    auraCostReduce: source.auraCostReduce,
    auraPowerRate: source.auraPowerRate,
    playerExpRate: source.playerExpRate,
    techniqueExpRate: source.techniqueExpRate,
    realmExpPerTick: source.realmExpPerTick,
    techniqueExpPerTick: source.techniqueExpPerTick,
    lootRate: source.lootRate,
    rareLootRate: source.rareLootRate,
    viewRange: source.viewRange,
    moveSpeed: source.moveSpeed,
    elementDamageBonus: cloneElementStatGroup(source.elementDamageBonus),
    elementDamageReduce: cloneElementStatGroup(source.elementDamageReduce),
  };
}

export function resetNumericStats(target: NumericStats): NumericStats {
  target.maxHp = 0;
  target.maxQi = 0;
  target.physAtk = 0;
  target.spellAtk = 0;
  target.physDef = 0;
  target.spellDef = 0;
  target.hit = 0;
  target.dodge = 0;
  target.crit = 0;
  target.critDamage = 0;
  target.breakPower = 0;
  target.resolvePower = 0;
  target.maxQiOutputPerTick = 0;
  target.qiRegenRate = 0;
  target.hpRegenRate = 0;
  target.cooldownSpeed = 0;
  target.auraCostReduce = 0;
  target.auraPowerRate = 0;
  target.playerExpRate = 0;
  target.techniqueExpRate = 0;
  target.realmExpPerTick = 0;
  target.techniqueExpPerTick = 0;
  target.lootRate = 0;
  target.rareLootRate = 0;
  target.viewRange = 0;
  target.moveSpeed = 0;
  resetElementStatGroup(target.elementDamageBonus);
  resetElementStatGroup(target.elementDamageReduce);
  return target;
}

export function addPartialNumericStats(target: NumericStats, patch?: PartialNumericStats): NumericStats {
  if (!patch) return target;
  if (patch.maxHp !== undefined) target.maxHp += patch.maxHp;
  if (patch.maxQi !== undefined) target.maxQi += patch.maxQi;
  if (patch.physAtk !== undefined) target.physAtk += patch.physAtk;
  if (patch.spellAtk !== undefined) target.spellAtk += patch.spellAtk;
  if (patch.physDef !== undefined) target.physDef += patch.physDef;
  if (patch.spellDef !== undefined) target.spellDef += patch.spellDef;
  if (patch.hit !== undefined) target.hit += patch.hit;
  if (patch.dodge !== undefined) target.dodge += patch.dodge;
  if (patch.crit !== undefined) target.crit += patch.crit;
  if (patch.critDamage !== undefined) target.critDamage += patch.critDamage;
  if (patch.breakPower !== undefined) target.breakPower += patch.breakPower;
  if (patch.resolvePower !== undefined) target.resolvePower += patch.resolvePower;
  if (patch.maxQiOutputPerTick !== undefined) target.maxQiOutputPerTick += patch.maxQiOutputPerTick;
  if (patch.qiRegenRate !== undefined) target.qiRegenRate += patch.qiRegenRate;
  if (patch.hpRegenRate !== undefined) target.hpRegenRate += patch.hpRegenRate;
  if (patch.cooldownSpeed !== undefined) target.cooldownSpeed += patch.cooldownSpeed;
  if (patch.auraCostReduce !== undefined) target.auraCostReduce += patch.auraCostReduce;
  if (patch.auraPowerRate !== undefined) target.auraPowerRate += patch.auraPowerRate;
  if (patch.playerExpRate !== undefined) target.playerExpRate += patch.playerExpRate;
  if (patch.techniqueExpRate !== undefined) target.techniqueExpRate += patch.techniqueExpRate;
  if (patch.realmExpPerTick !== undefined) target.realmExpPerTick += patch.realmExpPerTick;
  if (patch.techniqueExpPerTick !== undefined) target.techniqueExpPerTick += patch.techniqueExpPerTick;
  if (patch.lootRate !== undefined) target.lootRate += patch.lootRate;
  if (patch.rareLootRate !== undefined) target.rareLootRate += patch.rareLootRate;
  if (patch.viewRange !== undefined) target.viewRange += patch.viewRange;
  if (patch.moveSpeed !== undefined) target.moveSpeed += patch.moveSpeed;
  addPartialElementStatGroup(target.elementDamageBonus, patch.elementDamageBonus);
  addPartialElementStatGroup(target.elementDamageReduce, patch.elementDamageReduce);
  return target;
}

export function mergeNumericStats(base: NumericStats, patches: readonly PartialNumericStats[]): NumericStats {
  const result = cloneNumericStats(base);
  for (const patch of patches) {
    addPartialNumericStats(result, patch);
  }
  return result;
}

export function createNumericRatioDivisors(initialValue = DEFAULT_RATIO_DIVISOR): NumericRatioDivisors {
  return {
    dodge: initialValue,
    crit: initialValue,
    breakPower: initialValue,
    resolvePower: initialValue,
    cooldownSpeed: initialValue,
    moveSpeed: initialValue,
    elementDamageReduce: createElementStatGroup(initialValue),
  };
}

export function cloneNumericRatioDivisors(source: NumericRatioDivisors): NumericRatioDivisors {
  return {
    dodge: source.dodge,
    crit: source.crit,
    breakPower: source.breakPower,
    resolvePower: source.resolvePower,
    cooldownSpeed: source.cooldownSpeed,
    moveSpeed: source.moveSpeed,
    elementDamageReduce: cloneElementStatGroup(source.elementDamageReduce),
  };
}

export function ratioValue(value: number, divisor: number): number {
  if (value === 0) return 0;
  if (divisor <= 0) return value > 0 ? 1 : -1;
  return value > 0 ? value / (value + divisor) : -value / divisor;
}

export function getScalarRatioValue(stats: NumericStats, divisors: NumericRatioDivisors, key: keyof Omit<NumericRatioDivisors, 'elementDamageReduce'>): number {
  return ratioValue(stats[key], divisors[key]);
}

export function getElementDamageReduceRatio(stats: NumericStats, divisors: NumericRatioDivisors, element: ElementKey): number {
  return ratioValue(stats.elementDamageReduce[element], divisors.elementDamageReduce[element]);
}

export function calcQiCostWithOutputLimit(plannedCost: number, maxQiOutputPerTick: number): number {
  if (plannedCost <= 0) return 0;
  if (maxQiOutputPerTick <= 0) return Number.POSITIVE_INFINITY;
  if (plannedCost <= maxQiOutputPerTick) return plannedCost;

  const segment = maxQiOutputPerTick * 0.2;
  if (segment <= 0) return Number.POSITIVE_INFINITY;

  const overflow = plannedCost - maxQiOutputPerTick;
  const fullSegments = Math.floor(overflow / segment);
  const remainder = overflow - fullSegments * segment;
  const fullSegmentCost = segment * fullSegments * (fullSegments + 3) / 2;
  const remainderCost = remainder * (fullSegments + 2);
  return maxQiOutputPerTick + fullSegmentCost + remainderCost;
}

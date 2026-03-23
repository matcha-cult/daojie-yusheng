/**
 * 属性成长计算常量。
 */

/** 采用指数型成长的核心数值键。 */
export const REALM_EXPONENTIAL_NUMERIC_KEYS = [
  'maxHp',
  'physAtk',
  'spellAtk',
] as const;

/** 采用线性成长的辅助数值键。 */
export const REALM_LINEAR_NUMERIC_KEYS = [
  'maxQi',
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
] as const;

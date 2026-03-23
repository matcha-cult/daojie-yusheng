import {
  compileValueStatsToActualStats,
  type Attributes,
  NUMERIC_SCALAR_STAT_KEYS,
  type PartialNumericStats,
} from '@mud/shared';
import { getAttrKeyLabel, getElementKeyLabel, getNumericScalarStatKeyLabel } from '../domain-labels';
import { PERCENT_STAT_KEYS } from '../constants/ui/stat-preview';

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (Math.abs(value % 1) < 1e-6) {
    return String(Math.round(value));
  }
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function formatSignedNumber(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatNumber(value)}`;
}

function formatSignedStatValue(key: string, value: number): string {
  const sign = value >= 0 ? '+' : '-';
  const absValue = Math.abs(value);
  if (key === 'critDamage') {
    return `${sign}${formatNumber(absValue / 10)}%`;
  }
  if (PERCENT_STAT_KEYS.has(key)) {
    return `${sign}${formatNumber(absValue / 100)}%`;
  }
  return `${sign}${formatNumber(absValue)}`;
}

export function resolvePreviewStats(
  stats?: PartialNumericStats,
  valueStats?: PartialNumericStats,
): PartialNumericStats | undefined {
  return valueStats ? compileValueStatsToActualStats(valueStats) : stats;
}

export function describePreviewBonuses(
  attrs?: Partial<Attributes>,
  stats?: PartialNumericStats,
  valueStats?: PartialNumericStats,
): string[] {
  const lines: string[] = [];
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (typeof value !== 'number' || value === 0) {
        continue;
      }
      lines.push(`${getAttrKeyLabel(key)} ${formatSignedNumber(value)}`);
    }
  }

  const resolvedStats = resolvePreviewStats(stats, valueStats);
  if (!resolvedStats) {
    return lines;
  }

  for (const key of NUMERIC_SCALAR_STAT_KEYS) {
    const value = resolvedStats[key];
    if (typeof value !== 'number' || value === 0) {
      continue;
    }
    lines.push(`${getNumericScalarStatKeyLabel(key)} ${formatSignedStatValue(key, value)}`);
  }

  if (resolvedStats.elementDamageBonus) {
    for (const [key, value] of Object.entries(resolvedStats.elementDamageBonus)) {
      if (typeof value !== 'number' || value === 0) {
        continue;
      }
      lines.push(`${getElementKeyLabel(key)}行增伤 ${formatSignedNumber(value)}`);
    }
  }

  if (resolvedStats.elementDamageReduce) {
    for (const [key, value] of Object.entries(resolvedStats.elementDamageReduce)) {
      if (typeof value !== 'number' || value === 0) {
        continue;
      }
      lines.push(`${getElementKeyLabel(key)}行减伤 ${formatSignedNumber(value)}`);
    }
  }

  return lines;
}

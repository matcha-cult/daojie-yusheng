import * as fs from 'fs';
import * as path from 'path';
import {
  TECHNIQUE_GRADE_LABELS,
  calculateBuffValue,
  calculateEquipmentValue,
  calculateSkillValue,
  calculateTechniqueValue,
  resolveSkillUnlockLevel,
  SkillBuffEffectDef,
  SkillDef,
  TechniqueGrade,
  TechniqueLayerDef,
} from '@mud/shared';

type RawTechnique = {
  id: string;
  name: string;
  grade: TechniqueGrade;
  layers: TechniqueLayerDef[];
  skills: SkillDef[];
};

type RawEquipment = {
  itemId: string;
  name: string;
  type: string;
  grade?: TechniqueGrade;
  level?: number;
  desc: string;
  equipSlot?: string;
  equipAttrs?: Record<string, number>;
  equipStats?: Record<string, number>;
};

type RawMap = {
  dangerLevel?: number;
};

export interface ValueReportRow {
  name: string;
  grade: string;
  level: string;
  quantifiedValue: string;
  unquantifiedValue: string;
}

function getContentRoot(): string {
  return path.join(process.cwd(), 'data', 'content');
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function readJsonEntries<T>(dirPath: string): T[] {
  const entries: T[] = [];
  for (const file of fs.readdirSync(dirPath).filter((entry) => entry.endsWith('.json')).sort()) {
    entries.push(...readJsonFile<T[]>(path.join(dirPath, file)));
  }
  return entries;
}

function walkForItemIds(value: unknown, found: Set<string>): void {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkForItemIds(entry, found);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.itemId === 'string') {
    found.add(record.itemId);
  }
  for (const entry of Object.values(record)) {
    walkForItemIds(entry, found);
  }
}

export function readTechniques(): RawTechnique[] {
  return readJsonEntries<RawTechnique>(path.join(getContentRoot(), 'techniques'));
}

export function readEquipmentItems(): RawEquipment[] {
  return readJsonEntries<RawEquipment>(path.join(getContentRoot(), 'items'))
    .filter((entry) => entry.type === 'equipment');
}

function formatTechniqueGrade(grade: TechniqueGrade): string {
  return TECHNIQUE_GRADE_LABELS[grade] ?? grade;
}

function mapDangerToEquipmentGrade(dangerLevel: number): string {
  const mapping: Record<number, string> = {
    1: '凡阶',
    2: '黄阶',
    3: '玄阶',
    4: '地阶',
    5: '天阶',
  };
  return mapping[dangerLevel] ?? '未定';
}

function buildEquipmentMapDangerIndex(): Map<string, number> {
  const mapsDir = path.join(process.cwd(), 'data', 'maps');
  const index = new Map<string, number>();
  for (const file of fs.readdirSync(mapsDir).filter((entry) => entry.endsWith('.json')).sort()) {
    if (file === 'spawn.json') {
      continue;
    }
    let map: RawMap & Record<string, unknown>;
    try {
      map = readJsonFile<RawMap & Record<string, unknown>>(path.join(mapsDir, file));
    } catch {
      continue;
    }
    const found = new Set<string>();
    walkForItemIds(map, found);
    const dangerLevel = Number.isFinite(map.dangerLevel) ? Number(map.dangerLevel) : 0;
    for (const itemId of found) {
      if (!itemId.startsWith('equip.')) {
        continue;
      }
      const previous = index.get(itemId);
      if (previous === undefined || (dangerLevel > 0 && dangerLevel < previous)) {
        index.set(itemId, dangerLevel);
      }
    }
  }
  return index;
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function joinUnquantified(parts: string[]): string {
  const unique = [...new Set(parts.map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
  return unique.length > 0 ? unique.join('；') : '-';
}

export function buildEquipmentRows(): ValueReportRow[] {
  const dangerIndex = buildEquipmentMapDangerIndex();
  return readEquipmentItems().map((item) => {
    const summary = calculateEquipmentValue(item);
    const dangerLevel = dangerIndex.get(item.itemId);
    const grade = item.grade
      ? formatTechniqueGrade(item.grade)
      : typeof dangerLevel === 'number' && dangerLevel > 0
        ? mapDangerToEquipmentGrade(dangerLevel)
        : '未定';
    const level = Number.isFinite(item.level)
      ? String(item.level)
      : typeof dangerLevel === 'number' && dangerLevel > 0
        ? String(dangerLevel)
        : '-';
    return {
      name: item.name,
      grade,
      level,
      quantifiedValue: formatNumber(summary.quantifiedValue),
      unquantifiedValue: joinUnquantified(summary.unquantified),
    };
  });
}

export function buildTechniqueRows(): ValueReportRow[] {
  return readTechniques().map((technique) => {
    const maxLevel = technique.layers[technique.layers.length - 1]?.level ?? 1;
    const summary = calculateTechniqueValue({
      level: maxLevel,
      layers: technique.layers,
    });
    return {
      name: technique.name,
      grade: formatTechniqueGrade(technique.grade),
      level: String(maxLevel),
      quantifiedValue: formatNumber(summary.quantifiedValue),
      unquantifiedValue: joinUnquantified(summary.unquantified),
    };
  });
}

export function buildSkillRows(): ValueReportRow[] {
  return readTechniques().flatMap((technique) => technique.skills.map((skill) => {
    const summary = calculateSkillValue(skill);
    return {
      name: skill.name,
      grade: formatTechniqueGrade(technique.grade),
      level: String(resolveSkillUnlockLevel(skill)),
      quantifiedValue: formatNumber(summary.quantifiedValue),
      unquantifiedValue: joinUnquantified(summary.unquantified.length > 0 ? summary.unquantified : [skill.desc]),
    };
  }));
}

export function buildBuffRows(): ValueReportRow[] {
  return readTechniques().flatMap((technique) => technique.skills.flatMap((skill) => skill.effects
    .filter((effect): effect is SkillBuffEffectDef => effect.type === 'buff')
    .map((effect) => {
      const summary = calculateBuffValue(effect);
      return {
        name: `${effect.name}(${skill.name})`,
        grade: formatTechniqueGrade(technique.grade),
        level: String(resolveSkillUnlockLevel(skill)),
        quantifiedValue: formatNumber(summary.quantifiedValue),
        unquantifiedValue: joinUnquantified(summary.unquantified),
      };
    })));
}

export function renderMarkdownTable(title: string, rows: ValueReportRow[]): string {
  const sortedRows = [...rows].sort((left, right) => {
    const leftValue = Number(left.quantifiedValue) || 0;
    const rightValue = Number(right.quantifiedValue) || 0;
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }
    return left.name.localeCompare(right.name, 'zh-Hans-CN');
  });

  const lines = [
    `## ${title}`,
    '',
    '| 名字 | 品阶 | 等级 | 量化价值 | 无法量化价值 |',
    '| --- | --- | --- | --- | --- |',
    ...sortedRows.map((row) => `| ${escapeCell(row.name)} | ${escapeCell(row.grade)} | ${escapeCell(row.level)} | ${escapeCell(row.quantifiedValue)} | ${escapeCell(row.unquantifiedValue)} |`),
    '',
  ];
  return lines.join('\n');
}

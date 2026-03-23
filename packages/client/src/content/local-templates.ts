import type { GmEditorItemOption, GmEditorTechniqueOption, ItemStack, SkillDef, TechniqueState } from '@mud/shared';
import { LOCAL_EDITOR_CATALOG } from '../constants/world/editor-catalog';

const itemTemplateMap = new Map(LOCAL_EDITOR_CATALOG.items.map((item) => [item.itemId, item] as const));
const techniqueTemplateMap = new Map(LOCAL_EDITOR_CATALOG.techniques.map((technique) => [technique.id, technique] as const));
const skillTemplateMap = new Map(
  LOCAL_EDITOR_CATALOG.techniques.flatMap((technique) =>
    (technique.skills ?? []).map((skill) => [skill.id, skill] as const),
  ),
);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getLocalItemTemplate(itemId: string): GmEditorItemOption | null {
  const template = itemTemplateMap.get(itemId);
  return template ? clone(template) : null;
}

export function getLocalTechniqueTemplate(techId: string): GmEditorTechniqueOption | null {
  const template = techniqueTemplateMap.get(techId);
  return template ? clone(template) : null;
}

export function getLocalSkillTemplate(skillId: string): SkillDef | null {
  const template = skillTemplateMap.get(skillId);
  return template ? clone(template) : null;
}

export function resolvePreviewItem(item: ItemStack): ItemStack {
  const template = getLocalItemTemplate(item.itemId);
  if (!template) {
    return item;
  }
  return {
    ...item,
    name: item.name || template.name,
    type: item.type || template.type,
    desc: item.desc || template.desc || '',
    grade: item.grade ?? template.grade,
    level: item.level ?? template.level,
    equipSlot: item.equipSlot ?? template.equipSlot,
    equipAttrs: item.equipAttrs ?? template.equipAttrs,
    equipStats: item.equipStats ?? template.equipStats,
    equipValueStats: item.equipValueStats ?? template.equipValueStats,
    effects: item.effects ?? template.effects,
    tags: item.tags ?? template.tags,
  };
}

export function resolvePreviewSkill(skill: SkillDef): SkillDef {
  const template = getLocalSkillTemplate(skill.id);
  if (!template) {
    return skill;
  }
  return {
    ...skill,
    name: skill.name || template.name,
    desc: skill.desc || template.desc,
    cooldown: skill.cooldown ?? template.cooldown,
    cost: skill.cost ?? template.cost,
    range: skill.range ?? template.range,
    targeting: skill.targeting ?? template.targeting,
    effects: skill.effects?.length ? skill.effects : template.effects,
    unlockLevel: skill.unlockLevel ?? template.unlockLevel,
    unlockRealm: skill.unlockRealm ?? template.unlockRealm,
    unlockPlayerRealm: skill.unlockPlayerRealm ?? template.unlockPlayerRealm,
    requiresTarget: skill.requiresTarget ?? template.requiresTarget,
    targetMode: skill.targetMode ?? template.targetMode,
  };
}

export function resolvePreviewSkills(skills: SkillDef[] | undefined): SkillDef[] {
  return (skills ?? []).map((skill) => resolvePreviewSkill(skill));
}

export function resolvePreviewTechnique(technique: TechniqueState): TechniqueState {
  const template = getLocalTechniqueTemplate(technique.techId);
  if (!template) {
    return {
      ...technique,
      skills: resolvePreviewSkills(technique.skills),
    };
  }
  return {
    ...technique,
    name: technique.name || template.name,
    grade: technique.grade ?? template.grade,
    skills: technique.skills.length > 0
      ? resolvePreviewSkills(technique.skills)
      : clone(template.skills ?? []),
    layers: technique.layers && technique.layers.length > 0
      ? technique.layers
      : clone(template.layers ?? []),
  };
}

export function resolvePreviewTechniques(techniques: TechniqueState[] | undefined): TechniqueState[] {
  return (techniques ?? []).map((technique) => resolvePreviewTechnique(technique));
}

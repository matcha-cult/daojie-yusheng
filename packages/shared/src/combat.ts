import type { ElementKey } from './numeric';
import type { SkillDamageKind } from './types';

export const DAMAGE_TRAIL_PHYSICAL_COLOR = '#cf7a32';
export const DAMAGE_TRAIL_SPELL_COLOR = '#2b5fae';

export const ELEMENT_DAMAGE_TRAIL_COLORS: Record<ElementKey, string> = {
  metal: '#f9a825',
  wood: '#7cb342',
  water: '#039be5',
  fire: '#e53935',
  earth: '#8d6e63',
};

export function getDamageTrailColor(damageKind: SkillDamageKind, element?: ElementKey): string {
  if (damageKind === 'physical') {
    return DAMAGE_TRAIL_PHYSICAL_COLOR;
  }
  return element ? ELEMENT_DAMAGE_TRAIL_COLORS[element] : DAMAGE_TRAIL_SPELL_COLOR;
}

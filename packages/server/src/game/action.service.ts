import { Injectable } from '@nestjs/common';
import { ActionDef, PlayerState, ratioValue } from '@mud/shared';
import { AttrService } from './attr.service';
import { TechniqueService } from './technique.service';

@Injectable()
export class ActionService {
  constructor(
    private readonly techniqueService: TechniqueService,
    private readonly attrService: AttrService,
  ) {}

  /** 根据功法技能重建可用行动列表 */
  rebuildActions(player: PlayerState, contextActions: ActionDef[] = []): void {
    const cooldowns = new Map(player.actions.map((action) => [action.id, action.cooldownLeft]));
    const skillActions = this.techniqueService.getSkillActions(player);
    const merged = [...contextActions, ...skillActions].map((action) => ({
      ...action,
      cooldownLeft: cooldowns.get(action.id) ?? action.cooldownLeft,
    }));
    player.actions = merged;
  }

  getAction(player: PlayerState, actionId: string): ActionDef | undefined {
    return player.actions.find((action) => action.id === actionId);
  }

  beginCooldown(player: PlayerState, actionId: string): string | null {
    const action = player.actions.find(a => a.id === actionId);
    if (!action) return '行动不存在';
    if (action.cooldownLeft > 0) return '技能冷却中';

    // 查找对应技能定义获取冷却时间
    for (const tech of player.techniques) {
      const skill = tech.skills.find(s => s.id === actionId);
      if (skill) {
        const ratioDivisors = this.attrService.getPlayerRatioDivisors(player);
        const numericStats = this.attrService.getPlayerNumericStats(player);
        const cooldownRate = Math.max(0, ratioValue(numericStats.cooldownSpeed, ratioDivisors.cooldownSpeed));
        action.cooldownLeft = Math.max(1, Math.ceil(skill.cooldown * (1 - cooldownRate)));
        break;
      }
    }

    return null;
  }

  /** 每 tick 冷却递减，返回是否有变化 */
  tickCooldowns(player: PlayerState): boolean {
    let changed = false;
    for (const action of player.actions) {
      if (action.cooldownLeft > 0) {
        action.cooldownLeft -= 1;
        changed = true;
      }
    }
    return changed;
  }
}

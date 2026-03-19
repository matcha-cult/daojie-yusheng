import { Injectable } from '@nestjs/common';
import {
  Attributes,
  AttrBonus,
  AttrKey,
  PlayerState,
  HP_PER_CONSTITUTION,
  BASE_MAX_HP,
} from '@mud/shared';

const ATTR_KEYS: AttrKey[] = ['constitution', 'spirit', 'perception', 'talent', 'comprehension', 'luck'];

@Injectable()
export class AttrService {
  /** 合并基础属性与所有加成，得到最终属性 */
  computeFinal(base: Attributes, bonuses: AttrBonus[]): Attributes {
    const result = { ...base };
    for (const bonus of bonuses) {
      for (const key of ATTR_KEYS) {
        if (bonus.attrs[key]) {
          result[key] += bonus.attrs[key]!;
        }
      }
    }
    return result;
  }

  /** 根据体质计算最大HP */
  computeMaxHp(finalAttrs: Attributes): number {
    return BASE_MAX_HP + finalAttrs.constitution * HP_PER_CONSTITUTION;
  }

  /** 重算玩家属性并更新 maxHp */
  recalcPlayer(player: PlayerState): void {
    const final = this.computeFinal(player.baseAttrs, player.bonuses);
    const newMaxHp = this.computeMaxHp(final);
    // maxHp 变化时按比例调整当前 hp
    if (player.maxHp > 0 && newMaxHp !== player.maxHp) {
      const ratio = player.hp / player.maxHp;
      player.hp = Math.max(1, Math.round(ratio * newMaxHp));
    }
    player.maxHp = newMaxHp;
  }
}

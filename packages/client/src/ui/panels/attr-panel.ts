import { S2C_AttrUpdate, PlayerState, AttrKey, AttrBonus, Attributes } from '@mud/shared';

const ATTR_NAMES: Record<AttrKey, string> = {
  constitution: '体质',
  spirit: '灵力',
  perception: '感知',
  talent: '资质',
  comprehension: '悟性',
  luck: '气运',
};

const ATTR_KEYS: AttrKey[] = ['constitution', 'spirit', 'perception', 'talent', 'comprehension', 'luck'];

/** 属性面板：显示六维属性和最大HP */
export class AttrPanel {
  private pane = document.getElementById('pane-attr')!;

  clear(): void {
    this.pane.innerHTML = '<div class="empty-hint">尚未观测到角色属性</div>';
  }

  update(data: S2C_AttrUpdate): void {
    this.render(data.baseAttrs, data.bonuses, data.finalAttrs, data.maxHp);
  }

  initFromPlayer(player: PlayerState): void {
    // 计算最终属性（基础 + 加成）
    const finalAttrs = { ...player.baseAttrs };
    for (const bonus of player.bonuses) {
      for (const key of ATTR_KEYS) {
        if (bonus.attrs[key]) {
          finalAttrs[key] += bonus.attrs[key]!;
        }
      }
    }
    this.render(player.baseAttrs, player.bonuses, finalAttrs, player.maxHp);
  }

  private render(base: Attributes, bonuses: AttrBonus[], final: Attributes, maxHp: number): void {
    // 计算每个属性的总加成
    const totalBonus: Partial<Attributes> = {};
    for (const b of bonuses) {
      for (const key of ATTR_KEYS) {
        if (b.attrs[key]) {
          totalBonus[key] = (totalBonus[key] || 0) + b.attrs[key]!;
        }
      }
    }

    let html = '<div class="panel-section">';
    html += '<div class="panel-section-title">六维属性</div>';
    for (const key of ATTR_KEYS) {
      const bonus = totalBonus[key] || 0;
      const bonusStr = bonus > 0 ? ` <span style="color:var(--stamp-red)">+${bonus}</span>` : '';
      html += `<div class="attr-card">
        <div class="attr-card-main">
          <span class="panel-label">${ATTR_NAMES[key]}</span>
          <span class="panel-value">${final[key]}</span>
        </div>
        <div class="attr-card-sub">基础 ${base[key]}${bonusStr || ''}</div>
      </div>`;
    }
    html += '</div>';

    html += '<div class="panel-section">';
    html += '<div class="panel-section-title">生命</div>';
    html += `<div class="intel-card">
      <div class="intel-label">最大气血</div>
      <div class="intel-value">${maxHp}</div>
    </div>`;
    if (bonuses.length > 0) {
      html += '<div class="panel-subtext">加成来源：' + bonuses.map((bonus) => bonus.source).join('、') + '</div>';
    }
    html += '</div>';

    this.pane.innerHTML = html;
  }
}

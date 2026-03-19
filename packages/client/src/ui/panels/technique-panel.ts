import { TechniqueState, TechniqueRealm, PlayerState } from '@mud/shared';

const REALM_NAMES: Record<TechniqueRealm, string> = {
  [TechniqueRealm.Entry]: '入门',
  [TechniqueRealm.Minor]: '小成',
  [TechniqueRealm.Major]: '大成',
  [TechniqueRealm.Perfection]: '圆满',
};

/** 功法面板：显示已学功法、境界、经验和技能 */
export class TechniquePanel {
  private pane = document.getElementById('pane-technique')!;
  private onCultivate: ((techId: string | null) => void) | null = null;

  clear(): void {
    this.pane.innerHTML = '<div class="empty-hint">尚未习得功法</div>';
  }

  setCallbacks(onCultivate: (techId: string | null) => void): void {
    this.onCultivate = onCultivate;
  }

  update(techniques: TechniqueState[], cultivatingTechId?: string): void {
    this.render(techniques, cultivatingTechId);
  }

  initFromPlayer(player: PlayerState): void {
    this.render(player.techniques, player.cultivatingTechId);
  }

  private render(techniques: TechniqueState[], cultivatingTechId?: string): void {
    if (techniques.length === 0) {
      this.clear();
      return;
    }

    let html = '';
    for (const tech of techniques) {
      const isCultivating = cultivatingTechId === tech.techId;
      const expPercent = tech.expToNext > 0 ? Math.floor((tech.exp / tech.expToNext) * 100) : 100;
      const skillHtml = tech.skills.length > 0
        ? tech.skills.map((skill) => `
            <div class="skill-chip">
              <div class="skill-chip-title">${skill.name}</div>
              <div class="skill-chip-meta">射程 ${skill.range} · 威力 ${skill.power} · 冷却 ${skill.cooldown}s</div>
            </div>
          `).join('')
        : '<div class="empty-hint compact">暂无可用招式</div>';

      html += `<div class="tech-card">
        <div class="tech-head">
          <span class="tech-name">${tech.name}</span>
          <span class="tech-realm">${REALM_NAMES[tech.realm]}</span>
        </div>
        <div class="tech-exp-bar">
          <div class="tech-exp-fill" style="width:${expPercent}%"></div>
        </div>
        <div class="tech-meta">
          <span>层级 ${tech.level}</span>
          <span>经验 ${tech.exp}/${tech.expToNext > 0 ? tech.expToNext : '满'}</span>
        </div>`;

      html += `<div class="tech-skills">${skillHtml}</div>`;

      if (isCultivating) {
        html += `<button class="small-btn danger" data-cultivate-stop="${tech.techId}">停止修炼</button>`;
      } else {
        html += `<button class="small-btn" data-cultivate="${tech.techId}">修炼</button>`;
      }

      html += '</div>';
    }

    this.pane.innerHTML = html;

    this.pane.querySelectorAll('[data-cultivate]').forEach(btn => {
      btn.addEventListener('click', () => {
        const techId = (btn as HTMLElement).dataset.cultivate!;
        this.onCultivate?.(techId);
      });
    });
    this.pane.querySelectorAll('[data-cultivate-stop]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.onCultivate?.(null);
      });
    });
  }
}

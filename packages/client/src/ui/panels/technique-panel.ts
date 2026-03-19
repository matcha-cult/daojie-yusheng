import {
  Attributes,
  calcTechniqueAttrValues,
  calcTechniqueNextLevelGains,
  TechniqueAttrCurves,
  TECHNIQUE_ATTR_KEYS,
  TECHNIQUE_GRADE_LABELS,
  TechniqueState,
  TechniqueRealm,
  PlayerState,
} from '@mud/shared';

const REALM_NAMES: Record<TechniqueRealm, string> = {
  [TechniqueRealm.Entry]: '入门',
  [TechniqueRealm.Minor]: '小成',
  [TechniqueRealm.Major]: '大成',
  [TechniqueRealm.Perfection]: '圆满',
};

const ATTR_NAMES: Record<keyof Attributes, string> = {
  constitution: '体魄',
  spirit: '神识',
  perception: '身法',
  talent: '根骨',
  comprehension: '悟性',
  luck: '气运',
};

const TOOLTIP_STYLE_CLASS = 'tech-tooltip';

type TechniquePanelState = {
  cultivatingTechId?: string;
  spellAtk: number;
  techniques: TechniqueState[];
};

function formatNumber(value: number): string {
  return value.toFixed(value % 1 === 0 ? 0 : value % 0.1 === 0 ? 1 : 2);
}

function formatAttrMap(prefix: string, attrs: Partial<Attributes>): string {
  const entries = TECHNIQUE_ATTR_KEYS
    .map((key) => [key, attrs[key] ?? 0] as const)
    .filter(([, value]) => value > 0);
  if (entries.length === 0) {
    return `${prefix}无`;
  }
  return `${prefix}${entries.map(([key, value]) => `${ATTR_NAMES[key]}+${formatNumber(value)}`).join(' / ')}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function unlockLayerForRealm(realm: TechniqueRealm): number {
  return realm + 1;
}

function formatLayerRange(startLevel: number, endLevel?: number): string {
  if (endLevel === undefined) {
    return `第${startLevel}层后`;
  }
  if (startLevel === endLevel) {
    return `第${startLevel}层`;
  }
  return `第${startLevel}-${endLevel}层`;
}

function buildLayerGrowthRows(curves?: TechniqueAttrCurves): string[] {
  if (!curves) return ['当前未配置成长明细'];
  const boundaries = new Set<number>();
  for (const key of TECHNIQUE_ATTR_KEYS) {
    const segments = curves[key];
    if (!segments) continue;
    for (const segment of segments) {
      boundaries.add(segment.startLevel);
      if (segment.endLevel !== undefined) {
        boundaries.add(segment.endLevel + 1);
      }
    }
  }

  const sorted = [...boundaries].filter((value) => value > 0).sort((left, right) => left - right);
  if (sorted.length === 0) return ['当前未配置成长明细'];

  const rows: string[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const start = sorted[index];
    const next = sorted[index + 1];
    const end = next === undefined ? undefined : next - 1;
    const parts: string[] = [];

    for (const key of TECHNIQUE_ATTR_KEYS) {
      const segments = curves[key];
      const active = segments?.find((segment) => {
        const segmentEnd = segment.endLevel ?? Number.POSITIVE_INFINITY;
        return start >= segment.startLevel && start <= segmentEnd;
      });
      if (!active || active.gainPerLevel <= 0) continue;
      parts.push(`${ATTR_NAMES[key]}+${formatNumber(active.gainPerLevel)}/层`);
    }

    if (parts.length === 0) continue;
    rows.push(`${formatLayerRange(start, end)}：${parts.join('，')}`);
  }

  return rows.length > 0 ? rows : ['当前未配置成长明细'];
}

function buildSkillTooltip(technique: TechniqueState, spellAtk: number) {
  return technique.skills.map((skill) => {
    const unlockLayer = unlockLayerForRealm(skill.unlockRealm);
    const preDefense = skill.power + Math.round(spellAtk);
    const detail = [
      skill.desc,
      `解锁层数：第${unlockLayer}层（${REALM_NAMES[skill.unlockRealm]}）`,
      `基础威力：${skill.power}`,
      `属性加成：法术攻击 +${Math.round(spellAtk)}`,
      `当前理论伤害前置值：${preDefense}`,
      `灵力消耗：${skill.cost}`,
      `射程：${skill.range}`,
      `冷却：${skill.cooldown} 秒`,
      '实际伤害仍会受命中、闪避、破招、化解、暴击与目标法术防御影响。',
    ].join('\n');
    return { skillId: skill.id, detail };
  });
}

export class TechniquePanel {
  private pane = document.getElementById('pane-technique')!;
  private onCultivate: ((techId: string | null) => void) | null = null;
  private expandedTechIds = new Set<string>();
  private tooltip: HTMLDivElement | null = null;
  private lastState: TechniquePanelState = { techniques: [], spellAtk: 0 };

  clear(): void {
    this.pane.innerHTML = '<div class="empty-hint">尚未习得功法</div>';
  }

  setCallbacks(onCultivate: (techId: string | null) => void): void {
    this.onCultivate = onCultivate;
  }

  update(techniques: TechniqueState[], cultivatingTechId?: string, spellAtk = 0): void {
    this.lastState = { techniques, cultivatingTechId, spellAtk };
    this.render(techniques, cultivatingTechId, spellAtk);
  }

  initFromPlayer(player: PlayerState): void {
    this.update(player.techniques, player.cultivatingTechId, player.numericStats?.spellAtk ?? 0);
  }

  private render(techniques: TechniqueState[], cultivatingTechId?: string, spellAtk = 0): void {
    if (techniques.length === 0) {
      this.clear();
      return;
    }

    let html = '';
    for (const tech of techniques) {
      const isCultivating = cultivatingTechId === tech.techId;
      const isExpanded = this.expandedTechIds.has(tech.techId);
      const expPercent = tech.expToNext > 0 ? Math.floor((tech.exp / tech.expToNext) * 100) : 100;
      const currentAttrs = calcTechniqueAttrValues(tech.level, tech.attrCurves);
      const nextAttrs = calcTechniqueNextLevelGains(tech.level, tech.attrCurves);
      const growthRows = buildLayerGrowthRows(tech.attrCurves);
      const skills = [...tech.skills].sort((left, right) => left.unlockRealm - right.unlockRealm);
      const tooltips = new Map(buildSkillTooltip(tech, spellAtk).map((entry) => [entry.skillId, entry.detail]));

      const skillHtml = skills.length > 0
        ? skills.map((skill) => {
          const unlockLayer = unlockLayerForRealm(skill.unlockRealm);
          const unlocked = tech.level >= unlockLayer;
          return `
            <div class="skill-chip ${unlocked ? '' : 'locked'}"
              data-tech-tooltip-title="${escapeHtml(skill.name)}"
              data-tech-tooltip-detail="${escapeHtml(tooltips.get(skill.id) ?? skill.desc)}">
              <div class="skill-chip-title">${skill.name}</div>
              <div class="skill-chip-meta">第${unlockLayer}层解锁 · ${REALM_NAMES[skill.unlockRealm]} · ${unlocked ? '已解锁' : '未解锁'}</div>
            </div>
          `;
        }).join('')
        : '<div class="empty-hint compact">暂无可用招式</div>';

      const growthHtml = growthRows.map((row) => {
        const [layer, detail] = row.split('：');
        return `<div class="tech-growth-row"><span class="tech-growth-layer">${layer}</span><span>${detail ?? ''}</span></div>`;
      }).join('');

      html += `<div class="tech-card ${isExpanded ? 'expanded' : ''}">
        <button class="tech-summary" data-tech-toggle="${tech.techId}" type="button">
          <span class="tech-summary-main">
            <span class="tech-name">${tech.name}</span>
            <span class="tech-realm">${tech.grade ? TECHNIQUE_GRADE_LABELS[tech.grade] : '无品'}</span>
            <span class="tech-layer">第${tech.level}层</span>
          </span>
          <span class="tech-arrow">▶</span>
        </button>
        <div class="tech-details">
          <div class="tech-exp-bar">
            <div class="tech-exp-fill" style="width:${expPercent}%"></div>
          </div>
          <div class="tech-meta">
            <span>当前境界：${REALM_NAMES[tech.realm]}</span>
            <span>经验 ${tech.exp}/${tech.expToNext > 0 ? tech.expToNext : '满'}</span>
          </div>
          <div class="tech-meta">
            <span>${formatAttrMap('本法当前原始加成 ', currentAttrs)}</span>
            <span>${formatAttrMap('下一层原始收益 ', nextAttrs)}</span>
          </div>
          <div class="tech-section-title">层数成长</div>
          <div class="tech-growth-list">${growthHtml}</div>
          <div class="tech-section-title">技能解锁</div>
          <div class="tech-skills">${skillHtml}</div>
          ${isCultivating
            ? `<button class="small-btn danger" data-cultivate-stop="${tech.techId}" type="button">停止修炼</button>`
            : `<button class="small-btn" data-cultivate="${tech.techId}" type="button">修炼</button>`}
        </div>
      </div>`;
    }

    this.pane.innerHTML = html;
    this.bindActions();
    this.bindTooltips();
  }

  private bindActions(): void {
    this.pane.querySelectorAll<HTMLElement>('[data-tech-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const techId = button.dataset.techToggle;
        if (!techId) return;
        if (this.expandedTechIds.has(techId)) {
          this.expandedTechIds.delete(techId);
        } else {
          this.expandedTechIds.add(techId);
        }
        this.render(this.lastState.techniques, this.lastState.cultivatingTechId, this.lastState.spellAtk);
      });
    });

    this.pane.querySelectorAll<HTMLElement>('[data-cultivate]').forEach((button) => {
      button.addEventListener('click', () => {
        const techId = button.dataset.cultivate;
        if (!techId) return;
        this.onCultivate?.(techId);
      });
    });

    this.pane.querySelectorAll<HTMLElement>('[data-cultivate-stop]').forEach((button) => {
      button.addEventListener('click', () => {
        this.onCultivate?.(null);
      });
    });
  }

  private getTooltip(): HTMLDivElement {
    if (!this.tooltip) {
      const tooltip = document.createElement('div');
      tooltip.className = TOOLTIP_STYLE_CLASS;
      document.body.appendChild(tooltip);
      this.tooltip = tooltip;
    }
    return this.tooltip;
  }

  private bindTooltips(): void {
    const tooltip = this.getTooltip();
    const show = (title: string, detail: string, event: PointerEvent) => {
      const lines = detail
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      tooltip.innerHTML = `<div class="tech-tooltip-body"><strong>${escapeHtml(title)}</strong>${lines.length > 0 ? `<div class="tech-tooltip-detail">${lines.map((line) => `<span class="tech-tooltip-line">${escapeHtml(line)}</span>`).join('')}</div>` : ''}</div>`;
      tooltip.style.left = `${event.clientX + 14}px`;
      tooltip.style.top = `${event.clientY + 10}px`;
      tooltip.classList.add('visible');
    };

    this.pane.querySelectorAll<HTMLElement>('[data-tech-tooltip-title]').forEach((node) => {
      const title = node.dataset.techTooltipTitle ?? '';
      const detail = node.dataset.techTooltipDetail ?? '';
      node.addEventListener('pointerenter', (event) => show(title, detail, event));
      node.addEventListener('pointermove', (event) => {
        tooltip.style.left = `${event.clientX + 14}px`;
        tooltip.style.top = `${event.clientY + 10}px`;
      });
      node.addEventListener('pointerleave', () => {
        tooltip.classList.remove('visible');
      });
    });
  }
}

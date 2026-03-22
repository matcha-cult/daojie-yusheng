/**
 * 功法面板
 * 展示已习得功法列表、逐层详情弹窗、主修切换与技能提示
 */

import {
  Attributes,
  calcTechniqueAttrValues,
  calcTechniqueNextLevelGains,
  getTechniqueMaxLevel,
  PlayerState,
  resolveSkillUnlockLevel,
  TECHNIQUE_ATTR_KEYS,
  TECHNIQUE_GRADE_LABELS,
  TechniqueLayerDef,
  TechniqueState,
} from '@mud/shared';
import { FloatingTooltip } from '../floating-tooltip';
import { detailModalHost } from '../detail-modal-host';
import { buildSkillTooltipContent } from '../skill-tooltip';
import { preserveSelection } from '../selection-preserver';

const ATTR_NAMES: Record<keyof Attributes, string> = {
  constitution: '体魄',
  spirit: '神识',
  perception: '身法',
  talent: '根骨',
  comprehension: '悟性',
  luck: '气运',
};

type TechniquePanelState = {
  cultivatingTechId?: string;
  previewPlayer?: PlayerState;
  techniques: TechniqueState[];
};

function formatNumber(value: number): string {
  return value.toFixed(value % 1 === 0 ? 0 : value % 0.1 === 0 ? 1 : 2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatAttrMap(attrs: Partial<Attributes>, fallback = '无属性提升'): string {
  const entries = TECHNIQUE_ATTR_KEYS
    .map((key) => [key, attrs[key] ?? 0] as const)
    .filter(([, value]) => value > 0);
  if (entries.length === 0) {
    return fallback;
  }
  return entries.map(([key, value]) => `${ATTR_NAMES[key]}+${formatNumber(value)}`).join(' / ');
}

function getTechniqueProgressRatio(tech: TechniqueState): number {
  if (tech.expToNext <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, tech.exp / tech.expToNext));
}

function getTechniqueRemainingExp(tech: TechniqueState): number {
  if (tech.expToNext <= 0) {
    return 0;
  }
  return Math.max(0, tech.expToNext - tech.exp);
}

export class TechniquePanel {
  private static readonly MODAL_OWNER = 'technique-panel';
  private pane = document.getElementById('pane-technique')!;
  private onCultivate: ((techId: string | null) => void) | null = null;
  private tooltip = new FloatingTooltip();
  private openTechId: string | null = null;
  private lastState: TechniquePanelState = { techniques: [] };

  constructor() {
    this.bindPaneEvents();
  }

  clear(): void {
    this.pane.innerHTML = '<div class="empty-hint">尚未习得功法</div>';
    this.closeModal();
  }

  setCallbacks(onCultivate: (techId: string | null) => void): void {
    this.onCultivate = onCultivate;
  }

  /** 更新功法列表与主修状态 */
  update(techniques: TechniqueState[], cultivatingTechId?: string, previewPlayer?: PlayerState): void {
    this.lastState = { techniques, cultivatingTechId, previewPlayer };
    this.renderList();
    this.renderModal();
  }

  /** 仅同步经验、进度条与主修状态，避免高频整块重绘 */
  syncDynamic(techniques: TechniqueState[], cultivatingTechId?: string, previewPlayer?: PlayerState): void {
    this.lastState = { techniques, cultivatingTechId, previewPlayer };
    if (!this.patchList() || !this.patchModal()) {
      this.renderList();
      this.renderModal();
    }
  }

  initFromPlayer(player: PlayerState): void {
    this.update(player.techniques, player.cultivatingTechId, player);
  }

  private renderList(): void {
    const { techniques } = this.lastState;
    if (techniques.length === 0) {
      this.clear();
      return;
    }

    preserveSelection(this.pane, () => {
      this.pane.innerHTML = techniques.map((tech) => {
        const maxLevel = getTechniqueMaxLevel(tech.layers, tech.level, tech.attrCurves);
        const isCultivating = this.lastState.cultivatingTechId === tech.techId;
        const progressRatio = getTechniqueProgressRatio(tech);
        const remainingExp = getTechniqueRemainingExp(tech);
        const progressText = tech.expToNext > 0
          ? `${tech.exp}/${tech.expToNext}`
          : '已满层';
        const remainText = tech.expToNext > 0
          ? `距下一层还需 ${remainingExp} 功法经验`
          : '当前已达圆满层';
        return `<div class="tech-card ${isCultivating ? 'cultivating' : ''}" data-tech-card="${tech.techId}">
          <button class="tech-card-main" data-tech-open="${tech.techId}" type="button">
            <span class="tech-summary-main">
              <span class="tech-name">${escapeHtml(tech.name)}</span>
              <span class="tech-realm">${tech.grade ? TECHNIQUE_GRADE_LABELS[tech.grade] : '无品'}</span>
              <span class="tech-layer" data-tech-layer="${tech.techId}">第${tech.level}/${maxLevel}层</span>
            </span>
            <span class="tech-progress-meta">
              <span class="tech-progress-text" data-tech-progress-text="${tech.techId}">${progressText}</span>
            </span>
            <span class="tech-progress-bar"><span class="tech-progress-fill" data-tech-progress-fill="${tech.techId}" style="width:${(progressRatio * 100).toFixed(2)}%"></span></span>
            <span class="tech-progress-remain" data-tech-progress-remain="${tech.techId}">${remainText}</span>
          </button>
          <div class="tech-card-actions">
            <button
              class="small-btn ${isCultivating ? 'danger' : ''}"
              data-tech-cultivate-button="${tech.techId}"
              data-cultivate="${isCultivating ? '' : tech.techId}"
              data-cultivate-stop="${isCultivating ? tech.techId : ''}"
              type="button"
            >${isCultivating ? '取消主修' : '设为主修'}</button>
          </div>
        </div>`;
      }).join('');
    });
  }

  private renderModal(): void {
    if (!this.openTechId) {
      this.closeModal();
      return;
    }
    const tech = this.lastState.techniques.find((entry) => entry.techId === this.openTechId);
    if (!tech) {
      this.closeModal();
      return;
    }

    const maxLevel = getTechniqueMaxLevel(tech.layers, tech.level, tech.attrCurves);
    const currentAttrs = calcTechniqueAttrValues(tech.level, tech.layers, tech.attrCurves);
    const nextAttrs = calcTechniqueNextLevelGains(tech.level, tech.layers, tech.attrCurves);
    const skillsByLevel = new Map<number, TechniqueState['skills']>();
    for (const skill of tech.skills) {
      const unlockLevel = resolveSkillUnlockLevel(skill);
      const current = skillsByLevel.get(unlockLevel) ?? [];
      current.push(skill);
      skillsByLevel.set(unlockLevel, current);
    }

    const layers = tech.layers && tech.layers.length > 0
      ? [...tech.layers].sort((left, right) => left.level - right.level)
      : this.buildLegacyLayers(tech, maxLevel);
    const layerRows = layers.map((layer) => this.renderLayerRow(layer, tech.level, skillsByLevel)).join('');
    detailModalHost.open({
      ownerId: TechniquePanel.MODAL_OWNER,
      variantClass: 'detail-modal--technique',
      title: tech.name,
      subtitle: `${tech.grade ? TECHNIQUE_GRADE_LABELS[tech.grade] : '无品'} · 第 ${tech.level}/${maxLevel} 层`,
      bodyHtml: `
      <div class="tech-modal-summary">
        <div class="tech-modal-stat">
          <span class="tech-modal-label">当前经验</span>
          <span data-tech-modal-current-exp="true">${tech.expToNext > 0 ? `${tech.exp}/${tech.expToNext}` : '已满层'}</span>
        </div>
        <div class="tech-modal-stat">
          <span class="tech-modal-label">当前原始总加成</span>
          <span>${escapeHtml(formatAttrMap(currentAttrs))}</span>
        </div>
        <div class="tech-modal-stat">
          <span class="tech-modal-label">下一层原始收益</span>
          <span>${escapeHtml(formatAttrMap(nextAttrs, '已无下一层'))}</span>
        </div>
      </div>
      <div class="tech-modal-section-title">逐层详情</div>
      <div class="tech-layer-list">${layerRows}</div>
    `,
      onClose: () => {
        this.openTechId = null;
        this.tooltip.hide();
      },
      onAfterRender: (body) => {
        this.bindSkillTooltips(body);
      },
    });
  }

  private buildLegacyLayers(tech: TechniqueState, maxLevel: number): TechniqueLayerDef[] {
    const rows: TechniqueLayerDef[] = [];
    for (let level = 1; level <= maxLevel; level += 1) {
      rows.push({
        level,
        expToNext: level >= maxLevel ? 0 : 0,
        attrs: calcTechniqueNextLevelGains(level - 1, undefined, tech.attrCurves),
      });
    }
    return rows;
  }

  private renderLayerRow(layer: TechniqueLayerDef, currentLevel: number, skillsByLevel: Map<number, TechniqueState['skills']>): string {
    const skills = skillsByLevel.get(layer.level) ?? [];
    const skillTags = skills.length > 0
      ? skills.map((skill) => {
        return `<span class="tech-skill-tag"
          data-skill-tooltip-title="${escapeHtml(skill.name)}"
          data-skill-tooltip-skill-id="${escapeHtml(skill.id)}"
          data-skill-tooltip-unlock-level="${resolveSkillUnlockLevel(skill)}"
          data-skill-tooltip-rich="1">${escapeHtml(skill.name)}</span>`;
      }).join('')
      : '<span class="tech-layer-empty">本层无新技能</span>';

    let expText = '已满层';
    if (layer.expToNext > 0) {
      expText = `升下一层需 ${layer.expToNext} 功法经验`;
    }

    return `<div class="tech-layer-row ${layer.level === currentLevel ? 'current' : ''} ${layer.level < currentLevel ? 'passed' : ''}">
      <div class="tech-layer-row-head">
        <span class="tech-layer-index">第 ${layer.level} 层</span>
        <span class="tech-layer-exp">${expText}</span>
      </div>
      <div class="tech-layer-attrs">${escapeHtml(formatAttrMap(layer.attrs ?? {}, '本层不增加六维'))}</div>
      <div class="tech-layer-skills">
        <span class="tech-modal-label">解锁技能</span>
        <span class="tech-layer-skill-list">${skillTags}</span>
      </div>
    </div>`;
  }

  private bindPaneEvents(): void {
    this.pane.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const cultivateButton = target.closest<HTMLElement>('[data-tech-cultivate-button]');
      if (cultivateButton) {
        event.stopPropagation();
        const techId = cultivateButton.dataset.cultivateStop || cultivateButton.dataset.cultivate;
        if (!techId) {
          return;
        }
        if (cultivateButton.dataset.cultivateStop) {
          this.lastState.cultivatingTechId = undefined;
          this.onCultivate?.(null);
        } else {
          this.lastState.cultivatingTechId = techId;
          this.onCultivate?.(techId);
        }
        this.patchList();
        this.patchModal();
        return;
      }

      const openButton = target.closest<HTMLElement>('[data-tech-open]');
      if (!openButton) {
        return;
      }
      const techId = openButton.dataset.techOpen;
      if (!techId) {
        return;
      }
      this.openTechId = techId;
      this.renderModal();
    });
  }

  private bindSkillTooltips(modalBody: HTMLElement): void {
    modalBody.querySelectorAll<HTMLElement>('[data-skill-tooltip-title]').forEach((node) => {
      const title = node.dataset.skillTooltipTitle ?? '';
      const rich = node.dataset.skillTooltipRich === '1';
      const skillId = node.dataset.skillTooltipSkillId ?? '';
      const unlockLevel = Number(node.dataset.skillTooltipUnlockLevel ?? '0') || undefined;
      node.addEventListener('pointerenter', (event) => {
        const technique = this.lastState.techniques.find((entry) => entry.skills.some((skill) => skill.id === skillId));
        const skill = technique?.skills.find((entry) => entry.id === skillId);
        const tooltip = skill ? buildSkillTooltipContent(skill, {
          unlockLevel,
          techLevel: technique?.level,
          player: this.lastState.previewPlayer,
          knownSkills: this.lastState.techniques.flatMap((entry) => entry.skills),
        }) : { lines: [], asideCards: [] };
        this.tooltip.show(title, tooltip.lines, event.clientX, event.clientY, {
          allowHtml: rich,
          asideCards: tooltip.asideCards,
        });
      });
      node.addEventListener('pointermove', (event) => {
        this.tooltip.move(event.clientX, event.clientY);
      });
      node.addEventListener('pointerleave', () => {
        this.tooltip.hide();
      });
    });
  }

  private closeModal(): void {
    this.openTechId = null;
    detailModalHost.close(TechniquePanel.MODAL_OWNER);
    this.tooltip.hide();
  }

  private patchList(): boolean {
    const { techniques, cultivatingTechId } = this.lastState;
    if (techniques.length === 0) {
      return false;
    }

    for (const tech of techniques) {
      const card = this.pane.querySelector<HTMLElement>(`[data-tech-card="${CSS.escape(tech.techId)}"]`);
      const layerNode = this.pane.querySelector<HTMLElement>(`[data-tech-layer="${CSS.escape(tech.techId)}"]`);
      const progressTextNode = this.pane.querySelector<HTMLElement>(`[data-tech-progress-text="${CSS.escape(tech.techId)}"]`);
      const progressFillNode = this.pane.querySelector<HTMLElement>(`[data-tech-progress-fill="${CSS.escape(tech.techId)}"]`);
      const remainNode = this.pane.querySelector<HTMLElement>(`[data-tech-progress-remain="${CSS.escape(tech.techId)}"]`);
      const cultivateButton = this.pane.querySelector<HTMLButtonElement>(`[data-tech-cultivate-button="${CSS.escape(tech.techId)}"]`);
      if (!card || !layerNode || !progressTextNode || !progressFillNode || !remainNode || !cultivateButton) {
        return false;
      }

      const maxLevel = getTechniqueMaxLevel(tech.layers, tech.level, tech.attrCurves);
      const isCultivating = cultivatingTechId === tech.techId;
      const progressRatio = getTechniqueProgressRatio(tech);
      const remainingExp = getTechniqueRemainingExp(tech);
      const progressText = tech.expToNext > 0 ? `${tech.exp}/${tech.expToNext}` : '已满层';
      const remainText = tech.expToNext > 0
        ? `距下一层还需 ${remainingExp} 功法经验`
        : '当前已达圆满层';

      card.classList.toggle('cultivating', isCultivating);
      layerNode.textContent = `第${tech.level}/${maxLevel}层`;
      progressTextNode.textContent = progressText;
      progressFillNode.style.width = `${(progressRatio * 100).toFixed(2)}%`;
      remainNode.textContent = remainText;
      cultivateButton.textContent = isCultivating ? '取消主修' : '设为主修';
      cultivateButton.classList.toggle('danger', isCultivating);
      cultivateButton.dataset.cultivate = isCultivating ? '' : tech.techId;
      cultivateButton.dataset.cultivateStop = isCultivating ? tech.techId : '';
    }

    return true;
  }

  private patchModal(): boolean {
    if (!this.openTechId) {
      return true;
    }
    if (!detailModalHost.isOpenFor(TechniquePanel.MODAL_OWNER)) {
      return false;
    }
    const tech = this.lastState.techniques.find((entry) => entry.techId === this.openTechId);
    if (!tech) {
      return false;
    }

    const expNode = document.querySelector<HTMLElement>('[data-tech-modal-current-exp="true"]');
    if (!expNode) {
      return false;
    }
    expNode.textContent = tech.expToNext > 0 ? `${tech.exp}/${tech.expToNext}` : '已满层';
    return true;
  }
}

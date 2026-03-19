import { ActionDef, PlayerState } from '@mud/shared';

const TYPE_NAMES: Record<string, string> = {
  skill: '技能',
  gather: '采集',
  interact: '交互',
  battle: '战斗',
  toggle: '开关',
  quest: '任务',
  travel: '传送',
  breakthrough: '突破',
};

/** 行动面板：显示可用行动列表 */
export class ActionPanel {
  private pane = document.getElementById('pane-action')!;
  private onAction: ((actionId: string, requiresTarget?: boolean, targetMode?: string) => void) | null = null;
  private autoBattle = false;
  private autoRetaliate = true;
  private activeTab: 'dialogue' | 'skill' | 'toggle' = 'dialogue';

  clear(): void {
    this.pane.innerHTML = '<div class="empty-hint">暂无可用行动</div>';
  }

  setCallbacks(onAction: (actionId: string, requiresTarget?: boolean, targetMode?: string) => void): void {
    this.onAction = onAction;
  }

  update(actions: ActionDef[], autoBattle?: boolean, autoRetaliate?: boolean): void {
    if (autoBattle !== undefined) this.autoBattle = autoBattle;
    if (autoRetaliate !== undefined) this.autoRetaliate = autoRetaliate;
    this.render(actions);
  }

  initFromPlayer(player: PlayerState): void {
    this.autoBattle = player.autoBattle ?? false;
    this.autoRetaliate = player.autoRetaliate !== false;
    this.render(player.actions);
  }

  private render(actions: ActionDef[]): void {
    if (actions.length === 0) {
      this.clear();
      return;
    }

    const tabGroups: Array<{
      id: 'dialogue' | 'skill' | 'toggle';
      label: string;
      types: string[];
    }> = [
      { id: 'dialogue', label: '对话', types: ['quest', 'interact', 'travel'] },
      { id: 'skill', label: '技能', types: ['skill', 'battle', 'gather', 'breakthrough'] },
      { id: 'toggle', label: '开关', types: ['toggle'] },
    ];
    const groups = new Map<string, ActionDef[]>();
    for (const action of actions) {
      const list = groups.get(action.type) ?? [];
      list.push(action);
      groups.set(action.type, list);
    }

    let html = `<div class="panel-section">
      <div class="panel-section-title">战斗姿态</div>
      <div class="intel-grid compact">
        <div class="intel-card">
          <div class="intel-label">自动战斗</div>
          <div class="intel-value">${this.autoBattle ? '开启' : '关闭'}</div>
        </div>
        <div class="intel-card">
          <div class="intel-label">受击反应</div>
          <div class="intel-value">${this.autoRetaliate ? '自动开战' : '保持克制'}</div>
        </div>
      </div>
    </div>`;

    html += `<div class="action-tab-bar">
      ${tabGroups.map((tab) => `
        <button class="action-tab-btn ${this.activeTab === tab.id ? 'active' : ''}" data-action-tab="${tab.id}" type="button">${tab.label}</button>
      `).join('')}
    </div>`;

    for (const tab of tabGroups) {
      html += `<div class="action-tab-pane ${this.activeTab === tab.id ? 'active' : ''}" data-action-pane="${tab.id}">`;
      const relevantTypes = tab.types.filter((type) => (groups.get(type)?.length ?? 0) > 0);
      if (relevantTypes.length === 0) {
        html += '<div class="empty-hint">当前分组暂无内容</div>';
      } else {
        for (const type of relevantTypes) {
          const entries = groups.get(type) ?? [];
          html += `<div class="panel-section">
            <div class="panel-section-title">${TYPE_NAMES[type] || type}</div>`;
          for (const action of entries) {
            const onCd = action.cooldownLeft > 0;
            html += `<div class="action-item ${onCd ? 'cooldown' : ''}">
              <div class="action-copy">
                <div>
                  <span class="action-name">${action.name}</span>
                  <span class="action-type">[${TYPE_NAMES[action.type] || action.type}]</span>
                </div>
                <div class="action-desc">${action.desc}</div>
              </div>
              <div class="action-cta">
                ${onCd
                  ? `<span class="action-cd">冷却 ${action.cooldownLeft}s</span>`
                  : `<button class="small-btn" data-action="${action.id}" data-action-target="${action.requiresTarget ? '1' : '0'}" data-action-target-mode="${action.targetMode ?? ''}">执行</button>`
                }
              </div>
            </div>`;
          }
          html += '</div>';
        }
      }
      html += '</div>';
    }

    this.pane.innerHTML = html;

    this.pane.querySelectorAll<HTMLElement>('[data-action-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.dataset.actionTab as 'dialogue' | 'skill' | 'toggle' | undefined;
        if (!tab) return;
        this.activeTab = tab;
        this.render(actions);
      });
    });
    this.pane.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const actionId = (btn as HTMLElement).dataset.action!;
        const requiresTarget = (btn as HTMLElement).dataset.actionTarget === '1';
        const targetMode = (btn as HTMLElement).dataset.actionTargetMode || undefined;
        this.onAction?.(actionId, requiresTarget, targetMode);
      });
    });
  }
}

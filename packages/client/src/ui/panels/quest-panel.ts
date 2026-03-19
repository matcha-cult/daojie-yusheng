import { PlayerState, QuestState } from '@mud/shared';

const STATUS_TEXT: Record<QuestState['status'], string> = {
  available: '可接取',
  active: '进行中',
  ready: '可交付',
  completed: '已完成',
};

const STATUS_CLASS: Record<QuestState['status'], string> = {
  available: 'status-available',
  active: 'status-active',
  ready: 'status-ready',
  completed: 'status-completed',
};

/** 任务面板：显示当前任务进度与奖励信息 */
export class QuestPanel {
  private pane = document.getElementById('pane-quest')!;

  update(quests: QuestState[]): void {
    this.render(quests);
  }

  initFromPlayer(player: PlayerState): void {
    this.render(player.quests ?? []);
  }

  clear(): void {
    this.pane.innerHTML = '<div class="empty-hint">暂无任务，和 NPC 交互可接取</div>';
  }

  private render(quests: QuestState[]): void {
    if (quests.length === 0) {
      this.pane.innerHTML = '<div class="empty-hint">暂无任务，和 NPC 交互可接取</div>';
      return;
    }

    const priority = { ready: 0, active: 1, available: 2, completed: 3 } as const;
    const sorted = [...quests].sort((a, b) => priority[a.status] - priority[b.status]);

    let html = '<div class="panel-section"><div class="panel-section-title">任务簿</div>';
    for (const quest of sorted) {
      const percent = quest.required > 0 ? Math.min(100, Math.floor((quest.progress / quest.required) * 100)) : 0;
      const nextStep = quest.status === 'ready'
        ? '返回发布者交付任务'
        : quest.status === 'completed'
          ? '任务已结清'
          : `前往击杀 ${quest.targetName}`;
      html += `<div class="quest-card">
        <div class="quest-title-row">
          <span class="quest-title">${quest.title}</span>
          <span class="quest-status ${STATUS_CLASS[quest.status]}">${STATUS_TEXT[quest.status]}</span>
        </div>
        <div class="quest-desc">${quest.desc}</div>
        <div class="quest-progress-label">目标：${quest.targetName} ${quest.progress}/${quest.required}</div>
        <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${percent}%"></div></div>
        <div class="quest-meta">下一步：${nextStep}</div>
        <div class="quest-meta">发布者：${quest.giverName}</div>
        <div class="quest-meta">奖励：${quest.rewardText}</div>
      </div>`;
    }
    html += '</div>';
    this.pane.innerHTML = html;
  }
}

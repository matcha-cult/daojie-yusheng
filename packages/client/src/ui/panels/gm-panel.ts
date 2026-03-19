import { C2S_GmUpdatePlayer, GmPlayerSummary, S2C_GmState } from '@mud/shared';

interface GmCallbacks {
  onRefresh: () => void;
  onResetSelf: () => void;
  onCycleZoom: () => void;
  onSpawnBots: (count: number) => void;
  onRemoveBots: (playerIds?: string[], all?: boolean) => void;
  onUpdatePlayer: (payload: C2S_GmUpdatePlayer) => void;
  onResetPlayer: (playerId: string) => void;
}

export class GmPanel {
  private pane = document.getElementById('pane-gm')!;
  private state: S2C_GmState = { players: [], mapIds: [], botCount: 0, perf: { cpuPercent: 0, memoryMb: 0, tickMs: 0 } };
  private selectedPlayerId: string | null = null;
  private callbacks: GmCallbacks | null = null;

  setCallbacks(callbacks: GmCallbacks): void {
    this.callbacks = callbacks;
  }

  update(state: S2C_GmState): void {
    this.state = state;
    if (!this.selectedPlayerId || !state.players.some((player) => player.id === this.selectedPlayerId)) {
      this.selectedPlayerId = state.players[0]?.id ?? null;
    }
    this.render();
  }

  clear(): void {
    this.state = { players: [], mapIds: [], botCount: 0, perf: { cpuPercent: 0, memoryMb: 0, tickMs: 0 } };
    this.selectedPlayerId = null;
    this.pane.innerHTML = '<div class="empty-hint">暂无 GM 数据</div>';
  }

  private render(): void {
    const selected = this.state.players.find((player) => player.id === this.selectedPlayerId) ?? null;
    const playerList = this.state.players.length === 0
      ? '<div class="empty-hint">当前没有在线玩家</div>'
      : this.state.players.map((player) => `
        <button class="gm-player-row ${player.id === this.selectedPlayerId ? 'active' : ''}" data-gm-select="${player.id}">
          <div>
            <div class="gm-player-name">${player.name}</div>
            <div class="gm-player-meta">${player.isBot ? '机器人' : '真人'} · ${player.mapId} · (${player.x}, ${player.y})</div>
          </div>
          <div class="gm-player-stat">${player.hp}/${player.maxHp}</div>
        </button>
      `).join('');

    const detail = !selected
      ? '<div class="empty-hint">请选择一名玩家</div>'
      : `
        <div class="panel-section">
          <div class="panel-section-title">玩家编辑</div>
          <div class="gm-form-grid">
            <label class="gm-field">
              <span>地图</span>
              <select id="gm-map">
                ${this.state.mapIds.map((mapId) => `<option value="${mapId}" ${mapId === selected.mapId ? 'selected' : ''}>${mapId}</option>`).join('')}
              </select>
            </label>
            <label class="gm-field">
              <span>X</span>
              <input id="gm-x" type="number" value="${selected.x}" />
            </label>
            <label class="gm-field">
              <span>Y</span>
              <input id="gm-y" type="number" value="${selected.y}" />
            </label>
            <label class="gm-field">
              <span>HP</span>
              <input id="gm-hp" type="number" min="0" max="${selected.maxHp}" value="${selected.hp}" />
            </label>
          </div>
          <label class="gm-checkbox">
            <input id="gm-auto-battle" type="checkbox" ${selected.autoBattle ? 'checked' : ''} ${selected.dead ? 'disabled' : ''} />
            <span>自动战斗</span>
          </label>
          <div class="gm-btn-row">
            <button class="small-btn" data-gm-save="${selected.id}">保存</button>
            <button class="small-btn" data-gm-heal="${selected.id}">满血</button>
            <button class="small-btn" data-gm-reset="${selected.id}">回出生点</button>
            ${selected.isBot ? `<button class="small-btn danger" data-gm-remove="${selected.id}">移除机器人</button>` : ''}
          </div>
        </div>
      `;

    this.pane.innerHTML = `
      <div class="panel-section">
        <div class="panel-section-title">服务端性能</div>
        <div class="panel-row"><span class="panel-label">CPU 压力</span><span class="panel-value">${this.state.perf.cpuPercent}%</span></div>
        <div class="panel-row"><span class="panel-label">内存占用</span><span class="panel-value">${this.state.perf.memoryMb} MB</span></div>
        <div class="panel-row"><span class="panel-label">Tick 耗时</span><span class="panel-value">${this.state.perf.tickMs} ms</span></div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">GM 概览</div>
        <div class="panel-row"><span class="panel-label">在线玩家</span><span class="panel-value">${this.state.players.length}</span></div>
        <div class="panel-row"><span class="panel-label">机器人</span><span class="panel-value">${this.state.botCount}</span></div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">调试</div>
        <div class="gm-btn-row">
          <button class="small-btn" id="gm-reset-self">自己回出生点</button>
          <button class="small-btn" id="gm-refresh">刷新</button>
          <button class="small-btn" id="gm-cycle-zoom">缩放</button>
        </div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">机器人控制</div>
        <div class="gm-btn-row">
          <input id="gm-bot-count" class="gm-inline-input" type="number" min="1" max="50" value="5" />
          <button class="small-btn" id="gm-spawn-bots">生成</button>
          <button class="small-btn danger" id="gm-remove-all-bots">移除全部</button>
        </div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">在线列表</div>
        <div class="gm-player-list">${playerList}</div>
      </div>
      ${detail}
    `;

    this.bindEvents(selected);
  }

  private bindEvents(selected: GmPlayerSummary | null): void {
    this.pane.querySelectorAll<HTMLElement>('[data-gm-select]').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedPlayerId = button.dataset.gmSelect ?? null;
        this.render();
      });
    });

    document.getElementById('gm-refresh')?.addEventListener('click', () => {
      this.callbacks?.onRefresh();
    });
    document.getElementById('gm-reset-self')?.addEventListener('click', () => {
      this.callbacks?.onResetSelf();
    });
    document.getElementById('gm-cycle-zoom')?.addEventListener('click', () => {
      this.callbacks?.onCycleZoom();
    });
    document.getElementById('gm-spawn-bots')?.addEventListener('click', () => {
      const count = Number((document.getElementById('gm-bot-count') as HTMLInputElement | null)?.value ?? '0');
      this.callbacks?.onSpawnBots(count);
    });
    document.getElementById('gm-remove-all-bots')?.addEventListener('click', () => {
      this.callbacks?.onRemoveBots(undefined, true);
    });

    if (!selected) return;

    this.pane.querySelector<HTMLElement>(`[data-gm-heal="${selected.id}"]`)?.addEventListener('click', () => {
      this.callbacks?.onUpdatePlayer({
        playerId: selected.id,
        mapId: selected.mapId,
        x: selected.x,
        y: selected.y,
        hp: selected.maxHp,
        autoBattle: false,
      });
    });

    this.pane.querySelector<HTMLElement>(`[data-gm-reset="${selected.id}"]`)?.addEventListener('click', () => {
      this.callbacks?.onResetPlayer(selected.id);
    });

    this.pane.querySelector<HTMLElement>(`[data-gm-remove="${selected.id}"]`)?.addEventListener('click', () => {
      this.callbacks?.onRemoveBots([selected.id], false);
    });

    this.pane.querySelector<HTMLElement>(`[data-gm-save="${selected.id}"]`)?.addEventListener('click', () => {
      const mapId = (document.getElementById('gm-map') as HTMLSelectElement | null)?.value ?? selected.mapId;
      const x = Number((document.getElementById('gm-x') as HTMLInputElement | null)?.value ?? selected.x);
      const y = Number((document.getElementById('gm-y') as HTMLInputElement | null)?.value ?? selected.y);
      const hp = Number((document.getElementById('gm-hp') as HTMLInputElement | null)?.value ?? selected.hp);
      const autoBattle = Boolean((document.getElementById('gm-auto-battle') as HTMLInputElement | null)?.checked);
      this.callbacks?.onUpdatePlayer({
        playerId: selected.id,
        mapId,
        x,
        y,
        hp,
        autoBattle,
      });
    });
  }
}

import { Inventory, PlayerState } from '@mud/shared';

const ITEM_TYPE_LABELS: Record<string, string> = {
  consumable: '消耗品',
  equipment: '装备',
  material: '材料',
  quest_item: '任务物',
  skill_book: '功法书',
};

/** 背包面板：显示物品列表，支持使用和丢弃 */
export class InventoryPanel {
  private pane = document.getElementById('pane-inventory')!;
  private onUseItem: ((slotIndex: number) => void) | null = null;
  private onDropItem: ((slotIndex: number, count: number) => void) | null = null;
  private onEquipItem: ((slotIndex: number) => void) | null = null;

  clear(): void {
    this.pane.innerHTML = '<div class="empty-hint">背包空空如也</div>';
  }

  setCallbacks(
    onUse: (slotIndex: number) => void,
    onDrop: (slotIndex: number, count: number) => void,
    onEquip: (slotIndex: number) => void,
  ): void {
    this.onUseItem = onUse;
    this.onDropItem = onDrop;
    this.onEquipItem = onEquip;
  }

  update(inventory: Inventory): void {
    this.render(inventory);
  }

  initFromPlayer(player: PlayerState): void {
    this.render(player.inventory);
  }

  private render(inventory: Inventory): void {
    if (inventory.items.length === 0) {
      this.clear();
      return;
    }

    let html = `<div class="panel-section">
      <div class="panel-section-title">背包 (${inventory.items.length}/${inventory.capacity})</div>`;

    inventory.items.forEach((item, i) => {
      const bonusText = item.equipAttrs
        ? Object.entries(item.equipAttrs).map(([key, value]) => `${key}+${value}`).join(' / ')
        : '';
      html += `<div class="item-slot">
        <div class="item-copy">
          <div class="item-head">
            <span class="item-name">${item.name}</span>
            <span class="item-count">x${item.count}</span>
          </div>
          <div class="item-meta-row">
            <span class="item-type-tag">${ITEM_TYPE_LABELS[item.type] ?? item.type}</span>
            ${item.equipSlot ? `<span class="item-type-tag subtle">${item.equipSlot}</span>` : ''}
          </div>
          <div class="item-desc">${item.desc}</div>
          ${bonusText ? `<div class="item-bonus">${bonusText}</div>` : ''}
        </div>
        <div class="item-actions">
          ${item.type === 'equipment' ? `<button class="small-btn" data-equip="${i}">装备</button>` : `<button class="small-btn" data-use="${i}">使用</button>`}
          <button class="small-btn danger" data-drop="${i}">丢弃</button>
        </div>
      </div>`;
    });

    html += '</div>';
    this.pane.innerHTML = html;

    // 绑定按钮事件
    this.pane.querySelectorAll('[data-use]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.use!);
        this.onUseItem?.(idx);
      });
    });
    this.pane.querySelectorAll('[data-drop]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.drop!);
        this.onDropItem?.(idx, 1);
      });
    });
    this.pane.querySelectorAll('[data-equip]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.equip!);
        this.onEquipItem?.(idx);
      });
    });
  }
}

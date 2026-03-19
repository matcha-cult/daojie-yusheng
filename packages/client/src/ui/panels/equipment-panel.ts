import { EquipmentSlots, EquipSlot, PlayerState } from '@mud/shared';

const SLOT_NAMES: Record<EquipSlot, string> = {
  weapon: '武器',
  head: '头部',
  body: '身体',
  legs: '腿部',
  accessory: '饰品',
};

const SLOT_ORDER: EquipSlot[] = ['weapon', 'head', 'body', 'legs', 'accessory'];

/** 装备面板：显示5个装备槽位 */
export class EquipmentPanel {
  private pane = document.getElementById('pane-equipment')!;
  private onUnequip: ((slot: EquipSlot) => void) | null = null;

  clear(): void {
    this.pane.innerHTML = '<div class="empty-hint">尚未装备任何物品</div>';
  }

  setCallbacks(onUnequip: (slot: EquipSlot) => void): void {
    this.onUnequip = onUnequip;
  }

  update(equipment: EquipmentSlots): void {
    this.render(equipment);
  }

  initFromPlayer(player: PlayerState): void {
    this.render(player.equipment);
  }

  private render(equipment: EquipmentSlots): void {
    let html = '<div class="panel-section">';
    html += '<div class="panel-section-title">装备栏</div>';

    for (const slot of SLOT_ORDER) {
      const item = equipment[slot];
      if (item) {
        const bonusText = item.equipAttrs
          ? Object.entries(item.equipAttrs).map(([key, value]) => `${key}+${value}`).join(' / ')
          : '暂无词条';
        html += `<div class="equip-slot">
          <div class="equip-copy">
            <span class="equip-slot-name">${SLOT_NAMES[slot]}</span>
            <span class="equip-slot-item">${item.name}</span>
            <span class="equip-slot-meta">${bonusText}</span>
          </div>
          <button class="small-btn" data-unequip="${slot}">卸下</button>
        </div>`;
      } else {
        html += `<div class="equip-slot">
          <div class="equip-copy">
            <span class="equip-slot-name">${SLOT_NAMES[slot]}</span>
            <span class="equip-slot-empty">空</span>
            <span class="equip-slot-meta">尚未装备</span>
          </div>
        </div>`;
      }
    }

    html += '</div>';
    this.pane.innerHTML = html;

    this.pane.querySelectorAll('[data-unequip]').forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = (btn as HTMLElement).dataset.unequip as EquipSlot;
        this.onUnequip?.(slot);
      });
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PlayerState, ItemStack } from '@mud/shared';

@Injectable()
export class InventoryService {
  getItem(player: PlayerState, slotIndex: number): ItemStack | null {
    return player.inventory.items[slotIndex] ?? null;
  }

  /** 添加物品到背包，返回是否成功 */
  addItem(player: PlayerState, item: ItemStack): boolean {
    // 尝试堆叠到已有同类物品
    const existing = player.inventory.items.find(
      i => i.itemId === item.itemId && i.type !== 'equipment',
    );
    if (existing) {
      existing.count += item.count;
      return true;
    }
    if (player.inventory.items.length >= player.inventory.capacity) {
      return false;
    }
    player.inventory.items.push({ ...item });
    return true;
  }

  /** 从背包移除物品，返回被移除的物品栈（部分或全部） */
  removeItem(player: PlayerState, slotIndex: number, count: number): ItemStack | null {
    const item = player.inventory.items[slotIndex];
    if (!item || count <= 0) return null;
    const removed = Math.min(count, item.count);
    item.count -= removed;
    const result: ItemStack = { ...item, count: removed };
    if (item.count <= 0) {
      player.inventory.items.splice(slotIndex, 1);
    }
    return result;
  }

  /** 使用物品，返回错误信息或 null */
  useItem(player: PlayerState, slotIndex: number): string | null {
    const item = player.inventory.items[slotIndex];
    if (!item) return '物品不存在';
    if (item.type !== 'consumable' && item.type !== 'skill_book') return '该物品不可使用';
    // 消耗一个
    item.count -= 1;
    if (item.count <= 0) {
      player.inventory.items.splice(slotIndex, 1);
    }
    return null;
  }

  /** 丢弃物品，返回错误信息或 null */
  dropItem(player: PlayerState, slotIndex: number, count: number): string | null {
    if (!this.removeItem(player, slotIndex, count)) {
      return '物品不存在或数量不足';
    }
    return null;
  }

  /** 查找物品在背包中的槽位索引，-1 表示未找到 */
  findItem(player: PlayerState, itemId: string): number {
    return player.inventory.items.findIndex(i => i.itemId === itemId);
  }
}

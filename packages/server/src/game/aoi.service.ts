import { Injectable } from '@nestjs/common';
import { PlayerState, VIEW_RADIUS, VisibleTile } from '@mud/shared';
import { MapService } from './map.service';

export interface VisibilitySnapshot {
  visibleKeys: Set<string>;
  tiles: VisibleTile[][];
}

interface VisibilityCacheEntry {
  key: string;
  visibleKeys: Set<string>;
}

@Injectable()
export class AoiService {
  private readonly visibilityCache = new Map<string, VisibilityCacheEntry>();

  constructor(private readonly mapService: MapService) {}

  /** 判断目标坐标是否在玩家视野内 */
  inView(player: PlayerState, x: number, y: number): boolean {
    return this.getVisibleKeys(player).has(`${x},${y}`);
  }

  /** 获取玩家视野范围 */
  getViewport(player: PlayerState) {
    const range = player.viewRange ?? VIEW_RADIUS;
    return {
      x: player.x - range,
      y: player.y - range,
      width: range * 2 + 1,
      height: range * 2 + 1,
    };
  }

  getVisibility(player: PlayerState): VisibilitySnapshot {
    const range = player.viewRange ?? VIEW_RADIUS;
    const visibleKeys = this.getVisibleKeys(player);
    const tiles = this.mapService.getViewTiles(player.mapId, player.x, player.y, range, visibleKeys);
    return { visibleKeys, tiles };
  }

  getVisibleKeys(player: PlayerState): Set<string> {
    const range = player.viewRange ?? VIEW_RADIUS;
    const cacheKey = this.buildCacheKey(player, range);
    const cached = this.visibilityCache.get(player.id);
    if (cached?.key === cacheKey) {
      return cached.visibleKeys;
    }

    const visibleKeys = new Set<string>();
    const cx = player.x;
    const cy = player.y;
    visibleKeys.add(`${cx},${cy}`);

    const octants: Array<[number, number, number, number]> = [
      [1, 0, 0, 1],
      [0, 1, 1, 0],
      [0, -1, 1, 0],
      [-1, 0, 0, 1],
      [-1, 0, 0, -1],
      [0, -1, -1, 0],
      [0, 1, -1, 0],
      [1, 0, 0, -1],
    ];

    for (const [xx, xy, yx, yy] of octants) {
      this.castLight(player.mapId, cx, cy, 1, 1.0, 0.0, range, xx, xy, yx, yy, visibleKeys);
    }

    this.visibilityCache.set(player.id, { key: cacheKey, visibleKeys });
    return visibleKeys;
  }

  private buildCacheKey(player: PlayerState, range: number): string {
    return [
      player.mapId,
      this.mapService.getMapRevision(player.mapId),
      player.x,
      player.y,
      range,
    ].join(':');
  }

  private castLight(
    mapId: string,
    cx: number,
    cy: number,
    row: number,
    startSlope: number,
    endSlope: number,
    radius: number,
    xx: number,
    xy: number,
    yx: number,
    yy: number,
    visibleKeys: Set<string>,
  ) {
    if (startSlope < endSlope) return;

    let nextStartSlope = startSlope;
    for (let distance = row; distance <= radius; distance++) {
      let blocked = false;

      for (let deltaX = -distance, deltaY = -distance; deltaX <= 0; deltaX++) {
        const currentX = cx + deltaX * xx + deltaY * xy;
        const currentY = cy + deltaX * yx + deltaY * yy;
        const leftSlope = (deltaX - 0.5) / (deltaY + 0.5);
        const rightSlope = (deltaX + 0.5) / (deltaY - 0.5);

        if (startSlope < rightSlope) continue;
        if (endSlope > leftSlope) break;

        const distanceSq = deltaX * deltaX + deltaY * deltaY;
        if (distanceSq <= radius * radius) {
          visibleKeys.add(`${currentX},${currentY}`);
        }

        const blocksSight = this.mapService.blocksSight(mapId, currentX, currentY);
        if (blocked) {
          if (blocksSight) {
            nextStartSlope = rightSlope;
            continue;
          }
          blocked = false;
          startSlope = nextStartSlope;
          continue;
        }

        if (blocksSight && distance < radius) {
          blocked = true;
          this.castLight(mapId, cx, cy, distance + 1, startSlope, leftSlope, radius, xx, xy, yx, yy, visibleKeys);
          nextStartSlope = rightSlope;
        }
      }

      if (blocked) break;
    }
  }
}

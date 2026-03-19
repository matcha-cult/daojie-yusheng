import { Injectable } from '@nestjs/common';
import {
  C2S_GmUpdatePlayer,
  GmPlayerSummary,
  S2C_GmState,
} from '@mud/shared';
import { BotService } from './bot.service';
import { MapService } from './map.service';
import { NavigationService } from './navigation.service';
import { PerformanceService } from './performance.service';
import { DirtyFlag, PlayerService } from './player.service';
import { WorldService } from './world.service';

@Injectable()
export class GmService {
  constructor(
    private readonly botService: BotService,
    private readonly playerService: PlayerService,
    private readonly mapService: MapService,
    private readonly navigationService: NavigationService,
    private readonly performanceService: PerformanceService,
    private readonly worldService: WorldService,
  ) {}

  getState(): S2C_GmState {
    const players = this.playerService.getAllPlayers()
      .map<GmPlayerSummary>((player) => ({
        id: player.id,
        name: player.name,
        mapId: player.mapId,
        x: player.x,
        y: player.y,
        hp: player.hp,
        maxHp: player.maxHp,
        dead: player.dead,
        autoBattle: player.autoBattle,
        isBot: Boolean(player.isBot),
      }))
      .sort((left, right) => {
        if (left.isBot !== right.isBot) return left.isBot ? 1 : -1;
        if (left.mapId !== right.mapId) return left.mapId.localeCompare(right.mapId);
        return left.name.localeCompare(right.name, 'zh-CN');
      });

    return {
      players,
      mapIds: this.mapService.getAllMapIds().sort(),
      botCount: this.botService.getBotCount(),
      perf: this.performanceService.getSnapshot(),
    };
  }

  spawnBots(requesterId: string, count: number): string | null {
    const requester = this.playerService.getPlayer(requesterId);
    if (!requester) return '角色不存在';
    const created = this.botService.spawnBots(requester, count);
    if (created <= 0) return '附近没有可用于生成机器人的空位';
    return null;
  }

  removeBots(playerIds?: string[], removeAll = false): string | null {
    const removed = this.botService.removeBots(removeAll ? undefined : playerIds);
    if (removed <= 0) return '没有可移除的机器人';
    return null;
  }

  updatePlayer(data: C2S_GmUpdatePlayer): string | null {
    const player = this.playerService.getPlayer(data.playerId);
    if (!player) return '目标玩家不存在';
    const targetMap = this.mapService.getMapMeta(data.mapId);
    if (!targetMap) return '目标地图不存在';
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y) || !Number.isFinite(data.hp)) {
      return '玩家数据非法';
    }

    const x = Math.floor(data.x);
    const y = Math.floor(data.y);
    const hp = Math.max(0, Math.min(player.maxHp, Math.floor(data.hp)));

    if (!this.canOccupy(data.mapId, x, y, player.id)) {
      return '目标坐标不可站立或已被占用';
    }

    this.navigationService.clearMoveTarget(player.id);
    if (player.mapId !== data.mapId || player.x !== x || player.y !== y) {
      this.mapService.setOccupied(player.mapId, player.x, player.y, null);
      player.mapId = data.mapId;
      player.x = x;
      player.y = y;
      this.mapService.setOccupied(player.mapId, player.x, player.y, player.id);
    }

    player.hp = hp;
    player.dead = hp <= 0;
    player.autoBattle = !player.dead && data.autoBattle;
    if (player.dead || player.autoBattle) {
      this.navigationService.clearMoveTarget(player.id);
    }

    this.playerService.markDirty(player.id, 'actions');
    return null;
  }

  resetPlayer(playerId: string): string | null {
    const player = this.playerService.getPlayer(playerId);
    if (!player) return '目标玩家不存在';
    const update = this.worldService.resetPlayerToSpawn(player);
    for (const flag of update.dirty) {
      this.playerService.markDirty(player.id, flag as DirtyFlag);
    }
    return null;
  }

  private canOccupy(mapId: string, x: number, y: number, playerId: string): boolean {
    const tile = this.mapService.getTile(mapId, x, y);
    if (!tile?.walkable) return false;
    return tile.occupiedBy === null || tile.occupiedBy === playerId;
  }
}

/**
 * GM 管理 HTTP 接口：玩家管理、地图编辑、Bot 控制、建议反馈
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  GmMapDetailRes,
  GmMapListRes,
  GmPlayerDetailRes,
  GmRemoveBotsReq,
  GmSpawnBotsReq,
  GmStateRes,
  GmUpdateMapReq,
  GmUpdatePlayerReq,
  Suggestion,
} from '@mud/shared';
import { GmAuthGuard } from './gm-auth.guard';
import { GmService } from './gm.service';
import { SuggestionService } from './suggestion.service';

@Controller('gm')
@UseGuards(GmAuthGuard)
export class GmController {
  constructor(
    private readonly gmService: GmService,
    private readonly suggestionService: SuggestionService,
  ) {}

  /** 获取全局 GM 状态 */
  @Get('state')
  getState(): Promise<GmStateRes> {
    return this.gmService.getState();
  }

  /** 获取所有玩家建议 */
  @Get('suggestions')
  getSuggestions(): Suggestion[] {
    return this.suggestionService.getAll();
  }

  @Post('suggestions/:id/complete')
  async completeSuggestion(@Param('id') id: string): Promise<{ ok: true }> {
    await this.suggestionService.markCompleted(id);
    return { ok: true };
  }

  @Delete('suggestions/:id')
  async removeSuggestion(@Param('id') id: string): Promise<{ ok: true }> {
    await this.suggestionService.remove(id);
    return { ok: true };
  }

  /** 获取单个玩家详情 */
  @Get('players/:playerId')
  async getPlayer(@Param('playerId') playerId: string): Promise<GmPlayerDetailRes> {
    const player = await this.gmService.getPlayerDetail(playerId);
    if (!player) {
      throw new BadRequestException('目标玩家不存在');
    }
    return { player };
  }

  @Get('maps')
  getMaps(): GmMapListRes {
    return this.gmService.getEditableMapList();
  }

  @Get('maps/:mapId')
  getMap(@Param('mapId') mapId: string): GmMapDetailRes {
    const map = this.gmService.getEditableMap(mapId);
    if (!map) {
      throw new BadRequestException('目标地图不存在');
    }
    return { map };
  }

  /** 保存地图编辑 */
  @Put('maps/:mapId')
  async updateMap(
    @Param('mapId') mapId: string,
    @Body() body: GmUpdateMapReq,
  ): Promise<{ ok: true }> {
    if (!body?.map) {
      throw new BadRequestException('缺少地图数据');
    }
    const error = await this.gmService.saveEditableMap(mapId, body.map);
    if (error) {
      throw new BadRequestException(error);
    }
    return { ok: true };
  }

  /** 更新玩家状态 */
  @Put('players/:playerId')
  async updatePlayer(
    @Param('playerId') playerId: string,
    @Body() body: GmUpdatePlayerReq,
  ): Promise<{ ok: true }> {
    if (!body?.snapshot) {
      throw new BadRequestException('缺少玩家快照');
    }
    const error = await this.gmService.enqueuePlayerUpdate(playerId, body.snapshot);
    if (error) {
      throw new BadRequestException(error);
    }
    return { ok: true };
  }

  /** 重置玩家到出生点 */
  @Post('players/:playerId/reset')
  async resetPlayer(@Param('playerId') playerId: string): Promise<{ ok: true }> {
    const error = await this.gmService.enqueueResetPlayer(playerId);
    if (error) {
      throw new BadRequestException(error);
    }
    return { ok: true };
  }

  /** 生成 Bot */
  @Post('bots/spawn')
  async spawnBots(@Body() body: GmSpawnBotsReq): Promise<{ ok: true }> {
    const error = await this.gmService.enqueueSpawnBots(body.anchorPlayerId, body.count);
    if (error) {
      throw new BadRequestException(error);
    }
    return { ok: true };
  }

  /** 移除 Bot */
  @Post('bots/remove')
  removeBots(@Body() body: GmRemoveBotsReq): { ok: true } {
    const error = this.gmService.enqueueRemoveBots(body?.playerIds, body?.all);
    if (error) {
      throw new BadRequestException(error);
    }
    return { ok: true };
  }
}

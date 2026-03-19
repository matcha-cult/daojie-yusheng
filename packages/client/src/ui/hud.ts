import { PlayerState } from '@mud/shared';

interface HUDMeta {
  mapName?: string;
  mapDanger?: string;
  realmLabel?: string;
  objectiveLabel?: string;
  threatLabel?: string;
  titleLabel?: string;
}

export class HUD {
  private nameDiv = document.getElementById('hud-name')!;
  private titleDiv = document.getElementById('hud-title')!;
  private posDiv = document.getElementById('hud-pos')!;
  private hpDiv = document.getElementById('hud-hp')!;
  private hpBar = document.getElementById('hud-hp-bar')!;
  private qiDiv = document.getElementById('hud-qi')!;
  private staminaDiv = document.getElementById('hud-stamina')!;
  private mapDiv = document.getElementById('hud-map')!;
  private tickDiv = document.getElementById('hud-tick')!;
  private cultivateDiv = document.getElementById('hud-cultivate')!;
  private autoBattleDiv = document.getElementById('hud-auto-battle')!;
  private realmDiv = document.getElementById('hud-realm')!;
  private objectiveDiv = document.getElementById('hud-objective')!;
  private threatDiv = document.getElementById('hud-threat')!;

  update(player: PlayerState, meta?: HUDMeta) {
    const spiritValue = this.computeFinalAttr(player, 'spirit');
    const constitutionValue = this.computeFinalAttr(player, 'constitution');
    this.nameDiv.textContent = player.name;
    this.titleDiv.textContent = meta?.titleLabel ?? '无号散修';
    this.posDiv.textContent = `(${player.x}, ${player.y})`;
    this.hpDiv.textContent = `${player.hp}/${player.maxHp}`;
    this.hpBar.style.width = `${Math.max(0, Math.min(100, Math.round((player.hp / Math.max(player.maxHp, 1)) * 100)))}%`;
    this.qiDiv.textContent = `${spiritValue}`;
    this.staminaDiv.textContent = `${constitutionValue}`;
    this.mapDiv.textContent = meta?.mapDanger ? `${meta.mapName ?? player.mapId} · ${meta.mapDanger}` : (meta?.mapName ?? player.mapId);

    if (player.cultivatingTechId && player.techniques) {
      const tech = player.techniques.find(t => t.techId === player.cultivatingTechId);
      this.cultivateDiv.textContent = tech ? tech.name : '-';
    } else {
      this.cultivateDiv.textContent = '-';
    }
    this.autoBattleDiv.textContent = player.autoBattle ? '开启' : '关闭';
    this.realmDiv.textContent = meta?.realmLabel ?? player.realmName ?? player.realmStage ?? '-';
    this.objectiveDiv.textContent = meta?.objectiveLabel ?? '暂无';
    this.threatDiv.textContent = meta?.threatLabel ?? '平稳';
  }

  updateTick(dt: number) {
    if (this.tickDiv) {
      this.tickDiv.textContent = `${dt}ms`;
    }
  }

  private computeFinalAttr(player: PlayerState, key: 'spirit' | 'constitution'): number {
    return player.bonuses.reduce((value, bonus) => value + (bonus.attrs[key] ?? 0), player.baseAttrs[key]);
  }
}

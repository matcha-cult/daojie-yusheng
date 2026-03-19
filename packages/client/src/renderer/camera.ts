import { PlayerState } from '@mud/shared';
import { getCellSize } from '../display';
/** lerp 速度因子，越大越快 */
const SMOOTH_SPEED = 8;
/** 检测到偏移后延迟多久开始移动（秒） */
const CAMERA_DELAY = 1.0;

export class Camera {
  x = 0;
  y = 0;
  private targetX = 0;
  private targetY = 0;
  private divergeTime: number | null = null;

  follow(player: PlayerState) {
    const cellSize = getCellSize();
    this.targetX = (player.x + 0.5) * cellSize;
    this.targetY = (player.y + 0.5) * cellSize;
  }

  update(dt: number) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.1) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.divergeTime = null;
      return;
    }

    if (this.divergeTime === null) {
      this.divergeTime = performance.now();
    }

    const elapsed = (performance.now() - this.divergeTime) / 1000;
    if (elapsed < CAMERA_DELAY) return;

    const t = 1 - Math.exp(-SMOOTH_SPEED * dt);
    this.x += dx * t;
    this.y += dy * t;
    if (Math.abs(this.x - this.targetX) < 0.1) this.x = this.targetX;
    if (Math.abs(this.y - this.targetY) < 0.1) this.y = this.targetY;
  }

  snap(player: PlayerState) {
    const cellSize = getCellSize();
    this.targetX = (player.x + 0.5) * cellSize;
    this.targetY = (player.y + 0.5) * cellSize;
    this.x = this.targetX;
    this.y = this.targetY;
    this.divergeTime = null;
  }

  worldToScreen(wx: number, wy: number, screenW: number, screenH: number): { sx: number; sy: number } {
    return {
      sx: wx - this.x + screenW / 2,
      sy: wy - this.y + screenH / 2,
    };
  }
}

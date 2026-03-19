import { Tile } from '@mud/shared';
import { Camera } from './camera';

export interface IRenderer {
  init(canvas: HTMLCanvasElement): void;
  clear(): void;
  renderWorld(camera: Camera, tileCache: Map<string, Tile>, visibleTiles: Set<string>, playerX: number, playerY: number): void;
  updateEntities(list: { id: string; wx: number; wy: number; char: string; color: string; name?: string; kind?: string; hp?: number; maxHp?: number }[], movedId?: string, shiftX?: number, shiftY?: number): void;
  renderEntities(camera: Camera, progress?: number): void;
  addFloatingText(x: number, y: number, text: string, color?: string): void;
  addAttackTrail(fromX: number, fromY: number, toX: number, toY: number, color?: string): void;
  renderFloatingTexts(camera: Camera): void;
  renderAttackTrails(camera: Camera): void;
  destroy(): void;
}

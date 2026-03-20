import type { GridPoint } from './targeting';

export function encodeTileTargetRef(point: GridPoint): string {
  return `tile:${point.x}:${point.y}`;
}

export function isTileTargetRef(targetRef: string): boolean {
  return targetRef.startsWith('tile:');
}

export function parseTileTargetRef(targetRef: string): GridPoint | null {
  if (!isTileTargetRef(targetRef)) {
    return null;
  }
  const [, sx, sy] = targetRef.split(':');
  const x = Number(sx);
  const y = Number(sy);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

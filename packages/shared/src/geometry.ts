import type { GridPoint } from './targeting';

export function distanceSquared(from: GridPoint, to: GridPoint): number {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  return dx * dx + dy * dy;
}

export function isPointInRange(origin: GridPoint, target: GridPoint, range: number): boolean {
  return distanceSquared(origin, target) <= range * range;
}

export function manhattanDistance(from: GridPoint, to: GridPoint): number {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

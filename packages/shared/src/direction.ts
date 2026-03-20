import { Direction } from './types';

export interface DirectionStep {
  direction: Direction;
  dx: number;
  dy: number;
}

export const CARDINAL_DIRECTION_STEPS: DirectionStep[] = [
  { direction: Direction.North, dx: 0, dy: -1 },
  { direction: Direction.South, dx: 0, dy: 1 },
  { direction: Direction.East, dx: 1, dy: 0 },
  { direction: Direction.West, dx: -1, dy: 0 },
];

export function directionToDelta(direction: Direction): [number, number] {
  const step = CARDINAL_DIRECTION_STEPS.find((entry) => entry.direction === direction);
  return step ? [step.dx, step.dy] : [0, 0];
}

export function deltaToDirection(dx: number, dy: number): Direction | null {
  const step = CARDINAL_DIRECTION_STEPS.find((entry) => entry.dx === dx && entry.dy === dy);
  return step?.direction ?? null;
}

export function directionFromTo(fromX: number, fromY: number, toX: number, toY: number): Direction {
  if (toX > fromX) return Direction.East;
  if (toX < fromX) return Direction.West;
  if (toY > fromY) return Direction.South;
  return Direction.North;
}

import { Injectable } from '@nestjs/common';
import { Direction, PlayerState } from '@mud/shared';
import { AttrService } from './attr.service';
import { MapService } from './map.service';

interface PathStep {
  x: number;
  y: number;
}

interface MoveTargetState {
  targetX: number;
  targetY: number;
  path: PathStep[];
  blockedTicks: number;
}

interface HeapNode {
  index: number;
  score: number;
}

export interface NavigationStepResult {
  moved: boolean;
  reached: boolean;
  blocked: boolean;
  error?: string;
}

const MIN_STEP_COST = 1;

class MinHeap {
  private items: HeapNode[] = [];

  push(node: HeapNode) {
    this.items.push(node);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): HeapNode | undefined {
    if (this.items.length === 0) return undefined;
    const head = this.items[0];
    const tail = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = tail;
      this.bubbleDown(0);
    }
    return head;
  }

  get size(): number {
    return this.items.length;
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].score <= this.items[index].score) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number) {
    const last = this.items.length - 1;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;

      if (left <= last && this.items[left].score < this.items[smallest].score) {
        smallest = left;
      }
      if (right <= last && this.items[right].score < this.items[smallest].score) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.items[smallest], this.items[index]] = [this.items[index], this.items[smallest]];
      index = smallest;
    }
  }
}

@Injectable()
export class NavigationService {
  private readonly moveTargets = new Map<string, MoveTargetState>();

  constructor(
    private readonly mapService: MapService,
    private readonly attrService: AttrService,
  ) {}

  clearMoveTarget(playerId: string) {
    this.moveTargets.delete(playerId);
  }

  hasMoveTarget(playerId: string): boolean {
    return this.moveTargets.has(playerId);
  }

  getPathPoints(playerId: string): Array<[number, number]> {
    const state = this.moveTargets.get(playerId);
    if (!state) return [];
    return state.path.map((step) => [step.x, step.y]);
  }

  setMoveTarget(player: PlayerState, x: number, y: number): string | null {
    if ((player.x !== x || player.y !== y) && !this.mapService.canOccupy(player.mapId, x, y, player.id)) {
      this.clearMoveTarget(player.id);
      return '无法到达该位置';
    }

    const path = this.findPath(player.mapId, player.x, player.y, x, y, player.id);
    if (path === null) {
      this.clearMoveTarget(player.id);
      return '无法到达该位置';
    }

    if (path.length === 0) {
      this.clearMoveTarget(player.id);
      return null;
    }

    this.moveTargets.set(player.id, {
      targetX: x,
      targetY: y,
      path,
      blockedTicks: 0,
    });
    return null;
  }

  stepPlayerTowardTarget(player: PlayerState): NavigationStepResult {
    const state = this.moveTargets.get(player.id);
    if (!state) {
      return { moved: false, reached: false, blocked: false };
    }

    if (player.x === state.targetX && player.y === state.targetY) {
      this.clearMoveTarget(player.id);
      return { moved: false, reached: true, blocked: false };
    }

    if (!this.syncPath(player, state)) {
      this.clearMoveTarget(player.id);
      return { moved: false, reached: false, blocked: false, error: '无法到达该位置' };
    }

    const next = state.path[0];
    if (!next) {
      this.clearMoveTarget(player.id);
      return { moved: false, reached: true, blocked: false };
    }

    if (this.tryMoveAlongPath(player, state)) {
      const reached = player.x === state.targetX && player.y === state.targetY;
      if (reached) {
        this.clearMoveTarget(player.id);
      }
      return { moved: true, reached, blocked: false };
    }

    state.blockedTicks += 1;
    if (this.rebuildPath(player, state)) {
      const alternate = state.path[0];
      if (alternate && this.tryMoveAlongPath(player, state)) {
        const reached = player.x === state.targetX && player.y === state.targetY;
        if (reached) {
          this.clearMoveTarget(player.id);
        }
        return { moved: true, reached, blocked: false };
      }
    }

    return { moved: false, reached: false, blocked: true };
  }

  stepPlayerByDirection(player: PlayerState, direction: Direction): boolean {
    const [dx, dy] = this.deltaFor(direction);
    player.facing = direction;
    let moved = this.tryMovePlayer(player, player.x + dx, player.y + dy);
    if (!moved) return false;
    const extraSteps = this.computeExtraMoveSteps(player);
    for (let index = 0; index < extraSteps; index++) {
      if (!this.tryMovePlayer(player, player.x + dx, player.y + dy)) {
        break;
      }
      moved = true;
    }
    return moved;
  }

  private syncPath(player: PlayerState, state: MoveTargetState): boolean {
    const next = state.path[0];
    if (!next) {
      return this.rebuildPath(player, state);
    }
    if (Math.abs(next.x - player.x) + Math.abs(next.y - player.y) !== 1) {
      return this.rebuildPath(player, state);
    }
    return true;
  }

  private rebuildPath(player: PlayerState, state: MoveTargetState): boolean {
    const path = this.findPath(player.mapId, player.x, player.y, state.targetX, state.targetY, player.id);
    if (path === null) return false;
    state.path = path;
    return true;
  }

  private tryMovePlayer(player: PlayerState, x: number, y: number): boolean {
    if (!this.mapService.canOccupy(player.mapId, x, y, player.id)) return false;
    this.mapService.setOccupied(player.mapId, player.x, player.y, null);
    player.facing = this.directionFromTo(player.x, player.y, x, y);
    player.x = x;
    player.y = y;
    this.mapService.setOccupied(player.mapId, player.x, player.y, player.id);
    return true;
  }

  private tryMoveAlongPath(player: PlayerState, state: MoveTargetState): boolean {
    let moved = false;
    const maxSteps = 1 + this.computeExtraMoveSteps(player);
    for (let index = 0; index < maxSteps; index++) {
      const next = state.path[0];
      if (!next) break;
      if (!this.tryMovePlayer(player, next.x, next.y)) {
        break;
      }
      state.path.shift();
      state.blockedTicks = 0;
      moved = true;
      if (player.x === state.targetX && player.y === state.targetY) {
        break;
      }
    }
    return moved;
  }

  private computeExtraMoveSteps(player: PlayerState): number {
    const numericStats = this.attrService.getPlayerNumericStats(player);
    const moveSpeed = Math.max(0, numericStats.moveSpeed);
    const guaranteed = Math.floor(moveSpeed / 100);
    const remainder = moveSpeed - guaranteed * 100;
    if (remainder <= 0) {
      return guaranteed;
    }
    return guaranteed + (Math.random() * 100 < remainder ? 1 : 0);
  }

  private directionFromTo(fromX: number, fromY: number, toX: number, toY: number): Direction {
    if (toX > fromX) return Direction.East;
    if (toX < fromX) return Direction.West;
    if (toY > fromY) return Direction.South;
    return Direction.North;
  }

  private deltaFor(direction: Direction): [number, number] {
    switch (direction) {
      case Direction.North:
        return [0, -1];
      case Direction.South:
        return [0, 1];
      case Direction.East:
        return [1, 0];
      case Direction.West:
        return [-1, 0];
    }
  }

  private findPath(
    mapId: string,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    selfOccupancyId: string,
  ): PathStep[] | null {
    const meta = this.mapService.getMapMeta(mapId);
    if (!meta) return null;
    if (startX === targetX && startY === targetY) return [];
    if (!this.mapService.isTerrainWalkable(mapId, targetX, targetY)) return null;

    const width = meta.width;
    const height = meta.height;
    const total = width * height;
    const startIndex = this.toIndex(startX, startY, width);
    const goalIndex = this.toIndex(targetX, targetY, width);
    const gScore = new Float64Array(total);
    gScore.fill(Number.POSITIVE_INFINITY);
    const parent = new Int32Array(total);
    parent.fill(-1);
    const closed = new Uint8Array(total);
    const heap = new MinHeap();

    gScore[startIndex] = 0;
    heap.push({ index: startIndex, score: this.heuristic(startX, startY, targetX, targetY) });

    while (heap.size > 0) {
      const current = heap.pop();
      if (!current) break;
      if (closed[current.index]) continue;
      closed[current.index] = 1;

      if (current.index === goalIndex) {
        return this.reconstructPath(parent, goalIndex, startIndex, width);
      }

      const x = current.index % width;
      const y = Math.floor(current.index / width);
      const neighbors: Array<[number, number]> = [
        [x, y - 1],
        [x, y + 1],
        [x + 1, y],
        [x - 1, y],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (!this.mapService.isTerrainWalkable(mapId, nx, ny)) continue;

        const nextIndex = this.toIndex(nx, ny, width);
        if (closed[nextIndex]) continue;

        const stepCost = this.mapService.getTraversalCost(mapId, nx, ny) + this.occupancyPenalty(mapId, nx, ny, selfOccupancyId);
        if (!Number.isFinite(stepCost)) continue;
        const nextScore = gScore[current.index] + stepCost;
        if (nextScore >= gScore[nextIndex]) continue;

        gScore[nextIndex] = nextScore;
        parent[nextIndex] = current.index;
        heap.push({
          index: nextIndex,
          score: nextScore + this.heuristic(nx, ny, targetX, targetY),
        });
      }
    }

    return null;
  }

  private heuristic(x: number, y: number, targetX: number, targetY: number): number {
    return (Math.abs(targetX - x) + Math.abs(targetY - y)) * MIN_STEP_COST;
  }

  private occupancyPenalty(
    mapId: string,
    x: number,
    y: number,
    selfOccupancyId: string,
  ): number {
    if (this.mapService.canOccupy(mapId, x, y, selfOccupancyId)) return 0;
    return Number.POSITIVE_INFINITY;
  }

  private reconstructPath(parent: Int32Array, goalIndex: number, startIndex: number, width: number): PathStep[] {
    const path: PathStep[] = [];
    let current = goalIndex;
    while (current !== startIndex && current !== -1) {
      path.push({
        x: current % width,
        y: Math.floor(current / width),
      });
      current = parent[current];
    }
    path.reverse();
    return path;
  }

  private toIndex(x: number, y: number, width: number): number {
    return y * width + x;
  }
}

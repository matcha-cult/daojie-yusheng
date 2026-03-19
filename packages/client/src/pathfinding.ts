import { Tile, Direction } from '@mud/shared';

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

const DIRS: { d: Direction; dx: number; dy: number }[] = [
  { d: Direction.North, dx: 0, dy: -1 },
  { d: Direction.South, dx: 0, dy: 1 },
  { d: Direction.East, dx: 1, dy: 0 },
  { d: Direction.West, dx: -1, dy: 0 },
];

/** A* 寻路，返回 Direction[] 路径；不可达返回 null */
export function findPath(
  tiles: Tile[][],
  sx: number, sy: number,
  ex: number, ey: number,
): Direction[] | null {
  const rows = tiles.length;
  if (rows === 0) return null;
  const cols = tiles[0].length;

  // 边界/不可达检查
  if (sx === ex && sy === ey) return [];
  if (ey < 0 || ey >= rows || ex < 0 || ex >= cols) return null;
  if (!tiles[ey]?.[ex]?.walkable) return null;

  const key = (x: number, y: number) => `${x},${y}`;
  const heuristic = (x: number, y: number) => Math.abs(x - ex) + Math.abs(y - ey);

  const start: Node = { x: sx, y: sy, g: 0, h: heuristic(sx, sy), f: heuristic(sx, sy), parent: null };
  const open: Node[] = [start];
  const closed = new Set<string>();

  while (open.length > 0) {
    // 取 f 最小的节点
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const ck = key(current.x, current.y);

    if (current.x === ex && current.y === ey) {
      // 回溯路径
      const path: Direction[] = [];
      let node: Node | null = current;
      while (node?.parent) {
        const dx = node.x - node.parent.x;
        const dy = node.y - node.parent.y;
        const dir = DIRS.find(d => d.dx === dx && d.dy === dy);
        if (dir) path.unshift(dir.d);
        node = node.parent;
      }
      return path;
    }

    closed.add(ck);

    for (const { d, dx, dy } of DIRS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nk = key(nx, ny);

      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (closed.has(nk)) continue;
      if (!tiles[ny]?.[nx]?.walkable) continue;

      const g = current.g + 1;
      const existing = open.find(n => n.x === nx && n.y === ny);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = g + existing.h;
          existing.parent = current;
        }
      } else {
        const h = heuristic(nx, ny);
        open.push({ x: nx, y: ny, g, h, f: g + h, parent: current });
      }
    }
  }

  return null;
}

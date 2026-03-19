const BASE_CELL_SIZE = 32;
let zoom = 2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function getZoom(): number {
  return zoom;
}

export function cycleZoom(): number {
  zoom = zoom >= MAX_ZOOM ? MIN_ZOOM : zoom + 1;
  return zoom;
}

export function adjustZoom(delta: number): number {
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
  return zoom;
}

export function getCellSize(): number {
  return BASE_CELL_SIZE * zoom;
}

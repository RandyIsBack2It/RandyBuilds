// Tile collision for PATCH QUEST. Bodies are axis-aligned boxes (top-left
// x, y in pixels). Movement resolves X, then Y, against the tile grid:
// solid tiles block on every side; one-way platforms and moving platforms
// only catch a body falling onto them from above. No DOM, so it's unit-tested.
import { TILE } from './config';
import { Tile } from './levels';

/** Any tile map: PATCH QUEST levels and AFTER HOURS zones both fit. */
export interface TileMap { w: number; h: number; tiles: Uint8Array }

export interface Body { x: number; y: number; w: number; h: number; vx: number; vy: number }

/** A moving platform, as the physics sees it: a one-way top surface. */
export interface Platform { x: number; y: number; w: number; dx: number; dy: number; prevY: number }

export interface Hits { ground: boolean; wall: boolean; ceil: boolean; platform: Platform | null }

export class Grid {
  constructor(public lv: TileMap) {}
  /** Outside the level: walls left and right, open above and below. */
  at(tx: number, ty: number): Tile {
    if (tx < 0 || tx >= this.lv.w) return Tile.Solid;
    if (ty < 0 || ty >= this.lv.h) return Tile.Empty;
    return this.lv.tiles[ty * this.lv.w + tx] as Tile;
  }
  solid(tx: number, ty: number) { return this.at(tx, ty) === Tile.Solid; }
  /** Extra solid boxes (a closed gate), checked like solid tiles. */
  blockers: { x: number; y: number; w: number; h: number }[] = [];
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export { overlaps };

/**
 * Moves a body by its velocity for `dt` seconds. With `dropThrough`, one-way
 * platforms don't catch it (down + jump).
 */
export function move(b: Body, dt: number, grid: Grid, platforms: Platform[] = [], dropThrough = false): Hits {
  const hits: Hits = { ground: false, wall: false, ceil: false, platform: null };
  const eps = 0.001;

  // X
  let nx = b.x + b.vx * dt;
  if (b.vx !== 0) {
    const top = Math.floor(b.y / TILE);
    const bottom = Math.floor((b.y + b.h - eps) / TILE);
    const edge = b.vx > 0 ? nx + b.w - eps : nx;
    const tx = Math.floor(edge / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      if (grid.solid(tx, ty)) {
        nx = b.vx > 0 ? tx * TILE - b.w : (tx + 1) * TILE;
        hits.wall = true;
        break;
      }
    }
    for (const k of grid.blockers) {
      if (overlaps({ x: nx, y: b.y, w: b.w, h: b.h }, k)) {
        nx = b.vx > 0 ? k.x - b.w : k.x + k.w;
        hits.wall = true;
      }
    }
    if (hits.wall) b.vx = 0;
  }
  b.x = nx;

  // Y
  const prevBottom = b.y + b.h;
  let ny = b.y + b.vy * dt;
  const left = Math.floor(b.x / TILE);
  const right = Math.floor((b.x + b.w - eps) / TILE);
  if (b.vy > 0) {
    const bottom = ny + b.h;
    const ty = Math.floor((bottom - eps) / TILE);
    for (let tx = left; tx <= right; tx++) {
      const t = grid.at(tx, ty);
      const top = ty * TILE;
      if (t === Tile.Solid || (t === Tile.OneWay && !dropThrough && prevBottom <= top + 0.5)) {
        ny = top - b.h;
        hits.ground = true;
        break;
      }
    }
    for (const p of platforms) {
      if (dropThrough) break;
      if (b.x + b.w <= p.x || b.x >= p.x + p.w) continue;
      // Compare with where the platform was, so a rising platform still catches.
      if (prevBottom <= Math.max(p.prevY, p.y) + 0.5 && ny + b.h >= p.y) {
        ny = p.y - b.h;
        hits.ground = true;
        hits.platform = p;
      }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(ny / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (grid.solid(tx, ty)) {
        ny = (ty + 1) * TILE;
        hits.ceil = true;
        break;
      }
    }
  }
  for (const k of grid.blockers) {
    if (overlaps({ x: b.x, y: ny, w: b.w, h: b.h }, k)) {
      if (b.vy > 0) { ny = k.y - b.h; hits.ground = true; } else { ny = k.y + k.h; hits.ceil = true; }
    }
  }
  if (hits.ground || hits.ceil) b.vy = 0;
  b.y = ny;
  return hits;
}

/** Is there solid ground (or a one-way top) just below this point? */
export function groundBelow(grid: Grid, px: number, py: number) {
  const t = grid.at(Math.floor(px / TILE), Math.floor((py + 1) / TILE));
  return t === Tile.Solid || t === Tile.OneWay;
}

/** Does a box touch a spike tile? Spikes hurt in their lower 9 pixels. */
export function touchesSpike(grid: Grid, b: { x: number; y: number; w: number; h: number }) {
  const x0 = Math.floor((b.x + 2) / TILE), x1 = Math.floor((b.x + b.w - 3) / TILE);
  const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (grid.at(tx, ty) === Tile.Spike && b.y + b.h > ty * TILE + 7) return true;
    }
  }
  return false;
}

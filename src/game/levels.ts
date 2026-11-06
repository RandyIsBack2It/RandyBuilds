// PATCH QUEST levels, written with a small builder so they stay readable.
// Coordinates are tiles (16 px). An entity at (x, y) stands in tile column x
// with its feet on the bottom of tile row y (so on ground whose top is y + 1).
// tests/patch-quest.mjs checks every level: shape, objectives and that each
// objective can be reached with the player's jump.

export const Tile = { Empty: 0, Solid: 1, OneWay: 2, Spike: 3 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

export type Theme = 'boot' | 'city' | 'core';

export type Ent =
  | { type: 'cell' | 'kit' | 'checkpoint' | 'exit'; x: number; y: number }
  | { type: 'terminal'; x: number; y: number; boss?: 1 | 2 | 3 }
  | { type: 'glitch'; x: number; y: number }
  | { type: 'drone'; x: number; y: number; rx: number; chase?: boolean }
  | { type: 'turret'; x: number; y: number; dir: 1 | -1 }
  | { type: 'mover'; x: number; y: number; w: number; dx: number; dy: number; period: number; phase?: number }
  | { type: 'arc'; x: number; y0: number; y1: number; period: number; offset: number }
  | { type: 'sign'; x: number; y: number; text: string }
  | { type: 'boss'; x: number; y: number; arena: [number, number] };

export interface LevelData {
  id: number;
  name: string;
  subtitle: string;
  theme: Theme;
  /** Seconds; finishing under par earns a time bonus. */
  par: number;
  w: number;
  h: number;
  tiles: Uint8Array;
  spawn: { x: number; y: number };
  ents: Ent[];
}

class Builder {
  tiles: Uint8Array;
  ents: Ent[] = [];
  spawn = { x: 2, y: 11 };
  constructor(public w: number, public h: number) { this.tiles = new Uint8Array(w * h); }
  set(x: number, y: number, t: Tile) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = t; }
  /** Solid rectangle, inclusive. */
  block(x0: number, y0: number, x1: number, y1: number) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, Tile.Solid); return this; }
  /** Ground from column x0 to x1 with its top at row `top`, down to the bottom of the level. */
  ground(x0: number, x1: number, top = 12) { return this.block(x0, top, x1, this.h - 1); }
  /** One-way platform (stand on it from above, jump through from below). */
  plat(x: number, y: number, w: number) { for (let i = 0; i < w; i++) this.set(x + i, y, Tile.OneWay); return this; }
  spikes(x: number, y: number, w: number) { for (let i = 0; i < w; i++) this.set(x + i, y, Tile.Spike); return this; }
  /** Arc hazard: an emitter block at y0 - 1, the beam from y0 down to y1. */
  arc(x: number, y0: number, y1: number, period = 2.4, offset = 0) { this.set(x, y0 - 1, Tile.Solid); this.ents.push({ type: 'arc', x, y0, y1, period, offset }); return this; }
  add(...e: Ent[]) { this.ents.push(...e); return this; }
  cells(...xy: [number, number][]) { for (const [x, y] of xy) this.ents.push({ type: 'cell', x, y }); return this; }
}

function boot(): LevelData {
  const b = new Builder(130, 15);
  b.spawn = { x: 2, y: 11 };
  b.ground(0, 18).ground(22, 53).ground(57, 82).ground(98, 129);
  b.block(13, 11, 14, 11);
  b.add({ type: 'sign', x: 4, y: 8, text: 'MOVE >' }, { type: 'sign', x: 12, y: 8, text: 'JUMP' });
  b.cells([6, 11], [8, 11], [10, 11], [14, 9], [20, 9]);
  b.add({ type: 'sign', x: 25, y: 8, text: '{ACT}: REPAIR' }, { type: 'terminal', x: 28, y: 11 });
  b.plat(31, 9, 3).cells([31, 8], [32, 8], [33, 8]);
  b.add({ type: 'checkpoint', x: 36, y: 11 });
  b.add({ type: 'sign', x: 38, y: 8, text: 'STOMP BUGS' }, { type: 'glitch', x: 41, y: 11 });
  b.spikes(46, 11, 3).plat(45, 8, 5).cells([46, 7], [48, 7]);
  b.add({ type: 'sign', x: 50, y: 8, text: '{ACT}: PULSE' }, { type: 'glitch', x: 52, y: 11 });
  // Pit 53–56, then steps up to a raised deck.
  b.cells([55, 9]);
  b.block(57, 10, 59, 11).block(60, 8, 76, 11);
  b.cells([64, 6], [66, 6], [68, 6]);
  b.add({ type: 'drone', x: 68, y: 4, rx: 3 }, { type: 'terminal', x: 73, y: 7 });
  b.add({ type: 'checkpoint', x: 80, y: 11 });
  // Floating platforms over a pit.
  b.plat(85, 10, 3).plat(90, 8, 3).plat(95, 10, 2);
  b.cells([86, 9], [91, 7], [95, 9]).add({ type: 'kit', x: 92, y: 7 });
  b.add({ type: 'glitch', x: 104, y: 11 }, { type: 'drone', x: 108, y: 7, rx: 4 }, { type: 'glitch', x: 110, y: 11 });
  b.add({ type: 'terminal', x: 115, y: 11 }).cells([112, 9], [118, 9]);
  b.add({ type: 'sign', x: 119, y: 8, text: 'EXIT >' }, { type: 'exit', x: 124, y: 11 });
  return { id: 1, name: 'BOOT SECTOR', subtitle: 'Repair the three terminals', theme: 'boot', par: 100, w: b.w, h: b.h, tiles: b.tiles, spawn: b.spawn, ents: b.ents };
}

function city(): LevelData {
  const b = new Builder(160, 15);
  b.ground(0, 14).ground(25, 45).ground(63, 90).ground(111, 159);
  b.add({ type: 'sign', x: 4, y: 8, text: 'WAIT FOR ARCS' });
  b.arc(10, 7, 11, 2.4, 0).cells([7, 11], [12, 11]);
  b.add({ type: 'sign', x: 13, y: 7, text: 'RIDE' }, { type: 'mover', x: 15, y: 11, w: 3, dx: 6, dy: 0, period: 4.2 });
  b.cells([18, 9], [21, 9]);
  b.add({ type: 'sign', x: 27, y: 7, text: '{ACT}: FIX TURRETS' });
  b.plat(30, 9, 3).cells([31, 8]).add({ type: 'turret', x: 35, y: 11, dir: -1 });
  b.add({ type: 'terminal', x: 40, y: 11 }, { type: 'checkpoint', x: 43, y: 11 });
  // Lift up to the high deck.
  b.add({ type: 'mover', x: 44, y: 11, w: 2, dx: 0, dy: -7, period: 5 });
  b.ground(46, 62, 4);
  b.cells([49, 3], [51, 3], [57, 3]).add({ type: 'glitch', x: 54, y: 3 }, { type: 'drone', x: 56, y: 1, rx: 3, chase: true });
  b.add({ type: 'terminal', x: 60, y: 3 });
  b.add({ type: 'checkpoint', x: 66, y: 11 });
  b.arc(70, 5, 11, 2, 0).arc(74, 5, 11, 2, 1).cells([72, 11], [76, 11]);
  b.plat(79, 9, 3).cells([80, 8]).add({ type: 'turret', x: 85, y: 11, dir: -1 }, { type: 'glitch', x: 88, y: 11 });
  // Pit crossing: a sliding platform, a ledge, a lift, a ledge.
  b.add({ type: 'mover', x: 91, y: 11, w: 2, dx: 5, dy: 0, period: 3.6 });
  b.plat(99, 9, 3).cells([100, 8]);
  b.add({ type: 'mover', x: 103, y: 11, w: 2, dx: 0, dy: -5, period: 4 });
  b.plat(107, 6, 3).add({ type: 'kit', x: 108, y: 5 });
  b.add({ type: 'checkpoint', x: 113, y: 11 });
  b.add({ type: 'glitch', x: 118, y: 11 }, { type: 'drone', x: 122, y: 6, rx: 3, chase: true }, { type: 'glitch', x: 126, y: 11 });
  b.add({ type: 'terminal', x: 122, y: 11 }).cells([120, 9], [124, 9]);
  b.spikes(129, 11, 3).plat(128, 8, 5).cells([130, 7]);
  b.block(134, 10, 136, 11).add({ type: 'turret', x: 135, y: 9, dir: -1 });
  b.arc(141, 6, 11, 1.8, 0.3).arc(144, 6, 11, 1.8, 1.2).cells([142, 11], [145, 11]);
  b.add({ type: 'sign', x: 148, y: 8, text: 'EXIT >' }, { type: 'exit', x: 153, y: 11 });
  b.add({ type: 'terminal', x: 149, y: 11 });
  return { id: 2, name: 'CIRCUIT CITY', subtitle: 'Four terminals, live wires', theme: 'city', par: 150, w: b.w, h: b.h, tiles: b.tiles, spawn: b.spawn, ents: b.ents };
}

function core(): LevelData {
  const b = new Builder(100, 15);
  b.ground(0, 99);
  b.add({ type: 'sign', x: 4, y: 8, text: 'THE CORE AWAITS' });
  b.cells([6, 11], [9, 11]);
  // Spike floor under a sliding platform.
  b.spikes(17, 11, 11).add({ type: 'mover', x: 16, y: 10, w: 3, dx: 8, dy: 0, period: 4.6 }).cells([20, 8], [24, 8]);
  b.add({ type: 'checkpoint', x: 30, y: 11 });
  b.add({ type: 'drone', x: 36, y: 6, rx: 3, chase: true }, { type: 'turret', x: 41, y: 11, dir: -1 }, { type: 'glitch', x: 38, y: 11 });
  b.plat(36, 9, 3).add({ type: 'terminal', x: 45, y: 11 }).cells([37, 8]);
  b.arc(48, 7, 11, 1.8, 0).arc(51, 7, 11, 1.8, 0.6).arc(54, 7, 11, 1.8, 1.2).cells([49, 11], [52, 11], [55, 11]);
  b.add({ type: 'checkpoint', x: 57, y: 11 });
  b.block(58, 10, 58, 11).block(59, 9, 63, 11).add({ type: 'drone', x: 61, y: 5, rx: 2 }, { type: 'terminal', x: 62, y: 8 }).cells([60, 8]);
  b.add({ type: 'kit', x: 65, y: 11 });
  b.add({ type: 'sign', x: 64, y: 8, text: 'CORE GATE' }, { type: 'exit', x: 67, y: 11 });
  // Boss arena: exactly one screen wide (columns 70–89), walled on the right.
  b.block(90, 0, 99, 14);
  b.plat(71, 10, 4).plat(85, 10, 4).plat(78, 8, 4);
  b.add({ type: 'mover', x: 76, y: 11, w: 2, dx: 0, dy: -3, period: 4.4 });
  b.add({ type: 'terminal', x: 72, y: 9, boss: 1 }, { type: 'terminal', x: 87, y: 9, boss: 2 }, { type: 'terminal', x: 80, y: 7, boss: 3 });
  b.add({ type: 'boss', x: 80, y: 3, arena: [70, 89] });
  return { id: 3, name: 'THE CORE', subtitle: 'Repair the corrupted kernel', theme: 'core', par: 200, w: b.w, h: b.h, tiles: b.tiles, spawn: b.spawn, ents: b.ents };
}

export const LEVELS = [boot, city, core];
export const levelCount = LEVELS.length;
export const loadLevel = (i: number) => LEVELS[i]();

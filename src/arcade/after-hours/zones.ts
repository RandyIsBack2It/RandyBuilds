// The district: four connected areas, played in order, 11:59 PM to sunrise.
// Coordinates are tiles (16 px); the floor's top is row 10. An entity at
// (x, y) stands in column x with its feet at the bottom of row y.
// `slots` are where encounters happen: a fixed id, or a pool to pick from
// (randomised per run, never repeating an encounter in one night).
import { Tile } from '../../game/levels';

export type Theme = 'street' | 'club' | 'diner' | 'alley' | 'penthouse';

export type Ent =
  | { type: 'cash' | 'cash20' | 'lipstick' | 'skull' | 'disco' | 'courage'; x: number; y: number }
  | { type: 'item'; item: 'glass' | 'heel' | 'cone'; x: number; y: number }
  | { type: 'guard' | 'cook'; x: number; y: number; range: number }
  | { type: 'bouncer' | 'rat'; x: number; y: number }
  | { type: 'steam'; x: number; period: number; offset: number }
  | { type: 'puddle'; x: number; w: number }
  | { type: 'plates'; x: number; dir: -1 | 1; period: number }
  | { type: 'sign'; x: number; y: number; text: string; color: string; size?: 1 | 2; flicker?: boolean }
  | { type: 'exit'; x: number; label: string }
  /** Brawl: passing x locks the screen to [from, to] until the wave is beaten. */
  | { type: 'brawl'; x: number; from: number; to: number; wave: ('guard' | 'bouncer' | 'rat' | 'cook')[] };

export interface Slot { x: number; fixed?: string; pool?: string[]; /** NPC stands a little ahead of the trigger. */ npcX?: number }

export interface ZoneData {
  id: number;
  name: string;
  /** Clock at the start and end of the zone (minutes after 11 PM). */
  clock: [number, number];
  w: number;
  h: number;
  tiles: Uint8Array;
  spawn: number;
  /** Background per column range. */
  themes: { from: number; theme: Theme }[];
  ents: Ent[];
  slots: Slot[];
  /** Boss arena (penthouse): tile columns. */
  arena?: [number, number];
  /** Where an angry ex enters, if the night's choices summon him. */
  exFrom?: number;
}

const FLOOR = 10;

class Builder {
  tiles: Uint8Array;
  ents: Ent[] = [];
  slots: Slot[] = [];
  constructor(public w: number, public h = 12) { this.tiles = new Uint8Array(w * h); this.block(0, FLOOR, w - 1, h - 1); }
  set(x: number, y: number, t: number) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = t; }
  block(x0: number, y0: number, x1: number, y1: number) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, Tile.Solid); return this; }
  gap(x0: number, x1: number) { for (let y = FLOOR; y < this.h; y++) for (let x = x0; x <= x1; x++) this.set(x, y, Tile.Empty); return this; }
  plat(x: number, y: number, w: number) { for (let i = 0; i < w; i++) this.set(x + i, y, Tile.OneWay); return this; }
  add(...e: Ent[]) { this.ents.push(...e); return this; }
  cash(...xs: number[]) { for (const x of xs) this.ents.push({ type: 'cash', x, y: FLOOR - 1 }); return this; }
  sign(x: number, y: number, text: string, color: string, size: 1 | 2 = 1, flicker = false) { this.ents.push({ type: 'sign', x, y, text, color, size, flicker }); return this; }
  slot(s: Slot) { this.slots.push(s); return this; }
}

export const PINK = '#ff4fd8';
export const CYAN = '#3df2ff';
export const RED = '#ff3355';
export const GOLD = '#ffd23f';
export const LIME = '#b6ff3d';

function velvetTrap(): ZoneData {
  const b = new Builder(112);
  // Street (outside, raining)
  b.sign(3, 2, 'LOANS 4 BAD PEOPLE', GOLD).sign(13, 3, 'PSYCHIC: SHE ALREADY KNOWS', PINK, 1, true);
  b.sign(24, 2, 'HOT SINGLES IN YOUR AREA', RED).sign(25, 3, '(THEY ARE ALSO LOST)', '#ffb3c7');
  b.slot({ x: 6, fixed: 'ex-text' });
  b.add({ type: 'puddle', x: 14, w: 3 }, { type: 'puddle', x: 30, w: 2 });
  b.cash(10, 20, 27);
  b.block(17, 8, 18, 9).add({ type: 'skull', x: 18, y: 7 }); // a dumpster with a chaos bonus on top
  b.add({ type: 'guard', x: 25, y: 9, range: 4 });
  b.sign(33, 2, 'THE VELVET TRAP', PINK, 2, true).sign(34, 4, 'DRESS CODE: REGRET', CYAN);
  b.slot({ x: 36, fixed: 'bouncer', npcX: 39 });
  // Inside the club
  b.sign(47, 2, 'NO REFUNDS ON FEELINGS', CYAN).sign(57, 2, 'DANCE FLOOR', PINK, 2, true);
  b.plat(63, 7, 5).plat(69, 5, 2).add({ type: 'disco', x: 70, y: 4 }); // DJ booth, speaker stack, secret
  b.add({ type: 'brawl', x: 50, from: 43, to: 62, wave: ['guard', 'guard'] });
  b.slot({ x: 60, pool: ['dj', 'bachelorette'], npcX: 64 });
  b.add({ type: 'item', item: 'glass', x: 73, y: 9 }, { type: 'cash20', x: 66, y: 6 });
  b.plat(77, 8, 7).sign(77, 2, 'BAR · TAB CLOSED IN 1997', GOLD);
  b.slot({ x: 82, pool: ['drink', 'bachelorette', 'dj'], npcX: 85 });
  b.add({ type: 'lipstick', x: 80, y: 7 });
  b.sign(92, 2, 'VIP · VERY IMPORTANT PROBLEMS', RED, 1, true);
  b.add({ type: 'guard', x: 93, y: 9, range: 3 }, { type: 'guard', x: 102, y: 9, range: 3 });
  b.add({ type: 'brawl', x: 98, from: 88, to: 107, wave: ['bouncer', 'guard'] });
  b.cash(90, 97, 104);
  b.add({ type: 'exit', x: 109, label: 'FIRE EXIT · TO REGRET DINER' });
  return {
    id: 1, name: 'THE VELVET TRAP', clock: [59, 150], w: b.w, h: b.h, tiles: b.tiles, spawn: 2,
    themes: [{ from: 0, theme: 'street' }, { from: 42, theme: 'club' }], ents: b.ents, slots: b.slots, exFrom: 44,
  };
}

function regretDiner(): ZoneData {
  const b = new Builder(92);
  b.sign(1, 2, 'REGRET DINER', RED, 2, true).sign(2, 4, 'OPEN 24 HRS (UNFORTUNATELY)', CYAN);
  b.plat(10, 8, 10).slot({ x: 13, fixed: 'marge', npcX: 16 });
  b.sign(12, 2, 'TODAY: MYSTERY MEATLOAF', GOLD);
  b.plat(27, 8, 3).plat(35, 8, 3).plat(43, 8, 3);
  b.add({ type: 'lipstick', x: 36, y: 7 }, { type: 'skull', x: 44, y: 5 });
  b.slot({ x: 38, pool: ['mom', 'fortune'], npcX: 41 });
  b.sign(30, 2, 'NO CRYING IN BOOTHS 1-6', PINK);
  b.sign(51, 2, 'KITCHEN · DUCK', RED, 1, true);
  b.add({ type: 'plates', x: 62, dir: -1, period: 1.6 });
  b.add({ type: 'cook', x: 66, y: 9, range: 4 });
  b.add({ type: 'brawl', x: 64, from: 54, to: 73, wave: ['cook', 'cook', 'rat'] });
  b.add({ type: 'puddle', x: 70, w: 6 }).sign(70, 3, 'CAUTION: WET (EVERYTHING)', GOLD);
  b.add({ type: 'courage', x: 78, y: 9 });
  b.plat(81, 8, 2).plat(83, 6, 2).add({ type: 'disco', x: 84, y: 5 }); // crates up to the pie case
  b.cash(24, 32, 48, 58, 74);
  b.add({ type: 'exit', x: 89, label: 'BACK DOOR · ALLEY' });
  return {
    id: 2, name: 'REGRET DINER', clock: [150, 255], w: b.w, h: b.h, tiles: b.tiles, spawn: 2,
    themes: [{ from: 0, theme: 'street' }, { from: 7, theme: 'diner' }], ents: b.ents, slots: b.slots, exFrom: 1,
  };
}

function backAlley(): ZoneData {
  const b = new Builder(124);
  b.sign(3, 2, 'SHORTCUT (DO NOT)', RED, 1, true);
  b.block(12, 8, 13, 9).add({ type: 'steam', x: 18, period: 2.4, offset: 0 });
  b.plat(20, 6, 6).plat(28, 4, 5).add({ type: 'disco', x: 31, y: 3 }, { type: 'cash20', x: 22, y: 5 }); // fire escape + secret
  b.sign(21, 1, 'BAD IDEAS →', LIME).add({ type: 'rat', x: 24, y: 9 });
  b.add({ type: 'steam', x: 35, period: 2, offset: 1 });
  b.block(40, 8, 41, 9);
  b.slot({ x: 44, fixed: 'limo' });
  b.add({ type: 'item', item: 'heel', x: 54, y: 9 }, { type: 'rat', x: 50, y: 9 });
  b.sign(56, 2, 'TACO CONFESSIONAL', GOLD, 1, true).sign(57, 3, 'WE DON’T JUDGE. WE DO TALK.', '#ffd9a0');
  b.add({ type: 'guard', x: 60, y: 9, range: 6 });
  b.slot({ x: 64, pool: ['trench', 'raccoon'], npcX: 67 });
  b.add({ type: 'steam', x: 72, period: 2.2, offset: 0.4 }, { type: 'rat', x: 76, y: 9 });
  b.add({ type: 'brawl', x: 70, from: 61, to: 80, wave: ['rat', 'rat', 'guard', 'guard'] });
  b.slot({ x: 80, pool: ['battery', 'raccoon', 'trench'], npcX: 83 });
  b.block(88, 8, 89, 9).add({ type: 'skull', x: 89, y: 7 });
  b.sign(90, 2, 'LAWYER? 1-800-OOPSIE', CYAN);
  b.add({ type: 'steam', x: 96, period: 1.8, offset: 0.9 }, { type: 'guard', x: 102, y: 9, range: 5 });
  b.add({ type: 'lipstick', x: 108, y: 9 }, { type: 'puddle', x: 110, w: 3 });
  b.add({ type: 'brawl', x: 104, from: 95, to: 114, wave: ['bouncer', 'rat', 'rat'] });
  b.cash(8, 15, 38, 47, 70, 84, 99, 114);
  b.add({ type: 'exit', x: 121, label: 'SERVICE ELEVATOR · PENTHOUSE' });
  return {
    id: 3, name: 'THE BACK ALLEY', clock: [255, 380], w: b.w, h: b.h, tiles: b.tiles, spawn: 2,
    themes: [{ from: 0, theme: 'alley' }], ents: b.ents, slots: b.slots, exFrom: 1,
  };
}

function penthouse(): ZoneData {
  const b = new Builder(36);
  b.sign(2, 2, 'PENTHOUSE LOBBY', GOLD).slot({ x: 3, fixed: 'elevator' });
  b.add({ type: 'guard', x: 10, y: 9, range: 2 });
  b.block(0, 0, 0, 9).block(35, 0, 35, 9);
  b.sign(15, 2, 'HOT TUB OF TRUTH', PINK, 2, true);
  b.block(27, 9, 31, 9); // the hot tub rim
  b.slot({ x: 15, fixed: 'lorenzo' });
  return {
    id: 4, name: 'THE PENTHOUSE', clock: [380, 420], w: b.w, h: b.h, tiles: b.tiles, spawn: 1,
    themes: [{ from: 0, theme: 'penthouse' }], ents: b.ents, slots: b.slots, arena: [14, 34],
  };
}

export const ZONES = [velvetTrap, regretDiner, backAlley, penthouse];
export const zoneCount = ZONES.length;
export const FLOOR_ROW = FLOOR;

// PATCH QUEST — shared constants. Everything is in game pixels: the game
// renders at 320×180 and is scaled up by whole or nearest-neighbour steps.
export const W = 320;
export const H = 180;
export const TILE = 16;
/** Fixed simulation step (seconds). */
export const DT = 1 / 60;

/** Player movement. Jump height ≈ jump² / (2 · gravity) ≈ 56 px (3½ tiles). */
export const PHYS = {
  gravity: 980,
  maxFall: 330,
  walk: 84,
  run: 140,
  /** Holding a direction this long switches walking to running. */
  runAfter: 0.3,
  accelGround: 1000,
  accelAir: 700,
  friction: 1300,
  jump: 332,
  /** Releasing jump early keeps this share of the upward speed (variable jump height). */
  jumpCut: 0.42,
  /** Grace after walking off a ledge during which a jump still counts. */
  coyote: 0.1,
  /** A jump pressed this long before landing still happens on landing. */
  buffer: 0.14,
  stompBounce: 250,
};

export const PLAYER = { w: 10, h: 13, maxHp: 3, lives: 3, invuln: 1.3, knockX: 120, knockY: 190 };
export const PULSE = { radius: 30, cooldown: 0.65, time: 0.28 };
export const REPAIR = { time: 0.8, reach: 14 };

export const SCORE = {
  cell: 50,
  enemy: 100,
  turret: 150,
  terminal: 500,
  allCells: 1000,
  hpBonus: 250,
  /** Points per second under a level's par time. */
  timeBonus: 20,
  boss: 5000,
};

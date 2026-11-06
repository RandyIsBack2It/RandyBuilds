// AFTER HOURS: Bad Decisions — shared constants (game pixels; 320×180, 16px tiles).
export const W = 320;
export const H = 180;
export const TILE = 16;
export const DT = 1 / 60;

export const PHYS = {
  gravity: 1000,
  maxFall: 340,
  walk: 78,
  run: 132,
  runAfter: 0.28,
  accelGround: 1000,
  accelAir: 720,
  friction: 1300,
  jump: 335,
  jumpCut: 0.42,
  coyote: 0.1,
  buffer: 0.14,
};

export const VIV = {
  w: 10, h: 22,
  maxDignity: 5,
  invuln: 1.3,
  knockX: 150, knockY: 200,
  startCash: 40,
};

export const ATTACK = { time: 0.28, active: [0.06, 0.18] as const, cooldown: 0.34, reach: 16, height: 14, knock: 170, damage: 1 };
export const DODGE = { time: 0.36, speed: 205, cooldown: 0.55 };

/** Chaos: 0–100. Points earned are multiplied by 1 + chaos / 50 (up to ×3). */
export const CHAOS = {
  hazardsAt: 40,
  unhingedAt: 70,
  /** At or above this, every hit costs two dignity. */
  brutalAt: 90,
};

export const SCORE = {
  enemy: 100,
  bouncer: 300,
  cashPerDollar: 10,
  secret: 750,
  boss: 5000,
  dignityBonus: 300,
  zone: 1000,
};

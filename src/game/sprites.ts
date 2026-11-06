// Original pixel art for PATCH QUEST, as text (palette in pixels.ts).
// Character sprites face right unless noted; the renderer mirrors them.
import { sprite, recolor, type Sprite } from './pixels';

// Patch: a small repair robot with a screen face, antenna and a glowing core.
const HEAD = [
  '........o.......',
  '........k.......',
  '...kkkkkkkkkk...',
  '..kllllllllllk..',
  '..klkkkkkkkkgk..',
  '..klkkcckcckgk..',
  '..klkkcbkcbkgk..',
  '..klkkkkkkkkgk..',
  '..kgggggggggdk..',
  '...kkkkkkkkkk...',
];
const BODY = [
  '....kdlllldk....',
  '...kdlloolldk...',
  '...kdllyylldk...',
  '....kddddddk....',
];
const LEGS = {
  stand: ['...kgk....kgk...', '..kkkk....kkkk..'],
  wide: ['..kgk.....kgk...', '.kkk.......kkk..'],
  close: ['....kgkkgk......', '....kkkkkk......'],
  mid: ['...kgk...kgk....', '..kkk....kkk....'],
  tuck: ['....kgk.kgk.....', '....kk...kk.....'],
  dangle: ['...kgk....kgk...', '..kk......kk....'],
};
const patch = (legs: string[], opts: { blink?: boolean; hurt?: boolean; bulb?: string; tool?: boolean; look?: 'up' } = {}) => {
  let head = [...HEAD];
  if (opts.bulb) head[0] = head[0].replace('o', opts.bulb);
  if (opts.blink) { head[5] = '..klkkkkkkkkgk..'; head[6] = '..klkkcckcckgk..'; }
  if (opts.hurt) { head[5] = '..klkrkkkrkkgk..'; head[6] = '..klkkrkkkrkgk..'; }
  if (opts.look === 'up') { head[4] = '..klkkcckcckgk..'; head[5] = '..klkkcbkcbkgk..'; head[6] = '..klkkkkkkkkgk..'; }
  let body = [...BODY];
  if (opts.tool) { body[0] = '....kdlllldk.y..'; body[1] = '...kdlloolldkyy.'; }
  return sprite([...head, ...body, ...legs]);
};

export interface PatchFrames { idle: Sprite[]; run: Sprite[]; jump: Sprite; fall: Sprite; hurt: Sprite; repair: Sprite[] }

const GLITCH = [
  '...kkkkkkkkkk...',
  '..kmmmmmmmmmmk..',
  '.kmppppppppppmk.',
  '.kpphhhppppppmk.',
  '.kpphrhppppppmk.',
  '.kpphhhppppppmk.',
  '.kppppppppppppk.',
  '.kpwpwpwpwpwppk.',
  '.kppppppppppppk.',
  '..kmmmmmmmmmmk..',
];

const DRONE = [
  '..kkkkk.kkkkk...',
  '.......kk.......',
  '.....kkkkkk.....',
  '...kkddddddkk...',
  '..kddgggggggdk..',
  '.kdgglllllllgdk.',
  '.kdgkkrrrkkggdk.',
  '.kdgkrryrrkggdk.',
  '.kddgkkkkkggddk.',
  '..kkddddddddkk..',
  '....kk....kk....',
  '...o........o...',
];

const TURRET = [
  '................',
  '................',
  '....kkkkkkk.....',
  '...kddddddddk...',
  '..kdggggggggdk..',
  '..kdgkkkkkkgdkkk',
  '..kdgkrrrrkgdlll',
  '..kdgkrrrrkgdkkk',
  '..kdgkkkkkkgdk..',
  '..kdggggggggdk..',
  '...kddddddddk...',
  '....kkkkkkkk....',
  '...kdddddddddk..',
  '..kddddddddddk..',
  '..kddddddddddk..',
  '..kkkkkkkkkkkkk.',
];

const CELL = [
  '...kk...',
  '..kllk..',
  '.kcccck.',
  '.kchcck.',
  '.kcccck.',
  '.kbccck.',
  '.kbbcck.',
  '.kbbbck.',
  '..kkkk..',
];

export const HEART = ['.kk.kk.', 'krrkrrk', 'krhrrrk', '.krrrk.', '..krk..', '...k...'];

const KIT = [
  '..kkkkkk..',
  '.kwwwwwwk.',
  'kwwwrrwwwk',
  'kwwwrrwwwk',
  'kwrrrrrrwk',
  'kwrrrrrrwk',
  'kwwwrrwwwk',
  'kwwwrrwwwk',
  '.kwwwwwwk.',
  '..kkkkkk..',
];

export interface Sprites {
  patch: PatchFrames;
  glitch: Sprite[];
  drone: Sprite[];
  turret: Sprite;
  turretFixed: Sprite;
  cell: Sprite[];
  heart: Sprite;
  heartEmpty: Sprite;
  kit: Sprite;
}

let cache: Sprites | undefined;

export function sprites(): Sprites {
  if (cache) return cache;
  const glitchB = [...GLITCH.slice(0, 9), '..kmmmmmmmmmmk..'];
  const glitchLegs = ['..kk.kk..kk.kk..', '................'];
  const glitchLegs2 = ['...kk.kk..kk.kk.', '................'];
  const droneB = [...DRONE];
  droneB[0] = '....kkkkkkkk....';
  droneB[11] = '...y........y...';
  const shine = (row: number) => CELL.map((r, i) => (i === row ? r.replace('c', 'h') : r.replace('h', 'c')));
  cache = {
    patch: {
      idle: [patch(LEGS.stand), patch(LEGS.stand, { bulb: 'y' }), patch(LEGS.stand, { blink: true })],
      run: [patch(LEGS.wide), patch(LEGS.close, { bulb: 'y' }), patch(LEGS.mid), patch(LEGS.close, { bulb: 'y' })],
      jump: patch(LEGS.tuck, { look: 'up', bulb: 'y' }),
      fall: patch(LEGS.dangle),
      hurt: patch(LEGS.dangle, { hurt: true, bulb: 'r' }),
      repair: [patch(LEGS.stand, { tool: true }), patch(LEGS.stand, { tool: true, bulb: 'y' })],
    },
    glitch: [sprite([...glitchB, ...glitchLegs]), sprite([...glitchB, ...glitchLegs2])],
    drone: [sprite(DRONE), sprite(droneB)],
    turret: sprite(TURRET),
    turretFixed: sprite(recolor(TURRET, { r: 'n' })),
    cell: [sprite(CELL), sprite(shine(2)), sprite(shine(4)), sprite(shine(6))],
    heart: sprite(HEART),
    heartEmpty: sprite(recolor(HEART, { r: 'd', h: 'g' })),
    kit: sprite(KIT),
  };
  return cache;
}

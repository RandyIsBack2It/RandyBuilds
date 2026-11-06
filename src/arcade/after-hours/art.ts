// AFTER HOURS pixel art. Characters are built from parts (head, torso, legs)
// written as text, recoloured per character, then given a 1px dark outline so
// they read against neon backgrounds. All original; nothing is loaded from files.
import { canvas, ctx2d, type Sprite } from '../../game/pixels';

const OUTLINE = '#0b0614';

/** Rows → sprite with a generated outline (the image is 2px larger: draw at x−1, y−1). */
export function make(rows: string[], pal: Record<string, string>): Sprite {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const c = canvas(w + 2, h + 2);
  const x = ctx2d(c);
  const solid = (cx: number, cy: number) => cy >= 0 && cy < h && cx >= 0 && cx < rows[cy].length && !!pal[rows[cy][cx]];
  x.fillStyle = OUTLINE;
  for (let y = -1; y <= h; y++) for (let i = -1; i <= w; i++) {
    if (solid(i, y)) continue;
    if (solid(i - 1, y) || solid(i + 1, y) || solid(i, y - 1) || solid(i, y + 1)) x.fillRect(i + 1, y + 1, 1, 1);
  }
  rows.forEach((row, y) => { for (let i = 0; i < row.length; i++) { const col = pal[row[i]]; if (col) { x.fillStyle = col; x.fillRect(i + 1, y + 1, 1, 1); } } });
  const flip = canvas(w + 2, h + 2);
  const f = ctx2d(flip);
  f.translate(w + 2, 0); f.scale(-1, 1); f.drawImage(c, 0, 0);
  return { w: w + 2, h: h + 2, img: c, flip };
}

/** One colour version of a sprite (hit flashes). */
export function tint(s: Sprite, color: string): Sprite {
  const mk = (src: HTMLCanvasElement) => {
    const c = canvas(s.w, s.h); const x = ctx2d(c);
    x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, s.w, s.h);
    return c;
  };
  return { w: s.w, h: s.h, img: mk(s.img), flip: mk(s.flip) };
}

// ── Humanoid parts (16 wide; head 9 rows + torso 8 + legs 7 = 24) ─────
const HEADS = {
  long: [
    '....hhhhhh......', '...hhhhhhhh.....', '..hhhhhhhhhh....', '..hhhhsssssh....', '..hhhsssskss....',
    '..hhhsssssss....', '..hhhhsssssa....', '...hhhhssss.....', '...hhh.ss.......',
  ],
  short: [
    '................', '.....hhhhh......', '....hhhhhhh.....', '....hhsssss.....', '....hsssskss....',
    '....hsssssss....', '....sssssss.....', '.....sssss......', '......ss........',
  ],
  spiky: [
    '....h.h.h.......', '....hhhhhhh.....', '...hhhhhhhh.....', '....hhsssss.....', '....hsssskss....',
    '....hsssssss....', '....sssssaa.....', '.....sssss......', '......ss........',
  ],
  cap: [
    '................', '....cccccc......', '....cccccccc....', '....hssssss.....', '....hsssskss....',
    '....ssssssss....', '....sssssss.....', '.....sssss......', '......ss........',
  ],
  beehive: [
    '.....hhhhh......', '....hhhhhhh.....', '....hhhhhhh.....', '...hhhsssssh.....'.slice(0, 16), '...hhsssskss....',
    '...hhsssssss....', '....hsssssaa....', '.....sssss......', '......ss........',
  ],
  headphones: [
    '................', '.....hhhhh......', '....hhhhhhh.....', '...aahssssa.....', '...aasssksa.....',
    '...aasssssa.....', '....sssssss.....', '.....sssss......', '......ss........',
  ],
  slick: [
    '................', '....hhhhhhh.....', '...hhhhhhhhh....', '....hhsssss.....', '....hsssskss....',
    '....ssssssss....', '....ssssshhh....', '.....sssss......', '......ss........',
  ],
};

const TORSOS = {
  dress: [
    '...hhtttttt.....', '...htttttttt....', '....stttttttsa...'.slice(0, 16), '....stttttttsa..',
    '....sTTTTTTTsaa.', '.....ttttttt.aa.', '.....tttttttt...', '....tttttttttt..',
  ],
  dressWind: [
    '...hhtttttt.....', 'aa.htttttttt....', 'aas.ttttttts....', '..s.tttttttt....',
    '....TTTTTTTT....', '.....ttttttt....', '.....tttttttt...', '....tttttttttt..',
  ],
  dressSwing: [
    '...hhtttttt.....', '...htttttttssaa.', '....tttttttt.aaa', '....tttttttt.aaa',
    '....TTTTTTTT..a.', '.....ttttttt....', '.....tttttttt...', '....tttttttttt..',
  ],
  shirt: [
    '....tttttttt....', '...tttttttttt...', '...stttttttts...', '...stttttttts...',
    '...sTTTTTTTTs...', '....bbbbbbbb....', '....bbbbbbbb....', '....bbb..bbb....',
  ],
  shirtPhone: [
    '....tttttttt....', '...ttttttttttaa.', '...sttttttttsa..', '...stttttttts...',
    '...sTTTTTTTTs...', '....bbbbbbbb....', '....bbbbbbbb....', '....bbb..bbb....',
  ],
  uniform: [
    '....tttttttt....', '...ttttttatttt..'.slice(0, 16), '...stttttttts...', '...stttttttts...',
    '...sTTTTTTTTs...', '....bbbbbbbb....', '....bbbbbbbb....', '....bbb..bbb....',
  ],
  coat: [
    '...tttttttttt...', '..tttttttttttt..', '..sttttTtttttts.', '..sttttTttttts..',
    '...tttttTtttttt.', '...tttttTttttt..', '...tttttTttttt..', '...tttttTttttt..',
  ],
};

const LEGS = {
  stand: ['.....ss....ss...', '.....ss....ss...', '.....ss....ss...', '.....ss....ss...', '.....Ss....Ss...', '....ff....ff....', '....f.f...f.f...'],
  stride: ['....ss.....ss...', '...ss.......ss..', '...ss.......ss..', '..ss.........ss.', '..Ss.........Ss.', '.ff...........ff', '.f.f.........f.f'],
  pass: ['......ss.ss.....', '......ss.ss.....', '......ss.ss.....', '.......ss.ss....', '.......Ss.Ss....', '......ff.ff.....', '......f.ff.f....'],
  stride2: ['....ss.....ss...', '....ss......ss..', '...ss.......ss..', '...ss........ss.', '..Ss.........Ss.', '..ff..........ff', '..f.f.........f.'],
  tuck: ['....ss....ss....', '...ss......ss...', '...ss.....ss....', '....ff....ff....', '....f.f...f.f...', '................', '................'],
  dangle: ['.....ss....ss...', '.....ss.....ss..', '....ss......ss..', '....Ss......Ss..', '...ff........ff.', '...f.f.......f.f', '................'],
  flat: ['.....ss....ss...', '.....ss....ss...', '.....ss....ss...', '.....ss....ss...', '.....Ss....Ss...', '....fff...fff...', '................'],
};

const compose = (head: string[], torso: string[], legs: string[]) => [...head, ...torso, ...legs];

export interface Person { idle: Sprite[]; walk: Sprite[]; jump: Sprite; fall: Sprite; hurt: Sprite; flash: Sprite }

function person(head: keyof typeof HEADS, torso: keyof typeof TORSOS, pal: Record<string, string>, shoes: 'heels' | 'flat' = 'flat'): Person {
  const L = (l: string[]) => (shoes === 'flat' ? l.map((r, i) => (i >= 5 ? r.replace(/f\.f/g, 'ff.') : r)) : l);
  const hurtHead = HEADS[head].map((r, i) => (i === 4 ? r.replace('k', 'w') : r));
  const idle = make(compose(HEADS[head], TORSOS[torso], L(LEGS.stand)), pal);
  return {
    idle: [idle, make(compose(['................', ...HEADS[head].slice(0, 8)], TORSOS[torso], L(LEGS.stand)), pal)],
    walk: [LEGS.stride, LEGS.pass, LEGS.stride2, LEGS.pass].map((l) => make(compose(HEADS[head], TORSOS[torso], L(l)), pal)),
    jump: make(compose(HEADS[head], TORSOS[torso], L(LEGS.tuck)), pal),
    fall: make(compose(HEADS[head], TORSOS[torso], L(LEGS.dangle)), pal),
    hurt: make(compose(hurtHead, TORSOS[torso], L(LEGS.dangle)), pal),
    flash: tint(idle, '#ffffff'),
  };
}

const SKIN = { s: '#f2b48c', S: '#c98a66' };
const SKIN2 = { s: '#a8693f', S: '#7d4a2a' };
const SKIN3 = { s: '#e0a07a', S: '#b07656' };
const BASE = { k: '#1a0f2e', w: '#ffffff' };

export const PAL = {
  viv: { ...BASE, ...SKIN, h: '#8a3cff', H: '#5a1fb0', t: '#ff2e88', T: '#b3165c', f: '#ff2a3d', a: '#ffd23f' },
  ex: { ...BASE, ...SKIN3, h: '#f2cf4a', t: '#f1f1f1', T: '#bdbdbd', b: '#6b8f3a', B: '#4c6a26', f: '#8a5a2b', a: '#22e0ff' },
  guard: { ...BASE, ...SKIN2, h: '#2a1a12', c: '#1d2b5c', t: '#2f4a8f', T: '#1d2b5c', b: '#1a1f33', B: '#10131f', f: '#0c0c12', a: '#ffd23f' },
  cook: { ...BASE, ...SKIN, h: '#3a2a1a', c: '#f4f4f4', t: '#f4f4f4', T: '#cfcfcf', b: '#3d3d55', B: '#2b2b3d', f: '#222', a: '#c0c0c0' },
  dj: { ...BASE, ...SKIN2, h: '#111', t: '#25e2ff', T: '#0f8ea3', b: '#222244', B: '#151530', f: '#eee', a: '#ff2e88' },
  marge: { ...BASE, ...SKIN, h: '#ff6f3c', t: '#7fd6c2', T: '#4aa594', b: '#7fd6c2', B: '#4aa594', f: '#fff', a: '#ff3355' },
  trench: { ...BASE, ...SKIN3, h: '#2b2b2b', t: '#8a6a3a', T: '#5e4724', b: '#333', B: '#222', f: '#111', a: '#ccc' },
  mom: { ...BASE, ...SKIN, h: '#c9c9d9', t: '#b05cff', T: '#7d3cc0', b: '#4a3a66', B: '#33284a', f: '#663', a: '#ffd23f' },
  stranger: { ...BASE, ...SKIN2, h: '#111', t: '#d4af37', T: '#8c7322', b: '#111', B: '#000', f: '#111', a: '#3dff9a' },
  bride: { ...BASE, ...SKIN3, h: '#ffcf6f', t: '#ffffff', T: '#dddddd', f: '#fff', a: '#ff6fb5' },
};

// ── Big characters ────────────────────────────────────────────────────
const BOUNCER = [
  '........ssssss..........', '.......ssssssss.........', '.......ssssssss.........', '.......sggggggs.........',
  '.......ssssssss.........', '.......sssaasss.........', '........ssssss..........', '.......SSssssSS.........',
  '....tttttttttttttt......', '...tttttttttttttttt.....', '..tttttttttttttttttt....', '..stttttttttttttttts....',
  '..stttttttttttttttts....', '..sstttttttttttttsss....', '..ss.ttttttttttt.ss.....', '.sss.ttttttttttt.sss....',
  '.....TTTTTTTTTTT........', '.....bbbbbbbbbbb........', '.....bbbbbbbbbbb........', '.....bbbbb.bbbbb........',
  '.....bbbbb.bbbbb........', '.....bbbb...bbbb........', '.....bbbb...bbbb........', '.....BBBB...BBBB........',
  '....ffffff..ffffff......', '....ffffff..ffffff......',
];
const BOUNCER_SHOVE = BOUNCER.map((r, i) => (i >= 11 && i <= 15 ? '..tttttttttttttttttsssss' : r));
const BOUNCER_PAL = { ...SKIN2, g: '#0b0b10', a: '#5a2a1a', t: '#16161f', T: '#c9a227', b: '#22222e', B: '#15151d', f: '#0a0a0a' };

const BOSS = [
  '.......hhhhhhhh.........', '.....hhhhhhhhhhhh.......', '....hhhhhhhhhhhhhh......', '....hhhhhhhhhhhhh.......',
  '.....hhsssssssss........', '.....hssskssskss........', '.....sssssssssss........', '.....ssshhhhhsss........',
  '......ssswwwsss.........', '.......sssssss..........', '....rrrrsssssrrrr.......', '...rrrrrssyssrrrrr......',
  '..rrrrrrsyysyrrrrrr.....', '..rrrrrrssyssrrrrrr.....', '..rrrrrrsSsSsrrrrrr.....', '..srrrrrsssssrrrrrs.....',
  '..srrrrrRRRRRrrrrrs.....', '...rrrrrrrrrrrrrrr......', '...rrrrrrrrrrrrrrr......', '...rrrrrrr.rrrrrrr......',
  '...rrrrrrr.rrrrrrr......', '...RRRRRR...RRRRRR......', '.....sss.....sss........', '.....sss.....sss........',
  '....yyyyy...yyyyy.......',
];
const BOSS_POSE = BOSS.map((r, i) => (i === 15 ? 'ssrrrrrrsssssrrrrrrss...' : i === 16 ? 's.rrrrrRRRRRrrrrrr.s....' : r));
const BOSS_PAL = { ...SKIN, k: '#1a0f2e', w: '#ffffff', h: '#2a1206', r: '#7b1fa2', R: '#ffd23f', y: '#ffd23f', S: '#5a2f1a' };

const RAT = ['........gg....', '...gggggggg...', 'p.ggggggggggk.', '.pgggggggggggn', '..ggggggggggg.', '...g..g..g..g.'];
const RAT2 = ['........gg....', '...gggggggg...', 'p.ggggggggggk.', '.pgggggggggggn', '..ggggggggggg.', '..g..g..g..g..'];

// ── Items ─────────────────────────────────────────────────────────────
const CASH = ['gggggggggg', 'gGGGGGGGGg', 'gG..$$..Gg'.replace(/\$/g, 'y'), 'gG..yy..Gg', 'gGGGGGGGGg', 'gggggggggg'];
const LIPSTICK = ['..rr..', '.rrrr.', '.rrrr.', '.yyyy.', '.yyyy.', '.gggg.', '.gggg.', '.gggg.', '.gggg.'];
const GLASS = ['cccccccc', '.cpppcc.', '..cppc..', '...cc...', '...cc...', '...cc...', '..cccc..'];
const HEEL = ['.........rr', '........rrr', '.......rrr.', 'rrrrrrrrr..', 'rrrrrrr....', 'r.....r....', 'r.....r....'];
const CONE = ['....oo....', '....oo....', '...wwww...', '...oooo...', '..oooooo..', '..wwwwww..', '.oooooooo.', 'oooooooooo'];
const COURAGE = ['..gg..', '..gg..', '.gggg.', 'gyyyyg', 'gyGGyg', 'gyGGyg', 'gyyyyg', 'gggggg'];
const SKULL = ['..pppppp..', '.pppppppp.', 'pp..pp..pp', 'pp..pp..pp', 'pppppppppp', '.pppppppp.', '..p.pp.p..', '..p.pp.p..'];
const DISCO = ['...wwww...', '.wywywywy.', 'wywywywywy', 'ywywywywyw', 'wywywywywy', 'ywywywywyw', '.ywywywyw.', '...yyyy...'];

export interface Art {
  viv: Person & { attack: Sprite[]; roll: Sprite[] };
  ex: Person & { throw: Sprite };
  guard: Person;
  cook: Person;
  npc: Record<'dj' | 'marge' | 'trench' | 'mom' | 'stranger' | 'bride', Sprite[]>;
  bouncer: { idle: Sprite; shove: Sprite; flash: Sprite };
  boss: { idle: Sprite; pose: Sprite; flash: Sprite; robe2: Sprite };
  rat: Sprite[];
  raccoon: Sprite;
  items: Record<'cash' | 'cash20' | 'lipstick' | 'glass' | 'heel' | 'cone' | 'courage' | 'skull' | 'disco', Sprite>;
}

let cache: Art | undefined;

export function art(): Art {
  if (cache) return cache;
  const viv = person('long', 'dress', PAL.viv, 'heels');
  const vivRows = (t: string[]) => compose(HEADS.long, t, LEGS.stand);
  const rollA = make(['................', '.....hhhhhh.....', '...hhhhhhhhhh...', '..hhhtttttthhh..', '..htttttttttth..', '..tttttsstttaa..', '..tttttsstttaa..', '...ttttttttt....', '....fttttttf....', '.....ffffff.....'], PAL.viv);
  const rollB = make(['................', '.....tttttt.....', '...tttttttttt...', '..aatttssttthh..', '..aattttttthhh..', '..htttttttthhh..', '..hhhttttthhhh..', '...hhhhhhhhhh...', '....fhhhhhhf....', '.....ffffff.....'], PAL.viv);
  const ex = person('spiky', 'shirt', PAL.ex);
  cache = {
    viv: { ...viv, attack: [make(vivRows(TORSOS.dressWind), PAL.viv), make(vivRows(TORSOS.dressSwing), PAL.viv)], roll: [rollA, rollB] },
    ex: { ...ex, throw: make(compose(HEADS.spiky, TORSOS.shirtPhone, LEGS.stand), PAL.ex) },
    guard: person('cap', 'uniform', PAL.guard),
    cook: person('cap', 'shirt', PAL.cook),
    npc: {
      dj: person('headphones', 'shirt', PAL.dj).idle,
      marge: person('beehive', 'dress', PAL.marge).idle,
      trench: person('slick', 'coat', PAL.trench).idle,
      mom: person('beehive', 'coat', PAL.mom).idle,
      stranger: person('slick', 'shirt', PAL.stranger).idle,
      bride: person('long', 'dress', PAL.bride, 'heels').idle,
    },
    bouncer: (() => { const idle = make(BOUNCER, BOUNCER_PAL); return { idle, shove: make(BOUNCER_SHOVE, BOUNCER_PAL), flash: tint(idle, '#ffffff') }; })(),
    boss: (() => {
      const idle = make(BOSS, BOSS_PAL);
      return { idle, pose: make(BOSS_POSE, BOSS_PAL), flash: tint(idle, '#ffffff'), robe2: make(BOSS, { ...BOSS_PAL, r: '#ff6fb5', R: '#ffffff' }) };
    })(),
    rat: [make(RAT, { g: '#6e6a7a', p: '#ff8fb0', k: '#ff3355', n: '#ff8fb0' }), make(RAT2, { g: '#6e6a7a', p: '#ff8fb0', k: '#ff3355', n: '#ff8fb0' })],
    raccoon: make(RAT.map((r, i) => (i === 2 ? r.replace('gggg', 'kkkk') : r)), { g: '#8d8d99', p: '#4a4a55', k: '#111', n: '#111' }),
    items: {
      cash: make(CASH, { g: '#1f8a3a', G: '#3ddc72', y: '#d8ffe0' }),
      cash20: make(CASH, { g: '#a07a10', G: '#ffd23f', y: '#fff6c8' }),
      lipstick: make(LIPSTICK, { r: '#ff2a5a', y: '#ffd23f', g: '#2a2a3a' }),
      glass: make(GLASS, { c: '#c8f4ff', p: '#ff4fd8' }),
      heel: make(HEEL, { r: '#ff2a3d' }),
      cone: make(CONE, { o: '#ff7a1a', w: '#ffffff' }),
      courage: make(COURAGE, { g: '#3dff9a', y: '#c8ff3d', G: '#0b6b3a' }),
      skull: make(SKULL, { p: '#ff4fd8' }),
      disco: make(DISCO, { w: '#ffffff', y: '#ffd23f' }),
    },
  };
  return cache;
}

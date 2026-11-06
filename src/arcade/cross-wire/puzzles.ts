// CROSS//WIRE puzzles. Each grid is the solution ('#' = black square); every
// answer has one clue, keyed by the answer. `node tests/cross-wire.mjs`
// validates all of them (numbering, crossings, lengths, clues, connectivity).
import type { PuzzleDef } from './crossword';

/** Mini Crosswords: the casual library (no clock pressure). */
export const LIBRARY: PuzzleDef[] = [
  {
    id: 'm-alarm', title: 'Rise and Shine', level: 1,
    grid: ['#DATA', 'SEWER', 'ALARM', 'FARMS', 'EYES#'],
    clues: {
      DATA: 'Information a computer processes', SEWER: 'Drain under the street', ALARM: 'It might go off at 6 a.m.', FARMS: 'Places with barns and silos', EYES: 'You might rest them or roll them',
      SAFE: 'Out of danger', DELAY: 'Hold-up at the airport', AWARE: 'In the know', TERMS: 'Conditions of an agreement', ARMS: 'Limbs with elbows',
    },
  },
  {
    id: 'm-early', title: 'Early Bird', level: 1,
    grid: ['#CHAT', 'SHORE', 'WORMS', 'ASSET', 'NEED#'],
    clues: {
      CHAT: 'Talk casually', SHORE: 'Where the sea meets the land', WORMS: 'What the early bird gets', ASSET: 'Something valuable to have', NEED: 'Require',
      SWAN: 'Graceful bird on a pond', CHOSE: 'Picked', HORSE: 'Animal in a stable', ARMED: 'Set and ready to go off, as an alarm', TEST: 'Exam',
    },
  },
  {
    id: 'm-screen', title: 'Screen Time', level: 1,
    grid: ['SHOW#', 'COLOR', 'ANIME', 'MOVES', '#RENT'],
    clues: {
      SHOW: 'Series you might binge', COLOR: 'Red, blue or green', ANIME: 'Japanese animation style', MOVES: 'Dance steps, informally', RENT: 'Monthly payment for an apartment',
      SCAM: 'Con job', HONOR: 'Privilege, as in “It’s an ___”', OLIVE: 'Pizza topping that can be green or black', WOMEN: 'Ladies', REST: 'Take a break',
    },
  },
  {
    id: 'm-taste', title: 'Taste Test', level: 1,
    grid: ['CART#', 'OCEAN', 'PULSE', 'STATE', '#EYED'],
    clues: {
      CART: 'Shopping ___', OCEAN: 'Atlantic or Pacific', PULSE: 'Heartbeat you can feel at the wrist', STATE: 'Maine or Texas', EYED: 'Looked over',
      COPS: 'Police officers, informally', ACUTE: 'Like an angle under 90 degrees', RELAY: 'Race with a baton', TASTE: 'Sense on the tongue', NEED: 'Must have',
    },
  },
  {
    id: 'm-pet', title: 'Pet Project', level: 1,
    grid: ['##PRY', '#BLUE', 'LOANS', 'INNS#', 'PET##'],
    clues: {
      PRY: 'Snoop', BLUE: 'Color of a clear sky', LOANS: 'Bank offerings', INNS: 'Country hotels', PET: 'Dog or cat, often',
      LIP: 'Part of the mouth', BONE: 'Treat a dog might bury', PLANT: 'Fern or factory', RUNS: 'Points in baseball', YES: 'Opposite of no',
    },
  },
  {
    id: 'm-build', title: 'Building Blocks', level: 1,
    grid: ['##FIR', '#CASE', 'BUILD', 'ABLE#', 'YES##'],
    clues: {
      FIR: 'Evergreen tree', CASE: 'Detective’s assignment', BUILD: 'Put together', ABLE: 'Capable', YES: 'What a nod means',
      BAY: 'Body of water partly surrounded by land', CUBE: 'Ice ___', FAILS: 'Doesn’t pass', ISLE: 'Small island', RED: 'Stop sign color',
    },
  },
  {
    id: 'm-apple', title: 'An Apple a Day', level: 1,
    grid: ['#PAY#', 'RAPID', 'UPPER', 'BELLY', '#RED#'],
    clues: {
      PAY: 'Wages', RAPID: 'Very fast', UPPER: 'Top bunk, as opposed to lower', BELLY: 'Tummy', RED: 'Color of a ripe tomato',
      RUB: 'Massage', PAPER: 'Notebook material', APPLE: 'Fruit said to keep the doctor away', YIELD: 'Give way, on a road sign', DRY: 'Not wet',
    },
  },
  {
    id: 'm-radar', title: 'On the Radar', level: 1,
    grid: ['#TIE#', 'RADAR', 'OPERA', 'DEALT', '#SLY#'],
    clues: {
      TIE: 'Game result with no winner', RADAR: 'Plane spotter that reads the same backward', OPERA: 'Musical drama with arias', DEALT: 'Handed out, as cards', SLY: 'Crafty',
      ROD: 'Fishing pole', TAPES: 'Cassettes', IDEAL: 'Perfect', EARLY: 'Before the scheduled time', RAT: 'Lab rodent',
    },
  },
  {
    id: 'm-atlas', title: 'Map Room', level: 2,
    grid: ['ACT##', 'QUITE', 'ULTRA', 'ATLAS', '##EYE'],
    clues: {
      ACT: 'Part of a play', QUITE: 'Very', ULTRA: 'Extreme (prefix in “___violet”)', ATLAS: 'Book of maps', EYE: 'Calm center of a hurricane',
      AQUA: 'Blue-green color', CULT: 'Devoted following, as for a classic film', TITLE: 'Name on a book’s cover', TRAY: 'Serving platter', EASE: 'Comfort',
    },
  },
  {
    id: 'm-desktop', title: 'Desktop', level: 2,
    grid: ['MET##', 'ICONS', 'SHOOT', 'SOLVE', '##SAP'],
    clues: {
      MET: 'Got together', ICONS: 'Little pictures on a home screen', SHOOT: '“Darn it!”', SOLVE: 'Crack, as a crossword', SAP: 'Sticky stuff from a tree',
      MISS: 'Fail to hit', ECHO: 'Sound that bounces back', TOOLS: 'Hammers and wrenches', NOVA: 'Star that suddenly brightens', STEP: 'Stair',
    },
  },
  {
    id: 'm-shop', title: 'Shop Talk', level: 2,
    grid: ['PAW##', 'EUROS', 'STORE', 'TOTAL', '##ELF'],
    clues: {
      PAW: 'Cat’s foot', EUROS: 'Money spent in Paris', STORE: 'Shop', TOTAL: 'Sum at the bottom of a receipt', ELF: 'Santa’s helper',
      PEST: 'Nuisance', AUTO: 'Car, for short', WROTE: 'Put pen to paper', ORAL: 'Spoken, not written', SELF: '___-checkout (store option)',
    },
  },
  {
    id: 'm-target', title: 'Bullseye', level: 2,
    grid: ['##CHAT', '#SHADE', 'STANDS', 'TARGET', 'URGED#', 'BEER##'],
    clues: {
      CHAT: 'Small talk', SHADE: 'Cool spot under a tree', STANDS: 'Bleachers', TARGET: 'Bullseye’s place', URGED: 'Pushed to act', BEER: 'Pint at a pub, maybe',
      STUB: 'What’s left of a ticket after the show', STARE: 'Look without blinking', CHARGE: 'Plug in, as a phone', HANGER: 'Closet item for a shirt', ADDED: 'Tacked on', TEST: 'Trial run',
    },
  },
];

export interface Sector { id: string; name: string; blurb: string; puzzles: PuzzleDef[] }

/** Circuit Campaign: three sectors, each unlocked by finishing the one before. */
export const SECTORS: Sector[] = [
  {
    id: 's1', name: 'Boot Sequence', blurb: 'Get the system started. Straightforward clues on small grids.',
    puzzles: [
      {
        id: 's1-startup', title: 'Startup', level: 1,
        grid: ['#STEP', 'STOVE', 'TAKES', 'AGENT', 'RENT#'],
        clues: {
          STEP: 'One stair', STOVE: 'Kitchen appliance with burners', TAKES: 'Grabs', AGENT: 'Secret ___ (spy)', RENT: 'Pay to use, as a movie',
          STAR: 'Sun, for one', STAGE: 'Where actors perform', TOKEN: 'Game piece', EVENT: 'Concert or wedding', PEST: 'Annoying person or bug',
        },
      },
      {
        id: 's1-panel', title: 'Control Panel', level: 1,
        grid: ['#AGO#', 'SPECS', 'PANEL', 'ARRAY', '#TEN#'],
        clues: {
          AGO: 'In the past', SPECS: 'Technical details, informally', PANEL: 'Board of experts', ARRAY: 'Impressive display', TEN: 'Perfect score, often',
          SPA: 'Place for a massage', APART: 'Separated', GENRE: 'Mystery or romance, for a novel', OCEAN: 'Home of whales', SLY: 'Sneaky',
        },
      },
      {
        id: 's1-board', title: 'Board Game', level: 1,
        grid: ['#BEG#', 'BOARD', 'ANGER', 'DELAY', '#SET#'],
        clues: {
          BEG: 'Plead', BOARD: 'Chess surface', ANGER: 'Rage', DELAY: 'Postpone', SET: 'Tennis match unit',
          BAD: 'Not good', BONES: 'A skeleton has 206 of them', EAGLE: 'Bird on the U.S. seal', GREAT: 'Terrific', DRY: 'Like a desert',
        },
      },
      {
        id: 's1-sink', title: 'Kitchen Sink', level: 1,
        grid: ['##CAP', '#PACE', 'BASIN', 'AGED#', 'YES##'],
        clues: {
          CAP: 'Baseball hat', PACE: 'Walking speed', BASIN: 'Sink', AGED: 'Like fine cheese', YES: 'Agreeable answer',
          BAY: 'Inlet of the sea', PAGE: 'Book leaf', CASES: 'Suitcases, for example', ACID: 'Lemon juice has some', PEN: 'Writing tool',
        },
      },
    ],
  },
  {
    id: 's2', name: 'Signal Recovery', blurb: 'Bigger grids and a little wordplay. Lock onto the signal.',
    puzzles: [
      {
        id: 's2-claims', title: 'Small Claims', level: 2,
        grid: ['##CASH', '#CIRCA', 'PORTER', 'ACCENT', 'COURT#', 'EASY##'],
        clues: {
          CASH: 'Bills and coins', CIRCA: 'Around, with a date', PORTER: 'Hotel worker who carries bags', ACCENT: 'Way of speaking that hints where you grew up', COURT: 'Where a judge presides', EASY: 'Like pie, in a saying',
          PACE: 'Walk back and forth nervously', COCOA: 'Hot drink with marshmallows', CIRCUS: 'Big top show', ARTERY: 'Blood vessel from the heart', SCENT: 'What a hound follows', HART: 'Male deer',
        },
      },
      {
        id: 's2-signal', title: 'Lost Signal', level: 2,
        grid: ['##LOST', '#FORCE', 'MEDIAN', 'ANGELS', 'SCENE#', 'TEST##'],
        clues: {
          LOST: 'Without a map or a clue', FORCE: 'Push hard', MEDIAN: 'Strip between highway lanes', ANGELS: 'Haloed beings', SCENE: 'Part of a movie', TEST: 'Quiz',
          MAST: 'Sailboat pole', FENCE: 'Backyard barrier', LODGES: 'Ski resort cabins', ORIENT: 'Get one’s bearings', SCALE: 'Bathroom weighing device', TENS: 'Perfect scores',
        },
      },
      {
        id: 's2-fact', title: 'Fact Check', level: 2,
        grid: ['##FACT', '#FOLIO', 'WORLDS', 'ARMIES', 'STEER#', 'HERD##'],
        clues: {
          FACT: 'Something checked by an editor', FOLIO: 'Portfolio, without the port', WORLDS: 'Planets, in science fiction', ARMIES: 'Large groups of soldiers', STEER: 'Guide, as a car', HERD: 'Group of cattle',
          WASH: 'Laundry load', FORTE: 'Strong point', FORMER: 'Ex-', ALLIED: 'Joined together', CIDER: 'Fall drink made from apples', TOSS: 'Coin ___',
        },
      },
      {
        id: 's2-power', title: 'Power Grid', level: 2,
        grid: ['FIR#ROT', 'EVE#EAR', 'DYNASTY', '##EGO##', 'POWERED', 'ERA#TEA', 'GEL#SLY'],
        clues: {
          FIR: 'Christmas tree type', ROT: 'Spoil', EVE: 'Night before a holiday', EAR: 'Corn unit', DYNASTY: 'Ruling family over generations', EGO: 'Self-image',
          POWERED: 'Switched on and running', ERA: 'Historical period', TEA: 'Earl Grey, for one', GEL: 'Hair product', SLY: 'Like a fox',
          FED: 'Gave dinner to', PEG: 'Coat hook', IVY: 'Climbing plant on old campus walls', ORE: 'Mined rock', RENEWAL: 'Library book extension', AGE: 'Candles on a cake show it',
          RESORTS: 'Vacation spots', OAT: 'Granola grain', EEL: 'Slippery fish', TRY: 'Attempt', DAY: 'Twenty-four hours',
        },
      },
    ],
  },
  {
    id: 's3', name: 'The Mainframe', blurb: 'The toughest clues guard the core. Bring the mainframe back online.',
    puzzles: [
      {
        id: 's3-weather', title: 'Weather Report', level: 3,
        grid: ['GUT#HUG', 'ASH#ERA', 'SEEKING', '##RIG##', 'WEATHER', 'IMP#TEA', 'GUY#SLY'],
        clues: {
          GUT: 'Instinct, so to speak', HUG: 'Squeeze that says hello', ASH: 'What’s left after the fire', ERA: 'Stretch of history', SEEKING: 'Hide-and-___', RIG: 'Truck with 18 wheels',
          WEATHER: 'Forecast topic', IMP: 'Little mischief-maker', TEA: 'Afternoon cuppa', GUY: 'Fellow', SLY: 'Cunning',
          GAS: 'Fuel at a pump', WIG: 'Hairpiece', USE: 'Put to work', EMU: 'Flightless bird from Australia', THERAPY: 'Couch session?', KIT: 'First aid ___',
          HEIGHTS: 'What acrophobes fear', URN: 'Big coffee container', EEL: 'Sushi fish', GAG: 'Joke', RAY: 'Beam of sunlight',
        },
      },
      {
        id: 's3-news', title: 'Newsroom', level: 3,
        grid: ['ELK#TAP', 'RAN#AGO', 'ADOPTED', '##WIT##', 'EDITORS', 'BUN#OAK', 'BEG#SPY'],
        clues: {
          ELK: 'Antlered animal', TAP: 'Faucet', RAN: 'Was a candidate', AGO: 'Back then', ADOPTED: 'Took in, as a shelter pet', WIT: 'Quick humor',
          EDITORS: 'People who cut stories down to size', BUN: 'Burger holder', OAK: 'Tree from an acorn', BEG: 'Ask for a treat, as a dog', SPY: 'Secret agent',
          ERA: 'Age', EBB: 'Tide’s retreat', LAD: 'Young fellow', DUE: 'Expected', KNOWING: 'Like a wink that says “I get it”', PIT: 'Cherry stone',
          TATTOOS: 'Ink on skin', AGE: 'Get older', RAP: 'Knock on a door', POD: 'Pea’s home', SKY: 'Where clouds drift',
        },
      },
      {
        id: 's3-puppy', title: 'Puppy Love', level: 3,
        grid: ['YEW#ICE', 'EAR#NAG', 'STATING', '##POT##', 'PUPPIES', 'IRE#ARK', 'END#LAY'],
        clues: {
          YEW: 'Evergreen used for archery bows', ICE: 'Rink surface', EAR: 'Something lent to a friend in need', NAG: 'Pester', STATING: 'Putting into words', POT: 'Poker prize',
          PUPPIES: 'Litter of future good boys', IRE: 'Wrath', ARK: 'Noah’s boat', END: 'Finale', LAY: 'Put down gently',
          YES: '“Absolutely”', PIE: 'Dessert with a crust', EAT: 'Dine', URN: 'Decorative vase', WRAPPED: 'Like a present', TOP: 'Spinning toy',
          INITIAL: 'First letter of a name', CAN: 'Soup container', ERA: 'Dinosaur ___', EGG: 'Omelet ingredient', SKY: 'The limit, in a saying',
        },
      },
      {
        id: 's3-pattern', title: 'Pattern Match', level: 3,
        grid: ['LEG#EAT', 'IRE#TIE', 'PATTERN', '##TAR##', 'ALIGNED', 'WON#AGE', 'EGG#LOW'],
        clues: {
          LEG: 'Stage of a relay or a journey', EAT: 'Have a bite', IRE: 'Anger', TIE: 'It may be knotted at the neck', PATTERN: 'Repeating design', TAR: 'Road goo',
          ALIGNED: 'Lined up', WON: 'Came out on top', AGE: 'Number on a birthday card', EGG: 'Hatchery item', LOW: 'Like a battery that needs a charge',
          LIP: 'Back talk', AWE: 'Wonder', ERA: 'The Jazz Age, for one', LOG: 'Record of system events', GETTING: 'Understanding, as a joke', TAG: 'Playground chase game',
          ETERNAL: 'Without end', AIR: 'What tires and lungs hold', EGO: 'Sense of self', TEN: 'Number of digits on two hands', DEW: 'Morning moisture on grass',
        },
      },
    ],
  },
];

export const ALL: PuzzleDef[] = [...LIBRARY, ...SECTORS.flatMap((s) => s.puzzles)];
export const byId: Record<string, PuzzleDef> = Object.fromEntries(ALL.map((p) => [p.id, p]));

export type Where = { kind: 'library' } | { kind: 'campaign'; sector: Sector; index: number };
export function locate(id: string): Where {
  for (const sector of SECTORS) {
    const index = sector.puzzles.findIndex((p) => p.id === id);
    if (index >= 0) return { kind: 'campaign', sector, index };
  }
  return { kind: 'library' };
}
export const sectorDone = (s: Sector, solved: Set<string>) => s.puzzles.every((p) => solved.has(p.id));
/** The first sector is always open; each later one opens when the previous is done. */
export const sectorOpen = (s: Sector, solved: Set<string>) => {
  const k = SECTORS.indexOf(s);
  return k <= 0 || sectorDone(SECTORS[k - 1], solved);
};
export const campaignDone = (solved: Set<string>) => SECTORS.every((s) => sectorDone(s, solved));

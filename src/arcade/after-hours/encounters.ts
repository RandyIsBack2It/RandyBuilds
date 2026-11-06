// Bad Decisions: the encounters. Each option returns an Outcome with real
// effects (chaos, cash, dignity, items, buffs, enemies, shortcuts, flags).
// Flags come back later: an angry ex, a bouncer with a crush, a raccoon ally,
// a limo bill, a tip about the boss. To add an encounter, add an entry here
// and name its id in a zone slot (zones.ts). tests/after-hours.mjs checks
// that every option of every encounter changes something.

export type Flag =
  | 'exJealous' | 'exConfused' | 'exBlocked' | 'bouncerCrush' | 'bouncerAngry' | 'guardsAlert' | 'djSecret'
  | 'advice' | 'tiara' | 'bossTip' | 'raccoonFriend' | 'limo' | 'express' | 'flattered' | 'unplugged' | 'hotTub';

export type Item = 'glass' | 'heel' | 'cone';
export type Buff = 'courage' | 'speed' | 'spotlight';
export type Spawn = 'ex' | 'guard' | 'rats' | 'bouncer' | 'cook' | 'cash';

export interface Outcome {
  text: string;
  chaos?: number;
  cash?: number;
  /** Set cash to exactly this (e.g. "your last dollars"). */
  cashTo?: number;
  dignity?: number;
  score?: number;
  flags?: Flag[];
  item?: Item;
  buff?: Buff;
  spawn?: Spawn[];
  /** Jump this many tiles ahead (a shortcut). */
  skip?: number;
  /** Jump to the end of the zone. */
  skipZone?: boolean;
}

export interface Ctx {
  cash: number;
  chaos: number;
  dignity: number;
  flags: ReadonlySet<Flag>;
  rnd: () => number;
}

export type Who = 'phone' | 'bouncer' | 'dj' | 'stranger' | 'bride' | 'marge' | 'mom' | 'machine' | 'limo' | 'trench' | 'raccoon' | 'elevator' | 'boss';

export interface Option { label: string; run: (c: Ctx) => Outcome }
export interface Encounter {
  id: string;
  who: Who;
  /** Name shown over the dialog. */
  speaker: string;
  /** Triggers on its own when Viv walks past (otherwise: talk to the character). */
  auto?: boolean;
  prompt: (c: Ctx) => string;
  options: [Option, Option, Option];
}

const wild = (c: Ctx) => c.chaos >= 60;

export const ENCOUNTERS: Encounter[] = [
  {
    id: 'ex-text', who: 'phone', speaker: 'PHONE · 23%', auto: true,
    prompt: () => 'It buzzes. Your ex, Brad: “You up?”',
    options: [
      { label: '“New phone. Who dis?”', run: () => ({ text: 'Three dots. Then nothing. Then three dots. Brad is buffering.', chaos: 5, flags: ['exConfused'] }) },
      { label: 'Send a selfie with someone else.', run: () => ({ text: 'You crop in a stranger’s elbow. Brad has seen it. Brad is putting on shoes.', chaos: 15, score: 200, flags: ['exJealous'] }) },
      { label: 'Block the number. Everything is fine.', run: () => ({ text: 'Blocked. You feel growth. It lasts eleven seconds.', chaos: -5, dignity: 1, flags: ['exBlocked'] }) },
    ],
  },
  {
    id: 'bouncer', who: 'bouncer', speaker: 'THE BOUNCER', auto: true,
    prompt: (c) => (wild(c) ? 'The bouncer has already heard about you. From the police scanner. “Absolutely not.”' : 'He checks the list. He checks you. He checks the list again. “Not tonight.”'),
    options: [
      { label: '“I’m actually the entertainment.”', run: () => ({ text: 'He shoves you through the stage door. The crowd wants a show. Cash rains. Security takes notes.', chaos: 10, buff: 'spotlight', spawn: ['cash'], flags: ['guardsAlert'] }) },
      {
        label: 'Attempt shameless flirting.',
        run: (c) => (c.rnd() < 0.55
          ? { text: 'He blushes. Two hundred pounds of man, blushing. “Go on in. Text me.”', chaos: 5, flags: ['bouncerCrush'] }
          : { text: '“I am a professional.” He cracks his knuckles. Professionally.', chaos: 15, spawn: ['bouncer'], flags: ['bouncerAngry'] }),
      },
      {
        label: 'Offer your last $20.',
        run: (c) => (c.cash >= 20
          ? { text: 'He pockets it without blinking. Capitalism wins again.', cash: -20 }
          : { text: `You offer $${c.cash} and a gum wrapper. He laughs so hard he lets you in.`, cashTo: 0, chaos: 5 }),
      },
    ],
  },
  {
    id: 'dj', who: 'dj', speaker: 'DJ NO-REGRETS',
    prompt: () => 'The DJ leans over the decks. “I know what you did in 2019.”',
    options: [
      { label: 'Request “our song.”', run: (c) => (c.flags.has('exJealous') || c.flags.has('exConfused')
        ? { text: 'Brad hears it from three blocks away. He is running. Toward you.', chaos: 10, spawn: ['ex'] }
        : { text: 'It slaps. Nobody you used to date appears. A miracle.', score: 300, dignity: 1 }) },
      { label: 'Ask what he knows.', run: () => ({ text: '“The alley. The fire escape. Look up.” He winks. He knows far too much.', chaos: 5, flags: ['djSecret'], score: 100 }) },
      { label: 'Steal his headphones.', run: () => ({ text: 'You run. The bass drops. So does security.', chaos: 15, score: 400, spawn: ['guard'] }) },
    ],
  },
  {
    id: 'drink', who: 'stranger', speaker: 'GOLD SUIT GUY',
    prompt: (c) => (wild(c) ? 'A man in a gold suit slides you a drink. It is glowing. It is humming. It knows your name.' : 'A man in a gold suit slides you a drink. It is glowing. Gently.'),
    options: [
      { label: 'Drink it.', run: () => ({ text: 'Liquid Courage. You can hear colors. You can punch them, too.', chaos: 10, buff: 'courage' }) },
      { label: 'Pour it on his shoes.', run: () => ({ text: 'His shoes cost more than your car. Security agrees.', chaos: 15, score: 200, spawn: ['guard'] }) },
      { label: 'Order water like an adult.', run: () => ({ text: '“Water? In this economy?” That’s $5.', chaos: -5, dignity: 1, cash: -5 }) },
    ],
  },
  {
    id: 'bachelorette', who: 'bride', speaker: 'THE BRIDE',
    prompt: () => 'A bachelorette party adopts you. The bride is crying and holding an inflatable sword.',
    options: [
      { label: 'Join the conga line.', run: () => ({ text: 'The conga line carries you across the club. You did not agree to this. You had fun.', chaos: 10, score: 300, skip: 14 }) },
      { label: 'Steal the tiara.', run: () => ({ text: 'Long live the queen. Her bridesmaids called security. Run.', chaos: 20, cash: 15, flags: ['tiara'], spawn: ['guard'] }) },
      { label: 'Give her terrible advice.', run: () => ({ text: '“Marry for the snacks.” She nods slowly. A wedding may be ruined.', chaos: 10, score: 200, flags: ['advice'] }) },
    ],
  },
  {
    id: 'marge', who: 'marge', speaker: 'MARGE · REGRET DINER', auto: true,
    prompt: () => 'Marge pours coffee you didn’t order. “Special tonight is the Mystery Meatloaf. It’s a mystery to us too.”',
    options: [
      { label: 'Order the meatloaf.', run: (c) => (c.rnd() < 0.7
        ? { text: 'It tastes like regret and paprika. You feel restored. Spiritually, mostly.', dignity: 2, cash: -8 }
        : { text: 'It fights back. You win, barely. Your stomach files a complaint.', dignity: 1, chaos: 10, cash: -8 }) },
      { label: 'Dine and dash.', run: () => ({ text: 'The cook vaults the counter with a spatula. He has done this before.', chaos: 15, cash: 8, spawn: ['cook'] }) },
      { label: 'Ask for life advice.', run: () => ({ text: '“Men in robes are all ego, hon. Hit ’em while they’re talking about themselves.”', chaos: -5, flags: ['bossTip'] }) },
    ],
  },
  {
    id: 'mom', who: 'mom', speaker: 'BRAD’S MOM',
    prompt: () => 'Your ex’s mom is in booth four. She has seen you. She is waving with both hands.',
    options: [
      { label: 'Hide under the table.', run: () => ({ text: 'She joins you under the table. She has photos. So many photos.', chaos: 5, score: 250 }) },
      { label: 'Hug her and cry.', run: () => ({ text: 'She slips you twenty dollars and a casserole recipe. You feel adopted.', dignity: -1, cash: 20 }) },
      { label: 'Tell her the truth about her son.', run: () => ({ text: 'She calls him. On speaker. He’s nearby. He is always nearby.', chaos: 20, flags: ['exJealous'], spawn: ['ex'] }) },
    ],
  },
  {
    id: 'fortune', who: 'machine', speaker: 'MADAME FORTUNA 3000',
    prompt: () => 'A fortune machine glows by the restrooms. INSERT $5 FOR YOUR DESTINY.',
    options: [
      { label: 'Pay $5.', run: (c) => {
        if (c.cash < 5) return { text: `You are $${5 - c.cash} short of a destiny. The machine laughs. In MIDI.`, chaos: 5 };
        const r = c.rnd();
        if (r < 0.34) return { text: 'YOUR DESTINY: A SNACK. A lipstick-red jawbreaker drops out. You feel better.', cash: -5, dignity: 2 };
        if (r < 0.67) return { text: 'YOUR DESTINY: FOOTWEAR. A single heel drops out. It hums with power.', cash: -5, item: 'heel' };
        return { text: 'YOUR DESTINY: INNER PEACE. Ha. Just kidding. But you do feel calmer.', cash: -5, chaos: -15 };
      } },
      { label: 'Kick it.', run: (c) => (c.rnd() < 0.6
        ? { text: 'Coins everywhere. Destiny, but make it vandalism.', chaos: 10, cash: 12 }
        : { text: 'It shocks you. Destiny bites back.', chaos: 10, cash: 6, dignity: -1 }) },
      { label: 'Walk away.', run: () => ({ text: 'It prints a ticket anyway. It says COWARD. You keep it.', chaos: -5, score: 50 }) },
    ],
  },
  {
    id: 'limo', who: 'limo', speaker: 'A SUSPICIOUS LIMO', auto: true,
    prompt: () => 'A limousine pulls up. The window lowers two inches. A voice: “Hop in, superstar.”',
    options: [
      { label: 'Get in. What could go wrong?', run: () => ({ text: 'Free ride! The meter says otherwise. The driver will find you.', chaos: 15, score: 500, flags: ['limo'], skipZone: true }) },
      { label: 'Ask if there’s a minibar.', run: () => ({ text: 'There is. You take all of it. The limo leaves, honking sadly.', chaos: 10, item: 'glass' }) },
      { label: 'Run away screaming.', run: () => ({ text: 'You run faster than you ran from your last commitment.', buff: 'speed', score: 100 }) },
    ],
  },
  {
    id: 'trench', who: 'trench', speaker: 'TRENCH COAT GUY',
    prompt: () => 'A man opens his trench coat. Watches. Dozens of watches. “Psst. Want a watch?”',
    options: [
      { label: 'Buy one ($10).', run: (c) => (c.cash >= 10
        ? { text: 'It’s just a watch. It says 3:12. Honestly accurate.', cash: -10, score: 400 }
        : { text: 'You can’t afford a watch. He gives you one anyway. Out of pity.', score: 150, chaos: 5 }) },
      { label: 'Check the other side of the coat.', run: () => ({ text: 'There’s a traffic cone in there. Why. You take it.', chaos: 5, item: 'cone' }) },
      { label: 'Call the cops.', run: () => ({ text: 'He IS the cops. Undercover. Very badly.', chaos: 15, spawn: ['guard', 'guard'] }) },
    ],
  },
  {
    id: 'raccoon', who: 'raccoon', speaker: 'A RACCOON',
    prompt: () => 'A raccoon guards an entire pizza. It looks at you like it pays rent here.',
    options: [
      { label: 'Fight the raccoon.', run: () => ({ text: 'The raccoon has friends. The raccoon has so many friends.', chaos: 10, score: 200, spawn: ['rats'] }) },
      { label: 'Share the pizza.', run: () => ({ text: 'Fifty-fifty. A bond is formed. It will remember this.', dignity: 1, flags: ['raccoonFriend'] }) },
      { label: 'Eat it in front of him.', run: () => ({ text: 'Delicious. The raccoon has started a group chat about you.', dignity: 2, chaos: 15, spawn: ['rats'] }) },
    ],
  },
  {
    id: 'battery', who: 'phone', speaker: 'PHONE · 1%', auto: true,
    prompt: () => 'Battery at 1%. One last text. Choose wisely. You won’t.',
    options: [
      { label: 'Text your ex: “u up?”', run: (c) => ({ text: c.flags.has('exBlocked') ? 'You unblocked him. Of course you did. He’s on his way.' : 'Delivered. Read. He’s on his way.', chaos: 15, flags: ['exJealous'], spawn: ['ex'] }) },
      { label: 'Text Mom: “I love you.”', run: () => ({ text: 'She replies instantly: “What did you do.”', dignity: 2, chaos: -10 }) },
      { label: 'Post a blurry story.', run: () => ({ text: '17 views. One is your landlord.', score: 500, chaos: 10 }) },
    ],
  },
  {
    id: 'elevator', who: 'elevator', speaker: 'ELEVATOR ATTENDANT', auto: true,
    prompt: () => 'The elevator attendant adjusts his tiny hat. “Which floor?”',
    options: [
      { label: '“Penthouse. Obviously.”', run: () => ({ text: 'Smooth ride. Smooth jazz. You almost feel classy.', score: 200 }) },
      { label: '“All of them.”', run: () => ({ text: 'Floor 9: a wedding. Floor 12: free shrimp. You take both.', chaos: 10, cash: 10, dignity: 1 }) },
      { label: 'Flirt with the elevator.', run: () => ({ text: 'It’s an elevator. It does not care. It goes express anyway. Security never sees you.', chaos: 20, score: 600, flags: ['express'] }) },
    ],
  },
  {
    id: 'lorenzo', who: 'boss', speaker: 'LORENZO VELOUR', auto: true,
    prompt: () => 'A self-proclaimed love guru rises from a hot tub in a velour robe. “Welcome… to the Hot Tub of Truth.”',
    options: [
      { label: 'Get in the hot tub.', run: () => ({ text: 'It’s lukewarm. Like his podcast. He is furious you noticed.', chaos: 15, score: 1000, flags: ['hotTub'] }) },
      { label: 'Compliment his robe.', run: () => ({ text: '“It’s velour,” he whispers, flattered. His guard drops. Just a little.', chaos: 5, flags: ['flattered'] }) },
      { label: 'Unplug the hot tub.', run: () => ({ text: 'The jets die. So does some of his confidence.', chaos: 10, flags: ['unplugged'] }) },
    ],
  },
];

export const encounterById = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, e])) as Record<string, Encounter>;

/** True if an outcome changes the game state (every option must). */
export const hasEffect = (o: Outcome) =>
  !!(o.chaos || o.cash || o.cashTo !== undefined || o.dignity || o.score || o.flags?.length || o.item || o.buff || o.spawn?.length || o.skip || o.skipZone);

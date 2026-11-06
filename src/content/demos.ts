// Everything on /work/ and /arcade/ (and the featured concepts in the home #work panel).
// Independent projects and concepts come from projects.ts automatically
// (a concept needs a `demoUrl` and `demo` details); tools and games are
// listed in `tools` below. `group` decides the section on /work/, in the
// order of `groups`; games are not on /work/ but on /arcade/, kept separate.
//
// Honesty rules (CLAUDE.md): only demos that exist and work; concepts are
// fictional businesses and say so; `interactive` lists only features that
// really respond; any action that would send something is simulated and
// says so. Private client previews (/preview/, /clients/) never appear here.
import { projects, kindLabel, type ProjectKind } from './projects';

export type DemoType = ProjectKind | 'tool' | 'game';
// Two customer-facing sections on /work/ (Randy, 2026-10-22): business
// websites, then custom applications and interactive tools. Games are on /arcade/.
export type DemoGroup = 'websites' | 'apps' | 'games';

export const groups: { id: DemoGroup; title: string; lede: string; kicker: string }[] = [
  { id: 'websites', kicker: 'business websites', title: 'Business websites', lede: 'Straightforward, professional websites for local businesses. Each one is a working concept: open it on your phone or computer and try it.' },
  { id: 'apps', kicker: 'applications / tools', title: 'Custom applications and interactive tools', lede: 'Ordering, booking, product configuration and office software, plus a live product of my own. Everything responds; nothing is sent or charged.' },
];

/** Old /work/ section ids, kept as anchors so existing links still land in the right place. */
export const groupAliases: Record<string, DemoGroup> = { independent: 'apps', products: 'apps', tools: 'apps', concepts: 'websites' };

export interface Demo {
  slug: string;
  title: string;
  /** One sentence for cards. */
  description: string;
  category: string;
  type: DemoType;
  group: DemoGroup;
  /** Shown on the card: what it is and whether it can be used. */
  status: string;
  image: { src: string; alt: string; width: number; height: number };
  /** The kind of business problem it could solve. */
  solves?: string;
  /** Features a visitor can actually try. */
  features: string[];
  /** Where the working demo opens. */
  url: string;
  /** What happens when a visitor submits something. */
  simulated?: string;
  /** Write-up, if there is one. */
  detailsUrl?: string;
  /** Button text (default “Explore demo”). */
  cta?: string;
  /** A public site, for real projects. */
  liveUrl?: string;
  /** Heading for `features` (default “What you can try”). */
  featuresLabel?: string;
  /** A short content note shown on the card (e.g. “Mature humor”). */
  badge?: string;
  /** Position among the home page's featured demos (lower first); omit to leave it off the home page. */
  featured?: number;
  order: number;
}

export const typeLabel: Record<DemoType, string> = { ...kindLabel, tool: 'Built for this site', game: 'Original game' };

const fromProjects: Demo[] = projects
  .filter((p) => p.shots?.[0] && (p.kind === 'independent' || (p.demoUrl && p.demo)))
  .map((p) => {
    const image = { src: p.shots![0].src.replace(/desktop\.jpg$/, 'card.jpg'), alt: p.shots![0].alt, width: 720, height: 450 };
    if (p.kind === 'independent') {
      return {
        slug: p.slug, title: p.title, description: p.tagline ?? p.summary, category: 'Web application', type: p.kind, group: 'apps' as const,
        status: 'Live product', image, solves: 'Shows a complete product: accounts, messaging, admin tools and the servers it runs on.', features: p.built.slice(0, 5), featuresLabel: 'What I built', url: `/work/${p.slug}/`, cta: 'Read about this project',
        liveUrl: p.liveUrl, order: p.order,
      };
    }
    return {
      slug: p.slug, title: p.title, description: p.tagline ?? p.summary, category: p.demo!.category, type: p.kind, group: (p.demo!.group ? 'apps' : 'websites') as DemoGroup,
      status: 'Interactive demo', image, solves: p.demo!.solves, features: p.demo!.features, url: p.demoUrl!, simulated: p.demo!.simulated,
      detailsUrl: p.notes?.length ? `/work/${p.slug}/` : undefined, featured: p.demo!.featured, order: p.order,
    };
  });

const tools: Demo[] = [
  {
    slug: 'explore',
    title: 'Explore what’s possible',
    description: 'A short questionnaire that suggests where to start, from a first website to hosting, with working examples.',
    solves: 'The same approach works for quote builders, intake forms and product finders.',
    category: 'Interactive tool',
    type: 'tool',
    group: 'apps',
    status: 'Live on this site',
    image: { src: '/work/explore/card.jpg', alt: 'Explore what’s possible: three suggestions with the reasons they fit', width: 720, height: 450 },
    features: [
      'One question at a time, with follow-up questions only when they apply',
      'Suggestions that change with the answers, each with a reason',
      'Answers that can be changed from the results',
      'A message form with the answers filled in',
    ],
    url: '/explore/',
    simulated: 'Nothing is sent unless you choose to send a message.',
    order: 10,
  },
  {
    slug: 'patch-quest',
    title: 'PATCH QUEST',
    description: 'A retro-inspired adventure through a corrupted digital world. Built to demonstrate interactive game design and browser-based development.',
    category: 'Browser game',
    type: 'game',
    group: 'games',
    status: 'Playable, 3 levels',
    image: { src: '/work/patch-quest/card.jpg', alt: 'PATCH QUEST: Patch the repair robot in a pixel-art circuit world', width: 720, height: 450 },
    features: [
      'Platforming with three levels and a boss',
      'Keyboard, touch and gamepad controls',
      'Original pixel art and chiptune music, made in code',
      'Personal best saved on your device',
    ],
    url: '/arcade/patch-quest/',
    cta: 'Play game',
    order: 11,
  },
  {
    slug: 'after-hours',
    title: 'AFTER HOURS: Bad Decisions',
    description: 'One night. Zero self-control. Endless consequences. A neon arcade brawler where every choice makes things worse.',
    category: 'Browser game',
    type: 'game',
    group: 'games',
    status: 'Playable, 4 areas and a boss',
    badge: 'Mature humor',
    image: { src: '/work/after-hours/card.jpg', alt: 'AFTER HOURS: a neon nightclub street at night in pixel art', width: 720, height: 450 },
    features: [
      'Side-scrolling brawling with dodge rolls and thrown weapons',
      'Fourteen bad decisions with consequences that come back later',
      'A Chaos meter that raises your score and the danger',
      'Several endings, achievements and a boss in a hot tub',
    ],
    url: '/arcade/after-hours/',
    cta: 'Play game',
    order: 12,
  },
  {
    slug: 'cross-wire',
    title: 'CROSS//WIRE',
    description: 'Solve crosswords, restore circuits, and bring a broken digital network back online.',
    category: 'Browser game',
    type: 'game',
    group: 'games',
    status: 'Playable, 24 puzzles and a Daily Circuit',
    image: { src: '/work/cross-wire/card.jpg', alt: 'CROSS//WIRE: a crossword grid glowing on a dark circuit board', width: 720, height: 450 },
    features: [
      'Mini crosswords, a three-sector campaign and a Daily Circuit',
      'Every correct answer lights a trace on the circuit board',
      'Optional hints, with assisted and unassisted solves kept apart',
      'Made for phones as well as keyboards',
    ],
    url: '/arcade/cross-wire/',
    cta: 'Play game',
    order: 13,
  },
];

export const demos: Demo[] = [...fromProjects, ...tools].sort((a, b) => a.order - b.order);
export const featuredDemos = demos.filter((d) => d.featured !== undefined).sort((a, b) => a.featured! - b.featured!);
export const demosIn = (g: DemoGroup) => demos.filter((d) => d.group === g);
/** What /work/ shows: everything except games (those are on /arcade/). */
export const workDemos = demos.filter((d) => d.group !== 'games');
export const demoBySlug = Object.fromEntries(demos.map((d) => [d.slug, d]));

/** Examples a visitor can name in an inquiry: real projects and concepts, not tools or games. */
export const inquiryDemos = workDemos.filter((d) => d.type !== 'tool');

/** Where "Discuss a similar project" points: the form on /work/, with the example chosen. */
export const similarHref = (slug: string) => `/work/?similar=${slug}#similar`;

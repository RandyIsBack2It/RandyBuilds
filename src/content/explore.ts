// "Explore what's possible" (/explore/): the questions, the possibilities they
// can point to, and the rules that connect them. Pure data and functions, no
// imports, so tests/explore.mjs can load this file directly in Node.
//
// How recommendations work: every answer adds weight to some possibilities
// (WEIGHTS). Possibilities that need something the visitor doesn't have are
// ruled out first (allowed()). The two or three highest scores are shown, and
// each one explains itself with the answers that weighed most for it.
// Copy rules: nothing here may claim a site was reviewed, assume a problem
// with it, or promise traffic, sales or growth. Service links only point at
// existing service pages; `demo` names a working example on /work/
// (content/demos.ts slug), never a private preview or a game.

export type StepId = 'stage' | 'start' | 'have' | 'goals' | 'offer' | 'users' | 'focus';
export type Answers = Partial<Record<StepId, string[]>>;

export interface Option { value: string; label: string }
export interface Step {
  id: StepId;
  question: string;
  hint?: string;
  /** Checkboxes, up to this many; otherwise one choice. */
  max?: number;
  /** A value that can't be combined with others ("I'm not sure yet"). */
  exclusive?: string;
  /** Follow-up questions appear only when they change the result. */
  when?: (a: Answers) => boolean;
  options: Option[];
}

export const steps: Step[] = [
  {
    id: 'stage',
    question: 'What are you working on?',
    options: [
      { value: 'existing', label: 'An existing business or organization' },
      { value: 'new', label: 'Something new I’m starting' },
      { value: 'personal', label: 'A personal or independent project' },
      { value: 'exploring', label: 'I’m just exploring' },
    ],
  },
  {
    id: 'start',
    question: 'Where are you starting?',
    options: [
      { value: 'have', label: 'I already have a website or digital product' },
      { value: 'scratch', label: 'I’m starting from scratch' },
      { value: 'unsure', label: 'I’m not sure yet' },
    ],
  },
  {
    id: 'have',
    question: 'What do you have now?',
    when: (a) => has(a, 'start', 'have'),
    options: [
      { value: 'site', label: 'A website' },
      { value: 'app', label: 'A web app or online tool' },
      { value: 'social', label: 'A social media page or online listing' },
      { value: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'goals',
    question: 'What would you like to accomplish?',
    hint: 'Choose up to two.',
    max: 2,
    exclusive: 'unsure',
    options: [
      { value: 'reach', label: 'Reach more people' },
      { value: 'connect', label: 'Make it easier for people to connect with me' },
      { value: 'simplify', label: 'Simplify how things get done' },
      { value: 'offer', label: 'Offer something online' },
      { value: 'idea', label: 'Bring an idea to life' },
      { value: 'maintain', label: 'Keep my site up to date and working' },
      { value: 'launch', label: 'Get my site or app online, or move where it runs' },
      { value: 'unsure', label: 'I’m not sure yet' },
    ],
  },
  {
    id: 'offer',
    question: 'What would people do online?',
    when: (a) => has(a, 'goals', 'offer'),
    options: [
      { value: 'order', label: 'Order or request something' },
      { value: 'book', label: 'Book an appointment or a table' },
      { value: 'customize', label: 'Choose options and see the price' },
      { value: 'account', label: 'Sign in to an account or members’ area' },
      { value: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'users',
    question: 'Who would use it most?',
    when: (a) => has(a, 'goals', 'simplify'),
    options: [
      { value: 'team', label: 'Me, or the people I work with' },
      { value: 'public', label: 'Customers, members or visitors' },
      { value: 'both', label: 'Both' },
    ],
  },
  {
    id: 'focus',
    question: 'What matters most right now?',
    options: [
      { value: 'simple', label: 'Starting with something straightforward' },
      { value: 'improve', label: 'Improving something I already have' },
      { value: 'specific', label: 'Building something around a specific need' },
      { value: 'options', label: 'Understanding my options' },
    ],
  },
];

export type RecId =
  | 'site' | 'improve' | 'contact' | 'requests' | 'booking' | 'configurator' | 'portal'
  | 'internal' | 'features' | 'prototype' | 'manage' | 'hosting';

export interface Rec {
  id: RecId;
  title: string;
  /** What it is. */
  what: string;
  /** What it might help with. Never a guarantee. */
  helps: string;
  example: string;
  /** Used when no answer points at it (a fallback pick). */
  fallbackWhy: string;
  service: string;
  /** A working example on /work/ (content/demos.ts slug), when one fits. */
  demo?: string;
}

export const recs: Record<RecId, Rec> = {
  site: {
    id: 'site',
    title: 'A simple website or landing page',
    what: 'A small site, or a single page, that explains what you do and how to reach you.',
    helps: 'It gives people one clear place to learn about you and get in touch.',
    example: 'A one-page site with a short introduction, what you offer and a contact form.',
    fallbackWhy: 'It’s a small place to start, and it can grow later.',
    service: 'websites',
    demo: 'auto-repair',
  },
  improve: {
    id: 'improve',
    title: 'A redesign or focused improvements',
    what: 'A new look or a clearer structure for your current site: a full rebuild, or changes to the parts that matter most.',
    helps: 'You keep what already works and change what you want changed.',
    example: 'A clearer home page, simpler navigation or a better layout on phones.',
    fallbackWhy: 'It builds on what you already have.',
    service: 'redesigns',
  },
  contact: {
    id: 'contact',
    title: 'Easier ways for people to reach you',
    what: 'A contact or inquiry form that asks a few useful questions and sends each message to your inbox.',
    helps: 'People can get in touch quickly, and you get the details you need to reply.',
    example: 'An inquiry form that asks what someone needs and how to reach them.',
    fallbackWhy: 'Most sites and projects need a simple way to be contacted.',
    service: 'websites',
    demo: 'landscaping',
  },
  requests: {
    id: 'requests',
    title: 'A simple request or ordering system',
    what: 'An online form or small app where people can request, order or sign up for what you offer.',
    helps: 'Requests arrive in one place, with the same details every time.',
    example: 'Online ordering for pickup or delivery, quote requests or event sign-ups.',
    fallbackWhy: 'It’s a practical way to offer something online.',
    service: 'web-apps',
    demo: 'ember-rye',
  },
  booking: {
    id: 'booking',
    title: 'Online booking',
    what: 'A booking page where people choose a service, a time and, if you like, a person or a table.',
    helps: 'People can book when it suits them, and you see every booking in one place.',
    example: 'Appointment booking with intake questions, or restaurant table reservations.',
    fallbackWhy: 'It fits work that runs on appointments or reservations.',
    service: 'web-apps',
    demo: 'cove',
  },
  configurator: {
    id: 'configurator',
    title: 'An interactive product builder',
    what: 'A tool where customers choose options, see a preview and see the price change as they go.',
    helps: 'Common questions about options, price and fit are answered on the page.',
    example: 'A furniture configurator with a 3D preview, or a price calculator for a custom job.',
    fallbackWhy: 'It fits products and services that come in many versions.',
    service: 'web-apps',
    demo: 'alder-pine',
  },
  portal: {
    id: 'portal',
    title: 'A client portal or members’ area',
    what: 'A part of your site where people sign in to see their own details, bookings, orders or files.',
    helps: 'People can find their own information and make simple changes themselves.',
    example: 'A page where clients see their visits, reschedule or download documents.',
    fallbackWhy: 'It fits services where people come back again and again.',
    service: 'web-apps',
  },
  internal: {
    id: 'internal',
    title: 'A custom dashboard or internal tool',
    what: 'A small web application built around a task you or your team do regularly.',
    helps: 'It can cut repeated manual steps and keep the information in one place.',
    example: 'A dashboard for tracking jobs, orders or members, in place of a shared spreadsheet.',
    fallbackWhy: 'It fits work that follows the same steps each time.',
    service: 'web-apps',
    demo: 'tidewater',
  },
  features: {
    id: 'features',
    title: 'New features for what you already have',
    what: 'Adding features to your web app or tool, or fixing the parts you want fixed.',
    helps: 'Your app can do more without being replaced.',
    example: 'A new form, a report, or an admin page for something you now do by hand.',
    fallbackWhy: 'It builds on what you already have.',
    service: 'existing-projects',
  },
  prototype: {
    id: 'prototype',
    title: 'A first working version of your idea',
    what: 'A small web application with only the core features of your idea.',
    helps: 'You can try the idea with real people before deciding what to build next.',
    example: 'A simple app where people sign up, use one main feature and send feedback.',
    fallbackWhy: 'It’s a small way to try an idea before committing to more.',
    service: 'web-apps',
  },
  manage: {
    id: 'manage',
    title: 'Updates and fixes for your site',
    what: 'Content changes, fixes and small improvements to your live site, whenever you need them.',
    helps: 'You have one person to ask, and each change is quoted before it starts.',
    example: 'New hours and photos, a broken form fixed, or software updates.',
    fallbackWhy: 'Most sites need changes from time to time.',
    service: 'website-management',
  },
  hosting: {
    id: 'hosting',
    title: 'Hosting and deployment',
    what: 'The server and services your site or app needs, set up, connected and deployed.',
    helps: 'Your site or app has a place to run, with a repeatable way to put out new versions.',
    example: 'Moving an app to a new host, with its database, email sending and backups set up.',
    fallbackWhy: 'Every site and app needs somewhere to run.',
    service: 'server-setup',
  },
};

// Why an answer matters, worded to follow "You said …". Answers without a
// phrase ("I'm not sure yet") add nothing.
const because: Partial<Record<StepId, Record<string, string>>> = {
  stage: {
    existing: 'you have an existing business or organization',
    new: 'you’re starting something new',
    personal: 'this is a personal or independent project',
    exploring: 'you’re exploring ideas',
  },
  start: {
    scratch: 'you’re starting from scratch',
  },
  have: {
    site: 'you already have a website',
    app: 'you already have a web app or tool',
    social: 'you have a social media page or listing',
    other: 'you already have something online',
  },
  goals: {
    reach: 'you want to reach more people',
    connect: 'you want it to be easier for people to connect with you',
    simplify: 'you want to simplify how things get done',
    offer: 'you want to offer something online',
    idea: 'you want to bring an idea to life',
    maintain: 'you want to keep your site up to date and working',
    launch: 'you want to get your site or app online, or move where it runs',
  },
  offer: {
    order: 'people would order or request something',
    book: 'people would book an appointment or a table',
    customize: 'people would choose options and see the price',
    account: 'people would sign in to their own account',
  },
  users: {
    team: 'it’s mainly for you or the people you work with',
    public: 'customers, members or visitors would use it',
    both: 'both you and the people you serve would use it',
  },
  focus: {
    simple: 'you’d like to start with something straightforward',
    improve: 'you want to improve what you already have',
    specific: 'you have a specific need in mind',
  },
};

type Weights = Partial<Record<RecId, number>>;
export const WEIGHTS: Partial<Record<StepId, Record<string, Weights>>> = {
  stage: {
    existing: { contact: 1, requests: 1, internal: 1, improve: 1 },
    new: { site: 2, prototype: 1, contact: 1 },
    personal: { site: 1, prototype: 2 },
    exploring: { site: 1, prototype: 1 },
  },
  start: {
    scratch: { site: 2, prototype: 1 },
  },
  have: {
    site: { improve: 3, contact: 1, manage: 1 },
    app: { features: 3, hosting: 1 },
    social: { site: 3, contact: 1 },
    other: { improve: 1, features: 1, manage: 1 },
  },
  goals: {
    reach: { site: 2, improve: 2 },
    connect: { contact: 3, site: 1, requests: 1, booking: 1 },
    simplify: { internal: 2, requests: 1, features: 1, booking: 1 },
    offer: { requests: 1, prototype: 1, booking: 1, configurator: 1 },
    idea: { prototype: 3, site: 1 },
    maintain: { manage: 4, improve: 1, features: 1 },
    launch: { hosting: 4 },
  },
  offer: {
    order: { requests: 4 },
    book: { booking: 4 },
    customize: { configurator: 4 },
    account: { portal: 4 },
    other: { requests: 1, prototype: 2 },
  },
  users: {
    team: { internal: 3 },
    public: { requests: 3, contact: 1, booking: 1, portal: 1 },
    both: { internal: 2, requests: 2, portal: 1 },
  },
  focus: {
    simple: { site: 2, contact: 2, improve: 1, manage: 1, prototype: -1, internal: -1, configurator: -1, portal: -1 },
    improve: { improve: 2, features: 2, contact: 1, manage: 1 },
    specific: { internal: 2, requests: 2, prototype: 1, features: 1, booking: 1, configurator: 1, portal: 1 },
  },
};

// Ties go to the more specific possibility.
const PRIORITY: RecId[] = [
  'features', 'hosting', 'manage', 'improve', 'configurator', 'booking', 'portal',
  'requests', 'internal', 'contact', 'prototype', 'site',
];

export function has(a: Answers, step: StepId, value: string) {
  return a[step]?.includes(value) ?? false;
}

/** Steps that apply to these answers, in order. */
export function activeSteps(a: Answers) {
  return steps.filter((s) => !s.when || s.when(a));
}

/** Drops answers to follow-ups that no longer apply (after a change). */
export function prune(a: Answers): Answers {
  const keep = new Set(activeSteps(a).map((s) => s.id));
  return Object.fromEntries(Object.entries(a).filter(([k]) => keep.has(k as StepId))) as Answers;
}

/** Never suggest building on something the visitor didn't say they have. */
function allowed(id: RecId, a: Answers) {
  const have = a.have?.[0];
  switch (id) {
    case 'improve': return have === 'site' || have === 'other';
    case 'features': return have === 'app' || have === 'other';
    case 'site': return have !== 'site' && have !== 'app';
    // A live site to look after: one they have, or one they said they keep up to date.
    case 'manage': return have === 'site' || have === 'other' || (has(a, 'goals', 'maintain') && !has(a, 'start', 'scratch'));
    // Something to put online: what they have, or what they asked to launch.
    case 'hosting': return have === 'site' || have === 'app' || have === 'other' || has(a, 'goals', 'launch');
    default: return true;
  }
}

export interface Result { rec: Rec; score: number; why: string; reasons: string[] }

export function recommend(input: Answers): Result[] {
  const a = prune(input);
  const score = new Map<RecId, number>();
  const reasons = new Map<RecId, { w: number; text: string }[]>();
  for (const step of activeSteps(a)) {
    for (const value of a[step.id] ?? []) {
      const weights = WEIGHTS[step.id]?.[value] ?? {};
      const text = because[step.id]?.[value];
      for (const [id, w] of Object.entries(weights) as [RecId, number][]) {
        score.set(id, (score.get(id) ?? 0) + w);
        if (w > 0 && text) reasons.set(id, [...(reasons.get(id) ?? []), { w, text }]);
      }
    }
  }
  const rank = (ids: RecId[]) => ids
    .filter((id) => allowed(id, a))
    .sort((x, y) => (score.get(y) ?? 0) - (score.get(x) ?? 0) || PRIORITY.indexOf(x) - PRIORITY.indexOf(y));
  const ranked = rank(PRIORITY).filter((id) => (score.get(id) ?? 0) > 0);
  // Two always; a third only when the answers point at it too.
  let picked = ranked.slice(0, 2);
  if (ranked[2] && (score.get(ranked[2]) ?? 0) >= 3) picked.push(ranked[2]);
  if (picked.length < 2) {
    const fill = rank(a.have ? ['improve', 'features', 'contact', 'site'] : ['site', 'prototype', 'contact']);
    picked = [...new Set([...picked, ...fill])].slice(0, 2);
  }
  return picked.map((id) => {
    const top = (reasons.get(id) ?? []).sort((x, y) => y.w - x.w).slice(0, 2).map((r) => r.text);
    const why = top.length ? `You said ${top.join(' and ')}.` : recs[id].fallbackWhy;
    return { rec: recs[id], score: score.get(id) ?? 0, why, reasons: top };
  });
}

/** Most answers were "not sure": say so, and suggest a conversation. */
export function isUnsure(a: Answers) {
  const unsure = [has(a, 'stage', 'exploring'), has(a, 'start', 'unsure'), has(a, 'goals', 'unsure'), has(a, 'focus', 'options')];
  return unsure.filter(Boolean).length >= 2;
}

export const labelOf = (step: StepId, value: string) =>
  steps.find((s) => s.id === step)?.options.find((o) => o.value === value)?.label ?? value;

/** The editable summary that goes into an inquiry, in plain text. */
export function summarize(a: Answers, results: Result[]) {
  const lines = ['My answers from Explore What’s Possible:'];
  for (const s of activeSteps(a)) {
    const v = a[s.id];
    if (v?.length) lines.push(`- ${s.question} ${v.map((x) => labelOf(s.id, x)).join('; ')}`);
  }
  lines.push('', 'Possibilities I’d like to talk about:');
  for (const r of results) lines.push(`- ${r.rec.title}`);
  return lines.join('\n');
}

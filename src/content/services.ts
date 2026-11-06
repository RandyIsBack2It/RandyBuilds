// The six services, in two groups. Pages: /services/ and /services/<slug>/;
// also the footer. The home page shows the three `categories` below (Randy,
// 2026-10-22); management and infrastructure live on /services/. Facts only — `included` lists are
// limited to what Randy confirmed (2026-10-12): mobile-friendly design, a
// contact form and basic SEO setup for websites. Infrastructure items are
// limited to what his own projects run (Linux, Docker Compose, Caddy/nginx,
// Postgres, Redis, object storage, email sending, DNS/HTTPS, backups,
// deployment). No plans, packages or uptime promises; the only price guidance
// is content/pricing.ts. Ask before
// adding anything else.

export type BuoyColor = 'cobalt' | 'orange' | 'sea' | 'yellow';

export type ServiceGroup = 'build' | 'support';

export const groups: Record<ServiceGroup, { title: string; lede: string }> = {
  build: {
    title: 'Web design and development',
    lede: 'Business websites, custom applications and focused improvements to the site you have.',
  },
  support: {
    title: 'Hosting, infrastructure and support',
    lede: 'Ongoing updates, hosting, and the servers websites and apps run on. Each job is quoted before I start.',
  },
};

export interface Service {
  slug: string;
  group: ServiceGroup;
  /** A card on the home page. */
  home: boolean;
  title: string;
  /** Short name for menus and the footer. */
  short: string;
  color: BuoyColor;
  /** One line for lists. */
  line: string;
  /** Opening paragraph on the service page and the /services/ card. */
  intro: string;
  /** Description on the home page card (`home` services). */
  card?: string;
  goodFor: string[];
  examples?: string[];
  /** Heading for `examples` on the service page. */
  examplesTitle?: string;
  included?: string[];
  /** Heading for `included` (default “Every site includes”). */
  includedTitle?: string;
  /** Extra short sections on the service page. Facts only. */
  notes?: { heading: string; body: string }[];
  /** Meta description, when the default (`line`) is too thin for search. */
  meta?: string;
  /** Related portfolio entries (projects.ts slugs). */
  work: string[];
}

export const services: Service[] = [
  {
    slug: 'websites',
    group: 'build',
    home: true,
    title: 'New business websites',
    short: 'Websites',
    color: 'cobalt',
    line: 'A first website that shows what you do and how to reach you.',
    intro: 'A professional website for your business, from a single landing page to a multi-page site. It explains what you offer, who it’s for and how to reach you.',
    card: 'A first website for your business. It explains what you offer, works on phones, tablets and computers, and makes it easy for customers to contact you.',
    goodFor: [
      'You don’t have a website yet',
      'A social media page is all you have',
      'You’re starting something new and want a clear, credible place online',
      'You need a single landing page for one service or event',
    ],
    included: [
      'A design that works on phones, tablets and computers',
      'A contact form that sends messages to your inbox',
      'Basic SEO setup, so search engines can find and understand your pages',
    ],
    notes: [
      { heading: 'How it’s scoped', body: 'We start with a conversation about your business and what the site needs to do. I then write down the pages and features, with a fixed price. Work starts once you agree.' },
      { heading: 'Your content', body: 'If you have text, photos or a logo, send them along. If not, I can help with those too.' },
    ],
    work: ['auto-repair', 'landscaping', 'cleaning'],
  },
  {
    slug: 'redesigns',
    group: 'build',
    home: true,
    title: 'Website redesigns',
    short: 'Redesigns',
    color: 'orange',
    line: 'A new look or a clearer structure for the website you already have.',
    intro: 'Your current site is dated, hard to navigate or no longer fits your business. I redesign it: a new look, a clearer structure or a full rebuild.',
    card: 'A new look or a clearer structure for the website you already have, up to a full rebuild.',
    goodFor: [
      'It no longer matches what your business does',
      'Visitors can’t find what they need',
      'It needs a new layout to work well on phones',
    ],
    included: [
      'A design that works on phones, tablets and computers',
      'A contact form that sends messages to your inbox',
      'Basic SEO setup, so search engines can find and understand your pages',
    ],
    includedTitle: 'A rebuilt site includes',
    notes: [
      { heading: 'How it’s scoped', body: 'I start by looking at your current site with you: what works, what doesn’t and what has to stay. Then I propose the redesign, with a fixed price for the agreed scope.' },
      { heading: 'A good fit', body: 'This suits a site that needs a new look or structure. For a specific fix or feature on a site that mostly works, website improvements are usually the better choice.' },
    ],
    work: ['landscaping', 'cleaning'],
  },
  {
    slug: 'web-apps',
    group: 'build',
    home: true,
    title: 'Custom web applications',
    short: 'Web apps',
    color: 'sea',
    line: 'Booking systems, customer portals, dashboards and other tools built around how you work.',
    intro: 'Custom web applications and business tools for your customers, your team or a product of your own.',
    card: 'Software built for a specific job, such as booking and scheduling, customer portals, dashboards or order management.',
    goodFor: [
      'A spreadsheet or email chain isn’t keeping up',
      'Off-the-shelf tools don’t fit how you work',
      'You want to turn a product idea into something people can use',
    ],
    examples: [
      'Booking and scheduling systems',
      'Customer portals with sign-in',
      'Operational dashboards',
      'Online ordering and order management',
      'Product configurators and price calculators',
      'A product with accounts, messaging and admin tools',
    ],
    notes: [
      { heading: 'How it’s scoped', body: 'We start with what the application must do and who will use it. I write that down as a defined scope with a fixed price before any work starts.' },
      { heading: 'What you get', body: 'A working application built to the agreed scope. Its code and content are yours. I can host it, quoted separately.' },
    ],
    work: ['ember-rye', 'tidewater', 'cove', 'alder-pine', 'unmaskd'],
  },
  {
    slug: 'existing-projects',
    group: 'build',
    home: true,
    title: 'Website improvements',
    short: 'Improvements',
    color: 'yellow',
    line: 'Clearly scoped fixes, new features and mobile improvements for the website you have.',
    intro: 'Your website mostly works, but something specific needs to change. I add features, fix what’s broken and make it easier to use on a phone.',
    card: 'Specific changes to the website you already have: a new feature, a fix, or a better experience on phones.',
    goodFor: [
      'Your site works, but is missing a feature you need',
      'Something on your site has stopped working',
      'Your site is hard to use on a phone',
      'You can describe the change you want',
    ],
    examplesTitle: 'What I can help with',
    examples: [
      'Adding a specific feature, such as a booking or quote request form',
      'Improving how existing pages and forms work',
      'Mobile layout and ease-of-use improvements',
      'Fixing broken pages, links and forms',
    ],
    notes: [
      { heading: 'How it’s scoped', body: 'Tell me what you want changed. I look at the site, then send a written scope and a fixed price for that work.' },
      { heading: 'A good fit', body: 'This works best for clearly defined changes. For a site that needs a new look or structure, a redesign is usually the better choice.' },
    ],
    meta: 'Website improvements for small businesses: new features, fixes, and mobile and usability improvements. Clearly scoped, with a fixed price before work starts.',
    // unmaskd. is Randy's own build, not a takeover (agreed 2026-10-14).
    work: [],
  },
  {
    slug: 'website-management',
    group: 'support',
    home: false,
    title: 'Website management and webmaster services',
    short: 'Website management',
    color: 'cobalt',
    line: 'Updates, fixes and improvements for the website you already have.',
    intro: 'Once your site is live, it will need changes from time to time. I update content, fix problems and make improvements when you need them.',
    goodFor: [
      'You need content changed and don’t want to do it yourself',
      'Something on your site stopped working',
      'You want improvements without a full redesign',
      'You want one person to ask about your site',
    ],
    examplesTitle: 'What I can help with',
    examples: [
      'Updating text, photos, hours and other content',
      'Fixing broken pages, links and forms',
      'Software updates',
      'Improvements to layout, speed or ease of use',
      'Hosting your site, or working with your current host',
      'Answers to technical questions about your site',
    ],
    notes: [
      { heading: 'How it’s quoted', body: 'Each request is quoted before I start, whether it’s a single change or a set of updates. Hosting is quoted separately.' },
      { heading: 'Server or site?', body: 'Website management covers the site itself: its content, pages and everyday fixes. Setting up or changing the server it runs on is server setup and deployment.' },
    ],
    meta: 'Website maintenance and webmaster services for small businesses: content updates, fixes, improvements and hosting. Each job is quoted before work starts.',
    work: [],
  },
  {
    slug: 'server-setup',
    group: 'support',
    home: false,
    title: 'Server setup, deployment and infrastructure',
    short: 'Server setup',
    color: 'sea',
    line: 'The server and services your site or app needs, set up and deployed.',
    intro: 'Building an application is only part of getting it online. I set up servers, deploy websites and web apps, and configure the services they depend on.',
    goodFor: [
      'You have a working app that needs to go live',
      'You need a server set up from scratch',
      'Your app depends on other services, such as a database or email',
      'You want to move an app to a different host',
      'Deployments keep failing, or hosting problems are hard to pin down',
      'You want one developer who understands both your app and where it runs',
    ],
    examplesTitle: 'What I can set up',
    examples: [
      'Linux servers configured to run web applications',
      'Docker-based stacks, where your app and each service it needs run in their own container',
      'Web servers and reverse proxies, which route visitors to the right part of your app',
      'Databases, caching, file storage and email sending',
      'Domains, DNS and HTTPS, so your address reaches your site over an encrypted connection',
      'A repeatable way to deploy new versions',
      'Scheduled backups',
      'Fixes for deployment and server configuration problems',
      'Updates and changes to the setup when you need them',
    ],
    notes: [
      { heading: 'What this covers', body: 'Getting an app online usually involves several parts: the app itself, a database, a web server, email sending and backups. I set them up, connect them and deploy your app.' },
      { heading: 'Scope', body: 'I set up and look after hosting for individual websites and web applications. Each job is scoped and quoted before I start.' },
      { heading: 'Server or site?', body: 'Server setup covers the environment your site or app runs in. Content updates and everyday site fixes are website management. Where the two overlap, the scope depends on your project.' },
    ],
    meta: 'Server setup, Linux server configuration, Docker deployment and web application hosting for websites and web apps. Scoped and quoted before work starts.',
    work: ['unmaskd'],
  },
];

// The three ways most projects start, shown on the home page and at the top
// of /services/ (Randy, 2026-10-22). Each links to its service page(s); the
// detailed services above keep their own URLs.
export interface Category {
  id: string;
  title: string;
  color: BuoyColor;
  /** One or two sentences for a small business owner. */
  body: string;
  items: string[];
  /** Service pages, first = the main link. */
  services: string[];
}

export const categories: Category[] = [
  {
    id: 'websites',
    title: 'Business websites',
    color: 'cobalt',
    body: 'A clear, professional website that tells customers what you do and makes it easy to contact you.',
    items: ['New business websites', 'Landing pages', 'Multi-page websites', 'Website redesigns'],
    services: ['websites', 'redesigns'],
  },
  {
    id: 'apps',
    title: 'Custom applications and business tools',
    color: 'sea',
    body: 'Software built around how your business works, for your customers, your team or both.',
    items: ['Booking and scheduling', 'Customer portals', 'Operational dashboards', 'Order management', 'Other custom web applications'],
    services: ['web-apps'],
  },
  {
    id: 'improve',
    title: 'Website improvements',
    color: 'yellow',
    body: 'Clearly scoped fixes and features for a website that mostly works.',
    items: ['New features', 'Better-working pages and forms', 'Mobile and usability improvements', 'Fixes and enhancements'],
    services: ['existing-projects'],
  },
];

export const serviceBySlug = Object.fromEntries(services.map((s) => [s.slug, s]));

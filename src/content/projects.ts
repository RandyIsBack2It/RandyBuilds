// Portfolio entries. The Work section and /work/<slug>/ pages are generated
// from this list, so adding a project is a data change plus (optionally) a
// detail page body.
//
// Honesty rules (see CLAUDE.md):
// - kind 'independent' = something Randy built himself. unmaskd. may be named
//                        (Randy, 2026-10-12) as designer/builder/infrastructure,
//                        never as the person running it.
// - kind 'concept'     = a demonstration site for a FICTIONAL business. Always
//                        labelled "Concept project". No invented reviews,
//                        results or prices presented as real.
// - kind 'client'      = real paid work, only with the client's permission.

export interface Shot {
  src: string; alt: string; device: 'desktop' | 'mobile'; width: number; height: number;
  /** Short muted loop shown instead of the still where motion is allowed (src is its poster). */
  video?: string;
}

export type ProjectKind = 'independent' | 'concept' | 'client';

export interface Project {
  slug: string;
  kind: ProjectKind;
  title: string;
  /** One sentence a non-technical reader understands. */
  summary: string;
  /** Short plain-language list of what was built. */
  built: string[];
  /** Live demo URL, if any (concepts). */
  demoUrl?: string;
  /** Public site, for real projects. */
  liveUrl?: string;
  /** Caption under the screenshots. */
  shotNote?: string;
  /** One line for cards. */
  tagline?: string;
  /** Screenshots under /public/work/<slug>/ (scripts/capture-concepts.mjs). First = card cover. */
  shots?: Shot[];
  /** Extra sections for the /work/<slug>/ page. Facts only. */
  notes?: { heading: string; body: string }[];
  /** Concept demo shows sample prices (the work-page note says so). */
  samplePrices?: boolean;
  /** Demo gallery details (content/demos.ts); a project with `demoUrl` and `demo` is listed on /work/. */
  demo?: {
    category: string;
    /** Only features a visitor can actually try in the demo. */
    features: string[];
    /** What happens when the visitor submits or taps something that would contact the business. */
    simulated: string;
    /** Position among the home page's featured demos. */
    featured?: number;
    /** Section on /work/ (default: business websites). */
    group?: 'products';
    /** The kind of business problem it could solve, for a customer. */
    solves: string;
  };
  /** Order on the home page; lower first. */
  order: number;
}

export const kindLabel: Record<ProjectKind, string> = {
  independent: 'Independent project',
  concept: 'Concept demonstration',
  client: 'Client project',
};

export const projects: Project[] = [
  {
    slug: 'unmaskd',
    kind: 'independent',
    title: 'unmaskd.',
    tagline: 'A social platform built with neurodivergent adults in mind.',
    summary:
      'A social platform for friendship, dating and collaboration, built with neurodivergent adults in mind. I designed and built it, and set up the servers it runs on.',
    built: [
      'Accounts and sign-in',
      'Profiles with per-field visibility controls',
      'Discover people with search and filters',
      'Connections and private messaging',
      'Community feed and topic-based Circles',
      'Admin and moderation tools',
      'Accessibility settings',
      'Hosting, backups and deployment',
    ],
    notes: [
      { heading: 'Every layer', body: 'I worked on all of it: what the product does, how it looks, the web app itself and the servers behind it. I’m still improving it.' },
      { heading: 'Accessibility settings', body: 'Light, dark and high-contrast themes, larger text, a dyslexia-friendly font and reduced motion change the whole interface.' },
      { heading: 'Privacy controls', body: 'Members choose who sees each part of their profile.' },
    ],
    liveUrl: 'https://www.getunmaskd.com',
    shotNote: 'People shown are illustrative sample profiles, not members.',
    shots: [
      { src: '/work/unmaskd/desktop.jpg', alt: 'The getunmaskd.com homepage: “Meet people as you are.”, beside an example profile card', device: 'desktop', width: 1440, height: 900, video: '/work/unmaskd/hero.mp4' },
      { src: '/work/unmaskd/desktop-explore.jpg', alt: 'The public Explore page, with what people are there for and example profiles', device: 'desktop', width: 1440, height: 900 },
    ],
    order: 1,
  },
  {
    slug: 'auto-repair',
    kind: 'concept',
    title: 'Northbound Auto Works',
    tagline: 'An auto repair site where calling or booking is one tap away on a phone.',
    summary:
      'A site for an independent repair shop, built around phones. Calling, booking and finding the shop each take one tap.',
    built: [
      'Call and book buttons that stay on screen on phones',
      'Service menu with clearly marked sample starting prices',
      'A plain-language “What is my car doing?” guide',
      'Appointment request form with drop-off times',
      'Hours, location and parking details at a glance',
    ],
    notes: [
      { heading: 'Easy to use in a hurry', body: 'Large type, high contrast and two main actions: call and book.' },
      { heading: 'Clear expectations', body: 'The site explains how the shop works: diagnosis first, and no work without the customer’s approval.' },
    ],
    demoUrl: '/concepts/auto-repair/',
    demo: {
      category: 'Business website',
      features: ['Appointment request form', 'Expandable “What is my car doing?” guide', 'Call and book buttons that stay on screen on phones'],
      solves: 'Good for repair shops and other local services that get most visits from phones.',
      simulated: 'The form and call buttons are simulated. Nothing is sent and no call is made.',
    },
    samplePrices: true,
    shots: [
      { src: '/work/auto-repair/desktop.jpg', alt: 'Northbound Auto Works concept homepage on a desktop browser', device: 'desktop', width: 1440, height: 900 },
      { src: '/work/auto-repair/mobile.jpg', alt: 'Northbound Auto Works concept on a phone, with call and book buttons', device: 'mobile', width: 390, height: 844 },
    ],
    order: 2,
  },
  {
    slug: 'landscaping',
    kind: 'concept',
    title: 'Fern & Fieldstone',
    tagline: 'A landscaping site that organizes its services by season.',
    summary:
      'A landscaping and property care site that organizes its services by season, from spring cleanups to snow removal.',
    built: [
      'Season switcher: spring, summer, fall and winter services',
      'Illustrated project gallery with before-and-after notes',
      'Quote request with property size and service choices',
      'Service-area overview',
    ],
    notes: [
      { heading: 'Organized by season', body: 'Services follow the year, the way customers think about their yard.' },
    ],
    demoUrl: '/concepts/landscaping/',
    demo: {
      category: 'Business website',
      features: ['Season switcher for services', 'Quote request with property size and service choices'],
      solves: 'Good for seasonal and home-service businesses that want detailed quote requests.',
      simulated: 'The quote request is simulated. Nothing is sent.',
    },
    shots: [
      { src: '/work/landscaping/desktop.jpg', alt: 'Fern & Fieldstone concept homepage on a desktop browser', device: 'desktop', width: 1440, height: 900 },
      { src: '/work/landscaping/mobile.jpg', alt: 'Fern & Fieldstone concept on a phone', device: 'mobile', width: 390, height: 844 },
    ],
    order: 3,
  },
  {
    slug: 'cleaning',
    kind: 'concept',
    title: 'Brightside Home Cleaning',
    tagline: 'A cleaning service site with packages side by side and a short booking form.',
    summary:
      'A home cleaning site with clear packages, a room-by-room checklist and a short booking request.',
    built: [
      'Three packages compared side by side, with sample prices',
      'Room-by-room “what we clean” checklist',
      'Three-step booking request: home, package, timing',
      'Add-ons such as inside the fridge or windows',
    ],
    notes: [
      { heading: 'Short forms', body: 'The booking request asks only what’s needed for a quote.' },
    ],
    demoUrl: '/concepts/cleaning/',
    demo: {
      category: 'Business website',
      features: ['Three-step booking request', 'Package and add-on choices', 'Packages compared side by side'],
      solves: 'Good for service businesses with clear packages and simple booking requests.',
      simulated: 'The booking request is simulated. Nothing is sent.',
    },
    samplePrices: true,
    shots: [
      { src: '/work/cleaning/desktop.jpg', alt: 'Brightside Home Cleaning concept homepage on a desktop browser', device: 'desktop', width: 1440, height: 900 },
      { src: '/work/cleaning/mobile.jpg', alt: 'Brightside Home Cleaning concept on a phone', device: 'mobile', width: 390, height: 844 },
    ],
    order: 4,
  },
  {
    slug: 'frost-heave',
    kind: 'concept',
    title: 'Frost Heave Creamery',
    tagline: 'A simple ice cream shop site: the flavors, the menu, the story and when to visit.',
    summary:
      'A site for an ice cream shop: flavors, menu, story and visit. Seasonal flavors come and go on their own, and the owner can mark one sold out or post a notice.',
    built: [
      'Flavor list in three groups: classics, in season and dairy-free',
      'Seasonal flavors that appear in their months, with what’s coming next',
      'Menu board with sizes, cones, treats and pints to take home',
      'Open-now status, and hours by season in short lines',
      'Story, an illustrated map and directions',
      'Owner panel for sold-out flavors and a notice across the top',
    ],
    notes: [
      { heading: 'Kept simple on purpose', body: 'Shops like this need the flavors, the prices, the hours and the way there. No cart, no accounts, no forms to look after.' },
      { heading: 'Kept current by the owner', body: 'Flavors, prices and hours live in one data file. A sold-out flavor or an early close is changed in a small panel and shows at once.' },
    ],
    demoUrl: '/concepts/frost-heave/',
    demo: {
      category: 'Business website',
      features: ['See what’s in season this month', 'Check the menu and today’s hours', 'Mark a flavor sold out in the owner panel'],
      solves: 'Good for ice cream shops, bakeries and cafés with menus that change.',
      simulated: 'Owner changes are simulated and stay in your browser.',
    },
    samplePrices: true,
    shots: [
      { src: '/work/frost-heave/desktop.jpg', alt: 'Frost Heave Creamery concept: “Worth slowing down for.” beside a three-scoop waffle cone and a yellow road sign', device: 'desktop', width: 1440, height: 900 },
      { src: '/work/frost-heave/mobile.jpg', alt: 'Frost Heave Creamery concept on a phone', device: 'mobile', width: 390, height: 844 },
    ],
    order: 5,
  },
  {
    slug: 'ember-rye',
    kind: 'concept',
    title: 'Ember & Rye',
    tagline: 'A restaurant site with pickup ordering, clear pickup policies and simple table reservations.',
    summary:
      'A site for a wood-fired restaurant where guests can order ahead for pickup, see what to expect when they collect, and book a table in a few taps.',
    built: [
      'Menu with dietary filters, search, sample allergen notes and section tracking',
      'Dish options, add-ons and special instructions with live prices',
      'Cart with editable quantities, optional tip and sample tax that always add up',
      'Checkout with pickup times worked out from ordering hours and prep time',
      'Reservations by party size, date and time, with capacity per seating so times fill up',
      'Pickup policies, sample hours and services it doesn’t offer, stated plainly',
    ],
    notes: [
      { heading: 'Clear expectations', body: 'Prep times, ordering hours, where to collect and how to pay are answered before anyone orders.' },
      { heading: 'Only the choices guests need', body: 'Guests pick a party size, a date and a time. The restaurant still assigns the tables.' },
    ],
    demoUrl: '/concepts/ember-rye/',
    demo: {
      category: 'Ordering and reservations',
      group: 'products',
      features: ['Order for pickup with options and special instructions', 'Book a table by party size, date and time', 'See a demo order or reservation summary'],
      solves: 'Good for restaurants, cafés and bakeries that want their own ordering and reservations.',
      simulated: 'Orders, reservations and the inquiry form are simulated. Nothing is sent or charged.',
      featured: 1,
    },
    samplePrices: true,
    shots: [
      { src: '/work/ember-rye/desktop.jpg', alt: 'Ember & Rye concept: a dark hero with a glowing wood-fired oven, beside order and booking buttons', device: 'desktop', width: 1440, height: 900 },
      { src: '/work/ember-rye/mobile.jpg', alt: 'Ember & Rye concept on a phone', device: 'mobile', width: 390, height: 844 },
    ],
    order: 6,
  },
  {
    slug: 'alder-pine',
    kind: 'concept',
    title: 'Alder & Pine',
    tagline: 'A furniture store where customers design their own table in 3D and see the price change as they go.',
    summary:
      'A store for a furniture workshop where customers configure a dining table in 3D, check it fits their room and request a build slot.',
    built: [
      '3D table preview that turns by dragging, with angle, side, end and top views',
      'Size, wood, base, edge, thickness, finish and extras, priced live',
      'Room-fit planner that checks the space around the table',
      'Saved designs and share links that reopen the exact table',
      'Delivery service and arrival window by ZIP code',
      'Build-slot request showing the deposit, balance and arrival window',
    ],
    notes: [
      { heading: 'Drawn in the browser', body: 'The 3D preview is drawn from the chosen measurements each time something changes. There are no photos to update when options change.' },
      { heading: 'Fewer questions before buying', body: 'Price, lead time, room fit and delivery are answered on the page, before anyone has to ask.' },
    ],
    demoUrl: '/concepts/alder-pine/',
    demo: {
      category: 'Product configurator',
      group: 'products',
      features: ['Turn and restyle the table in 3D', 'Check it fits your room', 'Save designs and copy a share link'],
      solves: 'Good for makers and shops selling made-to-order products with many options.',
      simulated: 'The build-slot request is simulated. Nothing is sent, ordered or charged.',
      featured: 2,
    },
    samplePrices: true,
    shots: [
      { src: '/work/alder-pine/desktop.jpg', alt: 'Alder & Pine concept: a 3D oak dining table with chairs beside the configurator options and price', device: 'desktop', width: 1440, height: 900 },
      { src: '/work/alder-pine/mobile.jpg', alt: 'Alder & Pine configurator on a phone', device: 'mobile', width: 390, height: 844 },
    ],
    order: 7,
  },
  {
    slug: 'tidewater',
    kind: 'concept',
    title: 'Tidewater Mechanical Ops',
    tagline: 'Office software for a heating and plumbing company: dispatch board, estimates, customers and reports.',
    summary:
      'Back-office software for a heating, cooling and plumbing company, from scheduling technicians to signed estimates.',
    built: [
      'Dispatch board with drag-and-drop scheduling and overlap warnings',
      'Map of the day’s jobs, routes and technician vans',
      'Job details with status steps, checklists and assignment',
      'Estimate builder with good, better and best options and a price book',
      'Customer view of the estimate with an on-screen signature',
      'Customer records with equipment age and service history',
      'Reports with revenue, job mix and technician figures',
      'A customer service-request form that lands on the dispatch board',
    ],
    notes: [
      { heading: 'One place for the day', body: 'The board, the map and the job details stay in step, so the office sees the whole day at once.' },
      { heading: 'From estimate to schedule', body: 'An approved estimate becomes a job in the unassigned tray, ready to drag onto a technician.' },
    ],
    demoUrl: '/concepts/tidewater/',
    demo: {
      category: 'Web application',
      group: 'products',
      features: ['Send a service request and find it on the board', 'Drag jobs between technicians', 'Build, send and sign an estimate'],
      solves: 'Good for contractors and field-service teams that schedule crews, send estimates and track jobs.',
      simulated: 'All data is sample data. Requests, texts, emails and signatures are simulated and nothing is sent.',
      featured: 3,
    },
    samplePrices: true,
    shots: [
      { src: '/work/tidewater/desktop.jpg', alt: 'Tidewater Mechanical Ops concept: a dispatch board of technicians and colored job blocks', device: 'desktop', width: 1440, height: 900 },
      { src: '/work/tidewater/mobile.jpg', alt: 'Tidewater Mechanical Ops on a phone', device: 'mobile', width: 390, height: 844 },
    ],
    order: 8,
  },
  {
    slug: 'cove',
    kind: 'concept',
    title: 'Cove Wellness',
    tagline: 'A wellness studio site with step-by-step booking, a body-map intake and a page to manage visits.',
    summary:
      'A site for a massage, physical therapy and acupuncture studio where clients book, fill in their intake and manage their visits.',
    built: [
      'Five-step booking: service, therapist, time, intake and review',
      'Availability by therapist and day, with first-available booking',
      'Intake with a tappable body map, pressure and health questions',
      'My visits: add to calendar, reschedule and cancel with the policy shown',
      'Memberships with monthly or yearly billing',
      'Gift card designer with a live card preview',
    ],
    notes: [
      { heading: 'Intake before the visit', body: 'Focus areas and health notes are collected while booking, so the session can start on time.' },
      { heading: 'Changes without a phone call', body: 'Clients can reschedule or cancel themselves, and the cancellation policy is shown at the moment it applies.' },
    ],
    demoUrl: '/concepts/cove/',
    demo: {
      category: 'Booking and client portal',
      group: 'products',
      features: ['Book a visit with the body-map intake', 'Reschedule or cancel in My visits', 'Design a gift card'],
      solves: 'Good for studios, clinics and salons that take appointments and need intake details.',
      simulated: 'Bookings, memberships and gift cards are simulated. Nothing is sent or charged.',
    },
    samplePrices: true,
    shots: [
      { src: '/work/cove/desktop.jpg', alt: 'Cove Wellness concept: a soft sand hero with a sunset arch and a Book a visit button', device: 'desktop', width: 1440, height: 900 },
      { src: '/work/cove/mobile.jpg', alt: 'Cove Wellness concept on a phone', device: 'mobile', width: 390, height: 844 },
    ],
    order: 9,
  },
];

export const sortedProjects = [...projects].sort((a, b) => a.order - b.order);

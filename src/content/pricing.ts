// Typical project sizes: the one place the public price guidance lives.
// Randy, 2026-10-31: $700 is the standard starting price for a simple
// small-business website (his base price, not an introductory offer).
// Larger sites and redesigns are quoted individually once the scope is agreed.
// Change the figures here; /services/#pricing, the service pages, the FAQ
// and the home cue follow. Never quotes: every project still gets a written
// scope and a fixed price before work starts.

export interface PriceGuide {
  id: 'small' | 'business' | 'custom';
  title: string;
  /** The figure, as shown. */
  price: string;
  /** What usually falls in this size. */
  body: string;
  /** Service pages (services.ts slugs) that show this guide. */
  services: string[];
}

export const priceGuides: PriceGuide[] = [
  {
    id: 'small',
    title: 'Simple small-business websites',
    price: 'Starting at $700',
    body: 'A focused page or a very small site, such as one service, an event or a simple online presence. The final price depends on the agreed scope.',
    services: ['websites'],
  },
  {
    id: 'business',
    title: 'Larger websites and redesigns',
    price: 'Quoted individually',
    body: 'Multi-page or feature-rich sites, and redesigns. Each is quoted once we have agreed the scope.',
    services: ['websites', 'redesigns'],
  },
  {
    id: 'custom',
    title: 'Custom web applications',
    price: 'Quoted individually',
    body: 'Booking systems, customer portals, dashboards and other tools. The price depends on the features and how complex they are.',
    services: ['web-apps'],
  },
];

export const priceNote =
  'These are starting points, not quotes. The actual price depends on the scope we agree. Before any work starts, you get a written scope and a fixed price to agree to.';

/** Short form for the FAQ (built from the figures above). */
export const priceSummary = `Simple small-business websites start at $700. Larger, multi-page or feature-rich sites, redesigns and custom applications are quoted individually. ${priceNote}`;

/** Cue on the home page's Business websites card (links to /services/#pricing). */
export const homePriceCue = 'Simple small-business websites start at $700. Larger sites are quoted once the scope is agreed.';

/** Optional budget choices on the contact form. */
export const budgets = ['Under $1,000', '$1,000–$3,000', '$3,000–$10,000', 'Over $10,000', 'Not sure yet'];

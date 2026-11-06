// Single source of truth for site-wide facts. Change values here, not in pages.

export const site = {
  name: 'RandyBuilds.tech',
  url: 'https://randybuilds.tech',
  owner: 'Randy',
  description:
    'Business websites, custom web apps and website improvements by Randy, an independent developer. Free project review by email, fixed price before work starts.',

  contact: {
    email: 'connect@randybuilds.tech',
    // Cloudflare Email Routing forwards this address to Randy's inbox
    // (test message received 2026-10-12). Set to false if forwarding ever
    // stops working. While false, every page carries a "preview" notice,
    // asks search engines not to index, and scripts/deploy.sh refuses to
    // build a public release.
    emailVerified: true,
  },

  // Starting year for the footer copyright range.
  since: 2026,

  // Confirmed by Randy 2026-10-12; identity and reply time updated 2026-10-13.
  // `owned` + `area` appear once, in the footer. `area` is availability, not
  // a claim about past clients.
  owned: 'Maine-based and neurodivergent-owned.',
  area: 'Available for projects across New England and remotely.',
  replyTime: 'I aim to reply within three business days',
  // The first step for every inquiry (Randy, 2026-10-22): written, no meeting needed.
  review: 'Free project review by email',

  // Cloudflare Turnstile site key for the forms (public by design; the secret
  // key is TURNSTILE_SECRET_KEY in this project's .env, read by the mailer).
  // Empty = no widget. On localhost the forms use Cloudflare's always-pass test key.
  turnstileSiteKey: '0x4AAAAAAFnWwvv5_2ey1Qtd',
} as const;

// Sections of the one-page home. `section` also matches detail pages
// (/services/<slug>/, /work/<slug>/) for aria-current.
export const nav = [
  { href: '/services/', section: 'services', label: 'Services' },
  { href: '/work/', section: 'work', label: 'Work' },
  { href: '/resources/', section: 'resources', label: 'Resources' },
  { href: '/#about', section: 'about', label: 'About' },
  { href: '/#faq', section: 'faq', label: 'FAQ' },
] as const;

export const mailto = (subject?: string) =>
  `mailto:${site.contact.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;

export const isPreview = !site.contact.emailVerified;

// Stable JSON-LD node ids (layouts/Base.astro), so page schema can point at the business.
export const schemaIds = {
  website: `${site.url}/#website`,
  business: `${site.url}/#business`,
  person: `${site.url}/#randy`,
} as const;

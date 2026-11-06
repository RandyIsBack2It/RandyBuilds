// The resource directory (/resources/). One entry per free resource, written
// in our own words. Store only what the directory needs: a name, the
// publisher, a short original description, the official URL and when it was
// last checked. Never copy the publisher's text, images or files.
//
// Every entry is checked by opening its page (RESOURCE_RESEARCH.md lists the
// URL, category, free status and date for each). Re-check a link before
// changing `checked`. When a detail can't be confirmed, leave it out
// (`account` stays undefined and shows "Not checked") rather than guessing.
// Listing a resource is not an endorsement, and never says it is.
//
// Prices of third-party products are not stated here (they change, and the
// site's only prices are content/pricing.ts): say what the free plan covers
// and that paid plans exist.

export type CategoryId =
  | 'start' | 'content' | 'platforms' | 'accessibility' | 'search'
  | 'marketing' | 'operations' | 'security' | 'finance' | 'learning';

export type ResourceType =
  | 'guide' | 'checklist' | 'template' | 'calculator' | 'tool'
  | 'software' | 'course' | 'book' | 'reference' | 'service';

/** Free = no cost to use. Free tier = a free plan with limits; paid plans exist. Free trial = time-limited. */
export type Price = 'free' | 'free-tier' | 'free-trial';

/** none = no account needed; optional = works without one; required = sign-up needed. */
export type Account = 'none' | 'optional' | 'required';

export type AudienceId = 'starting' | 'running' | 'website' | 'diy';

export interface Category {
  id: CategoryId;
  title: string;
  /** One line under the title. */
  line: string;
  color: 'cobalt' | 'orange' | 'sea' | 'yellow';
}

export const categories: Category[] = [
  { id: 'start', title: 'Starting and planning', line: 'Business plans, registration, local advisors and the first official steps.', color: 'orange' },
  { id: 'content', title: 'Website planning and content', line: 'Writing clear pages, choosing fonts and images, and preparing visuals.', color: 'cobalt' },
  { id: 'platforms', title: 'Website platforms and web tools', line: 'Software, certificates and checks for the site itself.', color: 'sea' },
  { id: 'accessibility', title: 'Accessibility', line: 'Making a site usable for everyone, and checking that it is.', color: 'yellow' },
  { id: 'search', title: 'Search visibility and analytics', line: 'Showing up in search and maps, and seeing how people find you.', color: 'cobalt' },
  { id: 'marketing', title: 'Marketing and customer communication', line: 'Email, reviews, endorsements and the rules around them.', color: 'orange' },
  { id: 'operations', title: 'Booking, forms and operations', line: 'Scheduling, task boards and everyday office tools.', color: 'sea' },
  { id: 'security', title: 'Cybersecurity and privacy', line: 'Passwords, customer data and what to do if something goes wrong.', color: 'yellow' },
  { id: 'finance', title: 'Finance and recordkeeping', line: 'Taxes, records, bookkeeping and paying people.', color: 'cobalt' },
  { id: 'learning', title: 'Learning for founders and builders', line: 'Free courses for running a business or building for the web.', color: 'orange' },
];

export const typeLabels: Record<ResourceType, string> = {
  guide: 'Guide',
  checklist: 'Checklist',
  template: 'Template',
  calculator: 'Calculator',
  tool: 'Online tool',
  software: 'Software',
  course: 'Course',
  book: 'Book',
  reference: 'Reference',
  service: 'Free advice',
};

export const priceLabels: Record<Price, string> = {
  free: 'Free',
  'free-tier': 'Free tier',
  'free-trial': 'Free trial',
};

export const accountLabels: Record<Account, string> = {
  none: 'No account needed',
  optional: 'Account optional',
  required: 'Account required',
};

export const audiences: { id: AudienceId; label: string }[] = [
  { id: 'starting', label: 'Starting a business' },
  { id: 'running', label: 'Running a small business' },
  { id: 'website', label: 'Planning or managing a website' },
  { id: 'diy', label: 'Building it yourself' },
];

export interface Resource {
  /** Stable id: used in saved lists and guide links. Never reuse or rename one. */
  id: string;
  name: string;
  publisher: string;
  /** Original, plain-language description. One or two short sentences. */
  description: string;
  /** Who it suits, in a few words ("Good for …"). */
  goodFor: string;
  category: CategoryId;
  type: ResourceType;
  audience: AudienceId[];
  price: Price;
  /** What the free part covers, or what costs extra. */
  priceNote?: string;
  /** Leave undefined when it couldn't be confirmed. */
  account?: Account;
  url: string;
  /** ISO date the page was last opened and checked. */
  checked: string;
  /** A good first stop: shown on the hub page. Editorial, not an endorsement. */
  start?: boolean;
  /** Extra words people might search for. */
  keywords?: string[];
}

const C = '2026-10-25';

export const resources: Resource[] = [
  // ── Starting and planning ──────────────────────────────────────────
  {
    id: 'sba-plan-your-business', name: 'Plan your business', publisher: 'U.S. Small Business Administration',
    description: 'Short official guides to market research, writing a business plan, estimating startup costs and finding funding. Includes downloadable plan examples and a fillable startup cost worksheet.',
    goodFor: 'Turning an idea into a written plan', category: 'start', type: 'guide', audience: ['starting'],
    price: 'free', account: 'none', url: 'https://www.sba.gov/counseling/plan-your-business/', checked: C, start: true,
    keywords: ['business plan', 'startup costs', 'market research', 'funding', 'lean plan'],
  },
  {
    id: 'sba-launch-your-business', name: 'Launch your business', publisher: 'U.S. Small Business Administration',
    description: 'The paperwork side of opening: choosing a structure and name, registering, tax ID numbers, licenses and permits, a bank account and insurance. Each step links to the official office that handles it.',
    goodFor: 'Knowing which registrations come first', category: 'start', type: 'guide', audience: ['starting'],
    price: 'free', account: 'none', url: 'https://www.sba.gov/counseling/launch-your-business/', checked: C,
    keywords: ['register', 'llc', 'sole proprietor', 'license', 'permit', 'insurance', 'business name'],
  },
  {
    id: 'sba-break-even-calculator', name: 'Break-even point calculator', publisher: 'U.S. Small Business Administration',
    description: 'Enter your monthly fixed costs, price and cost per sale to see how many sales cover your costs. It explains fixed and variable costs as you go.',
    goodFor: 'Testing whether a price works', category: 'start', type: 'calculator', audience: ['starting', 'running'],
    price: 'free', account: 'none', url: 'https://www.sba.gov/counseling/plan-your-business/break-even-point-calculator/', checked: C,
    keywords: ['pricing', 'fixed costs', 'variable costs', 'profit'],
  },
  {
    id: 'sba-local-assistance', name: 'Local assistance finder', publisher: 'U.S. Small Business Administration',
    description: 'Finds SBA resource partners near a ZIP code: Small Business Development Centers, SCORE chapters, Women’s Business Centers and Veterans Business Outreach Centers. SBA describes the counseling as free or low-cost.',
    goodFor: 'Finding a person to talk to locally', category: 'start', type: 'service', audience: ['starting', 'running'],
    price: 'free', priceNote: 'Counseling is free or low-cost; some training has a fee.', account: 'none',
    url: 'https://www.sba.gov/counseling/local-assistance/', checked: C,
    keywords: ['counseling', 'mentor', 'advisor', 'sbdc', 'womens business center', 'veterans'],
  },
  {
    id: 'score-mentoring', name: 'SCORE mentoring', publisher: 'SCORE',
    description: 'Free one-to-one mentoring from experienced volunteers for anyone starting or running a U.S.-based business. You request a mentor by ZIP code or browse mentor profiles.',
    goodFor: 'Getting a second opinion on a plan', category: 'start', type: 'service', audience: ['starting', 'running'],
    price: 'free', priceNote: 'You fill in a request form to be matched.', url: 'https://www.score.org/how-mentoring-works/', checked: C, start: true,
    keywords: ['mentor', 'advice', 'volunteer', 'coaching'],
  },
  {
    id: 'score-templates', name: 'Business templates', publisher: 'SCORE',
    description: 'Downloadable worksheets and spreadsheets: a startup business plan, profit and loss projections, startup expenses and a SWOT analysis. Some are sponsored by other companies.',
    goodFor: 'A ready-made structure for a plan or forecast', category: 'start', type: 'template', audience: ['starting', 'running'],
    price: 'free', url: 'https://www.score.org/templates/', checked: C,
    keywords: ['business plan template', 'profit and loss', 'projection', 'swot', 'spreadsheet'],
  },
  {
    id: 'americas-sbdc-finder', name: 'Find your SBDC', publisher: 'America’s SBDC',
    description: 'Locates the nearest Small Business Development Center by ZIP code or state. Centers offer no-cost consulting and low-cost training.',
    goodFor: 'Ongoing help from a local business advisor', category: 'start', type: 'service', audience: ['starting', 'running'],
    price: 'free', priceNote: 'Consulting is no-cost; training is low-cost.', account: 'none',
    url: 'https://americassbdc.org/find-your-sbdc/', checked: C,
    keywords: ['sbdc', 'consulting', 'advisor', 'training'],
  },
  {
    id: 'irs-ein', name: 'Get an employer identification number (EIN)', publisher: 'Internal Revenue Service',
    description: 'The official online application for a federal tax ID. It costs nothing, and approved applications get the number straight away. Sites that charge for an EIN are not the IRS.',
    goodFor: 'Getting a tax ID without paying a middleman', category: 'start', type: 'tool', audience: ['starting'],
    price: 'free', priceNote: 'Must be finished in one session.', account: 'none',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number', checked: C,
    keywords: ['ein', 'tax id', 'federal', 'employer number'],
  },
  {
    id: 'uspto-trademark-basics', name: 'Trademark basics', publisher: 'U.S. Patent and Trademark Office',
    description: 'Explains what a trademark is, how it differs from a patent or copyright, and how federal registration works, including searching for similar marks first.',
    goodFor: 'Checking a business name or logo before you commit', category: 'start', type: 'guide', audience: ['starting'],
    price: 'free', priceNote: 'Reading is free; filing an application has government fees.', account: 'none',
    url: 'https://www.uspto.gov/trademarks/basics', checked: C,
    keywords: ['trademark', 'brand', 'business name', 'logo', 'copyright'],
  },

  {
    id: 'topmoller-coach-or-consultant', name: 'Do you need a business coach or a consultant?', publisher: 'Jacob Top Møller',
    description: 'A short article on the difference between a business coach and a consultant, when each one fits, and what to write down before you hire either. The author offers both services.',
    goodFor: 'Deciding what kind of outside help you need', category: 'start', type: 'guide', audience: ['starting', 'running'],
    price: 'free', account: 'none', url: 'https://topmoller.com/articles/business-coach-or-consultant/', checked: '2026-10-30',
    keywords: ['coach', 'consultant', 'advisor', 'hiring help', 'outside help'],
  },

  // ── Website planning and content ──────────────────────────────────
  {
    id: 'digital-gov-plain-language', name: 'Plain language guides', publisher: 'Digital.gov',
    description: 'How to write, design and test content that readers understand the first time. Written for government web teams, but the advice suits any business site.',
    goodFor: 'Rewriting pages so customers get the point', category: 'content', type: 'guide', audience: ['website', 'running'],
    price: 'free', account: 'none', url: 'https://digital.gov/guides/plain-language/', checked: C, start: true,
    keywords: ['writing', 'copy', 'readability', 'content'],
  },
  {
    id: 'govuk-writing-standards', name: 'Writing to GOV.UK standards', publisher: 'GOV.UK',
    description: 'The UK government’s guidance on planning content around what users need, plus its style guide and tone of voice. A strong model for short, useful pages.',
    goodFor: 'Deciding what each page is for before writing it', category: 'content', type: 'guide', audience: ['website'],
    price: 'free', account: 'none', url: 'https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/', checked: C,
    keywords: ['content design', 'style guide', 'user needs', 'writing'],
  },
  {
    id: 'nngroup-articles', name: 'Articles and videos', publisher: 'Nielsen Norman Group',
    description: 'A long-running library of research-based articles on usability, navigation and writing for the web. The articles are free to read; training is a separate paid product.',
    goodFor: 'Understanding why people get stuck on a site', category: 'content', type: 'reference', audience: ['website', 'diy'],
    price: 'free', account: 'none', url: 'https://www.nngroup.com/articles/', checked: C,
    keywords: ['usability', 'ux', 'user experience', 'navigation', 'research'],
  },
  {
    id: 'mailchimp-content-style-guide', name: 'Content Style Guide', publisher: 'Mailchimp',
    description: 'A company style guide made public, covering voice and tone, grammar, web elements, email newsletters and writing for accessibility. Shared under a Creative Commons license.',
    goodFor: 'Setting a consistent voice for your business', category: 'content', type: 'reference', audience: ['website', 'running'],
    price: 'free', account: 'none', url: 'https://styleguide.mailchimp.com/', checked: C,
    keywords: ['voice', 'tone', 'style guide', 'grammar', 'newsletter'],
  },
  {
    id: 'google-fonts', name: 'Google Fonts', publisher: 'Google',
    description: 'A large catalog of open-source fonts you can preview with your own text, filter by style and language, and download or use on a website.',
    goodFor: 'Choosing readable fonts you’re allowed to use', category: 'content', type: 'tool', audience: ['website', 'diy'],
    price: 'free', account: 'none', url: 'https://fonts.google.com/', checked: C,
    keywords: ['typography', 'font', 'typeface', 'icons'],
  },
  {
    id: 'unsplash', name: 'Unsplash', publisher: 'Unsplash',
    description: 'Photos you can download and use for free, including commercially, under the Unsplash License. Read the license: it doesn’t allow selling unmodified images. A paid Unsplash+ collection sits alongside the free one.',
    goodFor: 'Atmosphere photos when you have none of your own', category: 'content', type: 'tool', audience: ['website', 'diy'],
    price: 'free', priceNote: 'Unsplash+ images are a separate paid collection.', url: 'https://unsplash.com/license', checked: C,
    keywords: ['stock photos', 'images', 'pictures', 'license'],
  },
  {
    id: 'squoosh', name: 'Squoosh', publisher: 'Google Chrome Labs',
    description: 'Shrinks image files in the browser and shows the before and after side by side. Images stay on your device.',
    goodFor: 'Making photos small enough for a fast page', category: 'content', type: 'tool', audience: ['website', 'diy'],
    price: 'free', account: 'none', url: 'https://squoosh.app/', checked: C,
    keywords: ['compress', 'image size', 'webp', 'avif', 'resize', 'performance'],
  },
  {
    id: 'canva', name: 'Canva Free', publisher: 'Canva',
    description: 'A drag-and-drop design editor with templates for social posts, flyers and simple graphics. The free plan includes the editor and a large template library.',
    goodFor: 'Quick graphics without design software', category: 'content', type: 'tool', audience: ['running', 'website'],
    price: 'free-tier', priceNote: 'Premium templates, brand kits and more AI features are paid.', account: 'required',
    url: 'https://www.canva.com/pricing/', checked: C,
    keywords: ['graphics', 'social media', 'flyer', 'design', 'logo'],
  },
  {
    id: 'gimp', name: 'GIMP', publisher: 'The GIMP Team',
    description: 'Free, open-source image editing software for Windows, macOS and Linux. Use it for cropping, retouching and preparing photos.',
    goodFor: 'Editing photos without a subscription', category: 'content', type: 'software', audience: ['diy'],
    price: 'free', account: 'none', url: 'https://www.gimp.org/', checked: C,
    keywords: ['photo editor', 'image editing', 'open source', 'photoshop alternative'],
  },
  {
    id: 'inkscape', name: 'Inkscape', publisher: 'Inkscape Project',
    description: 'Free, open-source vector drawing software. Good for logos, icons and diagrams that need to stay sharp at any size.',
    goodFor: 'Logos and icons as SVG files', category: 'content', type: 'software', audience: ['diy'],
    price: 'free', account: 'none', url: 'https://inkscape.org/', checked: C,
    keywords: ['vector', 'svg', 'logo', 'illustrator alternative', 'open source'],
  },
  {
    id: 'figma', name: 'Figma Starter', publisher: 'Figma',
    description: 'A browser-based design tool for sketching page layouts and sharing them for feedback. The Starter plan is free with limited access.',
    goodFor: 'Sketching a page layout before it’s built', category: 'content', type: 'tool', audience: ['diy', 'website'],
    price: 'free-tier', priceNote: 'Professional and team plans are paid.', account: 'required',
    url: 'https://www.figma.com/pricing/', checked: C,
    keywords: ['wireframe', 'mockup', 'prototype', 'layout', 'design'],
  },

  {
    id: 'neatbo', name: 'Neatbo', publisher: 'Neatbo',
    description: 'Hundreds of small browser tools for everyday file tasks: merging PDFs, resizing and compressing images, converting text and data formats, and making QR codes. The site says files stay in your browser.',
    goodFor: 'Quick file fixes before you post or send them', category: 'content', type: 'tool', audience: ['running', 'website'],
    price: 'free-tier', priceNote: 'The tools are free; a paid Pro plan adds saved CSV workflows.', account: 'optional',
    url: 'https://neatbo.com/', checked: '2026-10-30',
    keywords: ['pdf', 'merge pdf', 'resize image', 'compress image', 'qr code', 'convert', 'json'],
  },
  {
    id: 'telugu-font-preview', name: 'Telugu font comparison', publisher: 'English in Telugu Typing',
    description: 'Type or paste Telugu text and see it in six free Unicode fonts side by side, at a size you choose. Each font links to its Google Fonts page and names its license. The site says your text stays in the browser.',
    goodFor: 'Choosing a Telugu font for a site or document', category: 'content', type: 'tool', audience: ['website', 'diy'],
    price: 'free', account: 'none', url: 'https://englishintelugutyping.com/telugu-fonts/', checked: '2026-11-01',
    keywords: ['telugu', 'fonts', 'unicode', 'google fonts', 'indian languages', 'typography'],
  },

  // ── Website platforms and web tools ───────────────────────────────
  {
    id: 'wordpress-org', name: 'WordPress', publisher: 'WordPress.org',
    description: 'Free, open-source website software you install on your own hosting. It also has a browser playground for trying it first. Hosting and a domain cost extra.',
    goodFor: 'A self-hosted site you can edit yourself', category: 'platforms', type: 'software', audience: ['diy', 'website'],
    price: 'free', priceNote: 'The software is free; hosting and a domain are not.', account: 'none',
    url: 'https://wordpress.org/download/', checked: C,
    keywords: ['cms', 'blog', 'website builder', 'open source', 'hosting'],
  },
  {
    id: 'lets-encrypt', name: 'Let’s Encrypt', publisher: 'Internet Security Research Group',
    description: 'A nonprofit certificate authority that issues free HTTPS certificates. Many web hosts and server tools request and renew them for you.',
    goodFor: 'Checking your host offers free HTTPS', category: 'platforms', type: 'service', audience: ['diy', 'website'],
    price: 'free', url: 'https://letsencrypt.org/', checked: C,
    keywords: ['ssl', 'tls', 'https', 'certificate', 'padlock'],
  },
  {
    id: 'cloudflare-free', name: 'Cloudflare Free plan', publisher: 'Cloudflare',
    description: 'A free plan that puts your site behind Cloudflare’s network, with HTTPS, caching and protection from traffic floods. You point your domain’s DNS at Cloudflare to use it.',
    goodFor: 'Adding a protective layer in front of a site', category: 'platforms', type: 'service', audience: ['diy'],
    price: 'free-tier', priceNote: 'Paid plans and add-ons exist.', account: 'required',
    url: 'https://www.cloudflare.com/plans/free/', checked: C,
    keywords: ['cdn', 'dns', 'ddos', 'ssl', 'performance'],
  },
  {
    id: 'pagespeed-insights', name: 'PageSpeed Insights', publisher: 'Google',
    description: 'Enter a web address to see how quickly the page loads on phones and computers, with a list of what slows it down.',
    goodFor: 'Finding out why a page feels slow', category: 'platforms', type: 'tool', audience: ['website', 'diy'],
    price: 'free', account: 'none', url: 'https://pagespeed.web.dev/', checked: C, start: true,
    keywords: ['speed', 'performance', 'core web vitals', 'lighthouse', 'slow'],
  },
  {
    id: 'ssl-labs', name: 'SSL Server Test', publisher: 'Qualys SSL Labs',
    description: 'Checks how a site’s HTTPS is set up and gives it a letter grade. Tick the option to keep your result off the public boards.',
    goodFor: 'Confirming HTTPS is set up properly', category: 'platforms', type: 'tool', audience: ['diy'],
    price: 'free', account: 'none', url: 'https://www.ssllabs.com/ssltest/', checked: C,
    keywords: ['ssl', 'tls', 'https', 'certificate', 'security test'],
  },
  {
    id: 'security-headers', name: 'Security Headers', publisher: 'Snyk',
    description: 'Scans a web address and grades the security headers its server sends.',
    goodFor: 'A quick check of a server’s security settings', category: 'platforms', type: 'tool', audience: ['diy'],
    price: 'free', account: 'none', url: 'https://securityheaders.com/', checked: C,
    keywords: ['csp', 'headers', 'security scan', 'hsts'],
  },
  {
    id: 'heyutils', name: 'HeyUtils', publisher: 'HeyUtils',
    description: 'Hundreds of small browser tools for web development: formatting and checking JSON, converting CSV and other data formats, testing regular expressions, and decoding tokens and timestamps. Most tools run in the browser; the network checks say what they send.',
    goodFor: 'Quick data and code checks while building a site', category: 'platforms', type: 'tool', audience: ['diy'],
    price: 'free', account: 'none', url: 'https://heyutils.com/', checked: '2026-11-01',
    keywords: ['json', 'formatter', 'validator', 'csv', 'regex', 'base64', 'jwt', 'developer tools'],
  },

  // ── Accessibility ─────────────────────────────────────────────────
  {
    id: 'w3c-easy-checks', name: 'Easy Checks: a first review of web accessibility', publisher: 'W3C Web Accessibility Initiative',
    description: 'Simple checks anyone can do on a page: titles, headings, image text, contrast, keyboard focus, zoom, captions and form labels. Each explains what to look for.',
    goodFor: 'A first accessibility review without special tools', category: 'accessibility', type: 'checklist', audience: ['website', 'running'],
    price: 'free', account: 'none', url: 'https://www.w3.org/WAI/test-evaluate/easy-checks/', checked: C, start: true,
    keywords: ['a11y', 'wcag', 'disability', 'review', 'audit'],
  },
  {
    id: 'wcag-quickref', name: 'How to Meet WCAG (Quick Reference)', publisher: 'W3C Web Accessibility Initiative',
    description: 'The full list of WCAG 2.2 requirements with techniques for each. Filter it by level and topic to keep it manageable.',
    goodFor: 'Looking up a specific accessibility rule', category: 'accessibility', type: 'reference', audience: ['diy'],
    price: 'free', account: 'none', url: 'https://www.w3.org/WAI/WCAG22/quickref/', checked: C,
    keywords: ['wcag 2.2', 'a11y', 'success criteria', 'standard'],
  },
  {
    id: 'webaim-wave', name: 'WAVE', publisher: 'WebAIM',
    description: 'Enter a web address to see accessibility problems marked on the page itself. Browser extensions check pages that are private or still in progress.',
    goodFor: 'Spotting missing labels and contrast problems', category: 'accessibility', type: 'tool', audience: ['website', 'diy'],
    price: 'free', priceNote: 'The online tool and extensions are free; the API is paid.', account: 'none',
    url: 'https://wave.webaim.org/', checked: C,
    keywords: ['a11y', 'checker', 'audit', 'extension', 'wcag'],
  },
  {
    id: 'webaim-contrast', name: 'Contrast Checker', publisher: 'WebAIM',
    description: 'Enter a text color and a background color to see whether they pass WCAG contrast levels for normal and large text.',
    goodFor: 'Checking brand colors are readable', category: 'accessibility', type: 'tool', audience: ['website', 'diy'],
    price: 'free', account: 'none', url: 'https://webaim.org/resources/contrastchecker/', checked: C,
    keywords: ['color', 'contrast ratio', 'a11y', 'readability'],
  },
  {
    id: 'ada-web-guidance', name: 'Guidance on web accessibility and the ADA', publisher: 'U.S. Department of Justice',
    description: 'The Justice Department’s plain explanation of why website accessibility matters under the ADA, with examples of common barriers.',
    goodFor: 'Understanding the legal background', category: 'accessibility', type: 'guide', audience: ['running', 'website'],
    price: 'free', account: 'none', url: 'https://www.ada.gov/resources/web-guidance/', checked: C,
    keywords: ['ada', 'law', 'disability', 'compliance', 'doj'],
  },
  {
    id: 'a11y-project-checklist', name: 'Accessibility checklist', publisher: 'The A11Y Project',
    description: 'A community checklist based on WCAG, grouped by content, keyboard, images, headings, forms, media and color. Useful as a review list during a build.',
    goodFor: 'Reviewing a build section by section', category: 'accessibility', type: 'checklist', audience: ['diy', 'website'],
    price: 'free', account: 'none', url: 'https://www.a11yproject.com/checklist/', checked: C,
    keywords: ['a11y', 'wcag', 'keyboard', 'forms', 'review'],
  },
  {
    id: 'nvda', name: 'NVDA screen reader', publisher: 'NV Access',
    description: 'A free screen reader for Windows. Use it to hear how a page reads to someone who can’t see the screen. The project asks for donations but doesn’t require one.',
    goodFor: 'Testing a site the way blind visitors use it', category: 'accessibility', type: 'software', audience: ['diy'],
    price: 'free', priceNote: 'Windows only.', account: 'none', url: 'https://www.nvaccess.org/download/', checked: C,
    keywords: ['screen reader', 'blind', 'testing', 'windows', 'a11y'],
  },

  {
    id: 'colorpairlab', name: 'ColorPairLab', publisher: 'ColorPairLab',
    description: 'Browser tools that check text and background colors against WCAG contrast levels, convert between HEX, RGB and HSL, and build a palette with every color pair checked.',
    goodFor: 'Picking site colors that stay readable', category: 'accessibility', type: 'tool', audience: ['website', 'diy'],
    price: 'free', account: 'none', url: 'https://colorpairlab.online/', checked: '2026-10-30',
    keywords: ['color', 'contrast ratio', 'palette', 'wcag', 'a11y', 'hex', 'rgb'],
  },

  // ── Search visibility and analytics ───────────────────────────────
  {
    id: 'google-search-console', name: 'Google Search Console', publisher: 'Google',
    description: 'Shows which searches bring people to your site, which pages Google has indexed and any problems it found. You verify that you own the site first.',
    goodFor: 'Seeing how your site appears in Google', category: 'search', type: 'tool', audience: ['website', 'running'],
    price: 'free', account: 'required', url: 'https://search.google.com/search-console/about', checked: C, start: true,
    keywords: ['seo', 'indexing', 'sitemap', 'search traffic', 'google'],
  },
  {
    id: 'google-seo-starter-guide', name: 'SEO Starter Guide', publisher: 'Google Search Central',
    description: 'Google’s own explanation of how search finds and shows pages, and what a site owner can sensibly do about it. A good antidote to SEO myths.',
    goodFor: 'Knowing what actually matters for search', category: 'search', type: 'guide', audience: ['website', 'diy'],
    price: 'free', account: 'none', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', checked: C,
    keywords: ['seo', 'search engine optimization', 'ranking', 'google'],
  },
  {
    id: 'bing-webmaster-tools', name: 'Bing Webmaster Tools', publisher: 'Microsoft',
    description: 'Microsoft’s version of Search Console: search performance, indexing reports and site diagnostics for Bing.',
    goodFor: 'Covering searches that don’t start on Google', category: 'search', type: 'tool', audience: ['website'],
    price: 'free', account: 'required', url: 'https://www.bing.com/webmasters/about', checked: C,
    keywords: ['seo', 'bing', 'indexing', 'microsoft'],
  },
  {
    id: 'google-business-profile', name: 'Google Business Profile', publisher: 'Google',
    description: 'A free listing that controls how your business appears in Google Search and Maps: hours, photos, services and replies to reviews.',
    goodFor: 'Local businesses people search for by name or nearby', category: 'search', type: 'tool', audience: ['running', 'starting'],
    price: 'free', account: 'required', url: 'https://business.google.com/us/business-profile/', checked: C, start: true,
    keywords: ['google maps', 'local seo', 'listing', 'reviews', 'hours'],
  },
  {
    id: 'bing-places', name: 'Bing Places for Business', publisher: 'Microsoft',
    description: 'A free business listing for Bing search and maps. Claim your listing and keep its details current.',
    goodFor: 'Keeping your details right on Bing', category: 'search', type: 'tool', audience: ['running'],
    price: 'free', account: 'required', url: 'https://www.bing.com/forbusiness/', checked: C,
    keywords: ['bing maps', 'local listing', 'microsoft'],
  },
  {
    id: 'google-analytics', name: 'Google Analytics', publisher: 'Google',
    description: 'Visitor statistics for websites and apps: how many people come, where from and what they do. Adding it usually means updating your privacy notice and, in some places, asking for consent.',
    goodFor: 'Measuring which pages and channels work', category: 'search', type: 'tool', audience: ['website', 'running'],
    price: 'free', priceNote: 'A paid enterprise version exists.', account: 'required',
    url: 'https://marketingplatform.google.com/about/analytics/', checked: C,
    keywords: ['analytics', 'traffic', 'statistics', 'ga4', 'visitors'],
  },

  // ── Marketing and customer communication ──────────────────────────
  {
    id: 'ftc-can-spam', name: 'CAN-SPAM Act: a compliance guide for business', publisher: 'Federal Trade Commission',
    description: 'The rules for commercial email in plain terms: honest subject lines, a postal address, a working unsubscribe link and how quickly to honor it.',
    goodFor: 'Anyone starting an email newsletter', category: 'marketing', type: 'guide', audience: ['running'],
    price: 'free', account: 'none', url: 'https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business', checked: C, start: true,
    keywords: ['email marketing', 'newsletter', 'unsubscribe', 'law', 'spam'],
  },
  {
    id: 'ftc-endorsement-guides', name: 'Endorsement Guides: what people are asking', publisher: 'Federal Trade Commission',
    description: 'Questions and answers on reviews, testimonials and influencer posts: when a connection must be disclosed and how to make it clear.',
    goodFor: 'Using reviews and testimonials honestly', category: 'marketing', type: 'guide', audience: ['running'],
    price: 'free', account: 'none', url: 'https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking', checked: C,
    keywords: ['reviews', 'testimonials', 'influencer', 'disclosure', 'law'],
  },
  {
    id: 'sba-manage-your-business', name: 'Manage your business', publisher: 'U.S. Small Business Administration',
    description: 'Official guides for the running stage: marketing plans, finances, hiring, taxes, staying compliant and preparing for emergencies.',
    goodFor: 'A checklist of what a running business needs', category: 'marketing', type: 'guide', audience: ['running'],
    price: 'free', account: 'none', url: 'https://www.sba.gov/counseling/manage-your-business/', checked: C,
    keywords: ['marketing plan', 'hiring', 'compliance', 'emergency plan'],
  },
  {
    id: 'mailerlite', name: 'MailerLite Free', publisher: 'MailerLite',
    description: 'Email newsletter software with a free plan for small lists.',
    goodFor: 'A first newsletter to a small list', category: 'marketing', type: 'software', audience: ['running'],
    price: 'free-tier', priceNote: 'The free plan caps subscribers and monthly emails; paid plans remove the caps.', account: 'required',
    url: 'https://www.mailerlite.com/pricing', checked: C,
    keywords: ['email marketing', 'newsletter', 'mailing list', 'campaign'],
  },
  {
    id: 'hubspot-academy', name: 'HubSpot Academy', publisher: 'HubSpot',
    description: 'Free online courses on marketing, social media and related business topics. Some courses teach HubSpot’s own products.',
    goodFor: 'Learning marketing basics at your own pace', category: 'marketing', type: 'course', audience: ['running', 'starting'],
    price: 'free', priceNote: 'Expect product promotion alongside the lessons.', url: 'https://academy.hubspot.com/courses', checked: C,
    keywords: ['marketing course', 'social media', 'sales', 'certification'],
  },

  // ── Booking, forms and operations ─────────────────────────────────
  {
    id: 'calendly', name: 'Calendly Free', publisher: 'Calendly',
    description: 'A booking page where customers pick a time from your availability. The free plan covers one type of one-to-one appointment linked to one calendar.',
    goodFor: 'Letting people book a single kind of appointment', category: 'operations', type: 'software', audience: ['running'],
    price: 'free-tier', priceNote: 'More event types, team scheduling and integrations are paid.', account: 'required',
    url: 'https://calendly.com/pricing', checked: C,
    keywords: ['booking', 'scheduling', 'appointments', 'calendar'],
  },
  {
    id: 'cal-com', name: 'Cal.com Free', publisher: 'Cal.com',
    description: 'Scheduling software with a free plan for one person. Its code is published, so a developer can also host it on your own server.',
    goodFor: 'Booking for a solo business, or a self-hosted option', category: 'operations', type: 'software', audience: ['running', 'diy'],
    price: 'free-tier', priceNote: 'Team features and removing its branding are paid.', account: 'required',
    url: 'https://cal.com/pricing', checked: C,
    keywords: ['booking', 'scheduling', 'appointments', 'self-hosted', 'open source'],
  },
  {
    id: 'square-appointments', name: 'Square Appointments Free', publisher: 'Square',
    description: 'Booking software with a free plan for solo professionals: an online booking site, reminders and staff calendars. Taking card payments through Square has processing fees.',
    goodFor: 'Service businesses that take payments when booking', category: 'operations', type: 'software', audience: ['running'],
    price: 'free-tier', priceNote: 'Card processing fees apply; larger plans are paid.', account: 'required',
    url: 'https://squareup.com/us/en/appointments/pricing', checked: C,
    keywords: ['booking', 'salon', 'appointments', 'payments', 'pos'],
  },
  {
    id: 'trello', name: 'Trello Free', publisher: 'Atlassian',
    description: 'Boards of cards for tracking tasks, orders or jobs as they move from to-do to done. The free plan suits a small team.',
    goodFor: 'Seeing everyday work at a glance', category: 'operations', type: 'software', audience: ['running', 'starting'],
    price: 'free-tier', priceNote: 'Collaborators and boards per workspace are capped on the free plan.', account: 'required',
    url: 'https://trello.com/pricing', checked: C,
    keywords: ['kanban', 'tasks', 'project management', 'to-do'],
  },
  {
    id: 'libreoffice', name: 'LibreOffice', publisher: 'The Document Foundation',
    description: 'A free, open-source office suite with a word processor, spreadsheets, presentations, drawing and a database.',
    goodFor: 'Documents and spreadsheets without a subscription', category: 'operations', type: 'software', audience: ['starting', 'running'],
    price: 'free', account: 'none', url: 'https://www.libreoffice.org/', checked: C,
    keywords: ['office', 'spreadsheet', 'word processor', 'open source', 'documents'],
  },
  {
    id: 'print-calendar-lab', name: 'Print Calendar Lab', publisher: 'Print Calendar Lab',
    description: 'Makes printable monthly and yearly calendars. Choose the layout, paper size, orientation, first day of the week and which country’s holidays to show, then print or download a PDF.',
    goodFor: 'A printed calendar for deadlines, shifts or bookings', category: 'operations', type: 'tool', audience: ['running'],
    price: 'free', priceNote: 'The site shows ads. A separate iOS app has paid options.', account: 'none',
    url: 'https://printcalendarlab.com/', checked: '2026-11-01',
    keywords: ['calendar', 'printable', 'pdf', 'planner', 'holidays', 'schedule'],
  },
  {
    id: 'stackpdf-client-paperwork-checklist', name: 'Client paperwork checklist', publisher: 'Stack PDF',
    description: 'A free, downloadable checklist for reviewing client PDFs before you send them. It covers completeness, page order, readability, signatures, sensitive information, file size, filenames and a final attachment check. No signup is needed.',
    goodFor: 'A final check before sending paperwork to a client', category: 'operations', type: 'checklist', audience: ['running'],
    price: 'free', account: 'none', url: 'https://stackpdf.com/#client-paperwork-checklist', checked: '2026-11-01',
    keywords: ['pdf', 'checklist', 'client paperwork', 'documents', 'signatures', 'attachments', 'redaction', 'file size'],
  },

  // ── Cybersecurity and privacy ─────────────────────────────────────
  {
    id: 'ftc-cybersecurity', name: 'Cybersecurity for small business', publisher: 'Federal Trade Commission',
    description: 'Short FTC guides on the basics: passwords and multi-factor sign-in, email authentication, remote access, choosing a web host, vendors and common attacks like phishing and ransomware.',
    goodFor: 'A practical security baseline for a small team', category: 'security', type: 'guide', audience: ['running', 'starting'],
    price: 'free', account: 'none', url: 'https://www.ftc.gov/business-guidance/small-businesses/cybersecurity', checked: C, start: true,
    keywords: ['phishing', 'ransomware', 'passwords', 'mfa', 'email spoofing', 'dmarc'],
  },
  {
    id: 'ftc-protecting-personal-information', name: 'Protecting personal information', publisher: 'Federal Trade Commission',
    description: 'Five steps for customer data: know what you keep, keep less, lock it up, dispose of it properly and plan for problems.',
    goodFor: 'Businesses that keep customer details', category: 'security', type: 'guide', audience: ['running'],
    price: 'free', account: 'none', url: 'https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business', checked: C,
    keywords: ['privacy', 'customer data', 'data protection', 'records'],
  },
  {
    id: 'ftc-data-breach-response', name: 'Data breach response', publisher: 'Federal Trade Commission',
    description: 'What to do after a breach: secure systems, fix the cause and notify the right people, with a model notification letter.',
    goodFor: 'Having a plan before you need one', category: 'security', type: 'guide', audience: ['running'],
    price: 'free', account: 'none', url: 'https://www.ftc.gov/business-guidance/resources/data-breach-response-guide-business', checked: C,
    keywords: ['breach', 'incident', 'hack', 'notification'],
  },
  {
    id: 'cisa-cyber-essentials', name: 'Cyber Essentials', publisher: 'Cybersecurity and Infrastructure Security Agency',
    description: 'A guide for small business leaders that splits security into six areas, from staff and systems to data and crisis response. It links to a starter kit and toolkits.',
    goodFor: 'Owners who want the big picture first', category: 'security', type: 'guide', audience: ['running'],
    price: 'free', account: 'none', url: 'https://www.cisa.gov/resources-tools/resources/cyber-essentials', checked: C,
    keywords: ['cisa', 'security plan', 'culture', 'toolkit'],
  },
  {
    id: 'nist-small-business-cyber', name: 'Small Business Cybersecurity Corner', publisher: 'National Institute of Standards and Technology',
    description: 'NIST’s collection for small businesses: quick-start guides, topics like phishing and multi-factor sign-in, training videos and a finder for regional support programs.',
    goodFor: 'Going deeper on a specific security topic', category: 'security', type: 'reference', audience: ['running', 'diy'],
    price: 'free', account: 'none', url: 'https://www.nist.gov/itl/smallbusinesscyber', checked: C,
    keywords: ['nist', 'cybersecurity framework', 'phishing', 'mfa', 'training'],
  },
  {
    id: 'bitwarden', name: 'Bitwarden Free', publisher: 'Bitwarden',
    description: 'A password manager with a free account for one person, and free sharing with one other user. It stores and fills strong, unique passwords.',
    goodFor: 'Ending password reuse', category: 'security', type: 'software', audience: ['running', 'starting'],
    price: 'free-tier', priceNote: 'Team and business plans are paid.', account: 'required',
    url: 'https://bitwarden.com/pricing/', checked: C,
    keywords: ['password manager', 'passwords', 'security', 'sharing'],
  },

  // ── Finance and recordkeeping ─────────────────────────────────────
  {
    id: 'irs-small-business-tax-center', name: 'Small business and self-employed tax center', publisher: 'Internal Revenue Service',
    description: 'The IRS starting point for business taxes, with sections on business structures, tax ID numbers, operating a business and free online learning.',
    goodFor: 'Finding the right official tax page', category: 'finance', type: 'reference', audience: ['starting', 'running'],
    price: 'free', account: 'none', url: 'https://www.irs.gov/businesses/small-businesses-self-employed', checked: C,
    keywords: ['taxes', 'self-employed', 'estimated tax', 'irs'],
  },
  {
    id: 'irs-recordkeeping', name: 'Recordkeeping', publisher: 'Internal Revenue Service',
    description: 'Why records matter and what to keep. The IRS accepts any system that clearly shows your income and expenses.',
    goodFor: 'Setting up records before tax time', category: 'finance', type: 'guide', audience: ['starting', 'running'],
    price: 'free', account: 'none', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/recordkeeping', checked: C, start: true,
    keywords: ['records', 'receipts', 'bookkeeping', 'taxes'],
  },
  {
    id: 'irs-pub-583', name: 'Publication 583: Starting a business and keeping records', publisher: 'Internal Revenue Service',
    description: 'A longer IRS publication covering business types, tax IDs, tax years, the taxes you may owe and the records to keep.',
    goodFor: 'A complete read before your first tax year', category: 'finance', type: 'book', audience: ['starting'],
    price: 'free', account: 'none', url: 'https://www.irs.gov/publications/p583', checked: C,
    keywords: ['taxes', 'new business', 'records', 'irs publication'],
  },
  {
    id: 'wave', name: 'Wave Starter', publisher: 'Wave Financial',
    description: 'Invoicing and bookkeeping software with a free Starter plan for estimates, invoices and records. Online card payments have fees; payroll and some features cost extra.',
    goodFor: 'Sending invoices and tracking income', category: 'finance', type: 'software', audience: ['starting', 'running'],
    price: 'free-tier', priceNote: 'Payment processing, payroll and the Pro plan are paid.', account: 'required',
    url: 'https://www.waveapps.com/pricing', checked: C,
    keywords: ['invoicing', 'accounting', 'bookkeeping', 'invoices'],
  },
  {
    id: 'gnucash', name: 'GnuCash', publisher: 'GnuCash Project',
    description: 'Free, open-source accounting software for Windows, macOS and Linux. It runs on your own computer rather than online.',
    goodFor: 'Bookkeeping without a subscription', category: 'finance', type: 'software', audience: ['running', 'diy'],
    price: 'free', account: 'none', url: 'https://www.gnucash.org/', checked: C,
    keywords: ['accounting', 'bookkeeping', 'open source', 'desktop'],
  },
  {
    id: 'dol-flsa-wages', name: 'Wages and the Fair Labor Standards Act', publisher: 'U.S. Department of Labor',
    description: 'The federal rules on minimum wage, overtime, hours worked and pay records. States can set their own, higher rules.',
    goodFor: 'Before you hire your first employee', category: 'finance', type: 'reference', audience: ['running', 'starting'],
    price: 'free', account: 'none', url: 'https://www.dol.gov/agencies/whd/flsa', checked: C,
    keywords: ['minimum wage', 'overtime', 'payroll', 'hiring', 'employees'],
  },

  // ── Learning ──────────────────────────────────────────────────────
  {
    id: 'openstax-entrepreneurship', name: 'Entrepreneurship (textbook)', publisher: 'OpenStax, Rice University',
    description: 'A free college textbook on entrepreneurship. Read it online or as a PDF; it includes a business plan in several formats.',
    goodFor: 'A structured introduction to starting a business', category: 'learning', type: 'book', audience: ['starting'],
    price: 'free', priceNote: 'Print copies are sold separately.', account: 'none',
    url: 'https://openstax.org/details/books/entrepreneurship', checked: C,
    keywords: ['textbook', 'business plan', 'startup', 'course'],
  },
  {
    id: 'learnfree', name: 'LearnFree (GCFGlobal)', publisher: 'Goodwill Community Foundation',
    description: 'Free, self-paced lessons on the practical skills people use at work and at home, including everyday technology. Good for staff who are new to computers.',
    goodFor: 'Building basic computer confidence', category: 'learning', type: 'course', audience: ['running', 'starting'],
    price: 'free', url: 'https://www.learnfree.org/', checked: C,
    keywords: ['computer basics', 'excel', 'email', 'digital skills', 'gcfglobal'],
  },
  {
    id: 'mdn-learn', name: 'Learn web development', publisher: 'MDN Web Docs (Mozilla)',
    description: 'A structured set of tutorials on HTML, CSS and JavaScript, written by the community behind the main web reference.',
    goodFor: 'Learning how websites are really built', category: 'learning', type: 'course', audience: ['diy'],
    price: 'free', account: 'none', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development', checked: C,
    keywords: ['html', 'css', 'javascript', 'web development', 'tutorial'],
  },
  {
    id: 'web-dev-learn', name: 'Learn courses on web.dev', publisher: 'Google Chrome team',
    description: 'Free online courses on HTML, CSS, JavaScript, accessibility, performance and privacy, one topic per course.',
    goodFor: 'Focused lessons on one part of a site', category: 'learning', type: 'course', audience: ['diy'],
    price: 'free', account: 'none', url: 'https://web.dev/learn', checked: C,
    keywords: ['html', 'css', 'accessibility', 'performance', 'forms'],
  },
  {
    id: 'freecodecamp', name: 'freeCodeCamp', publisher: 'freeCodeCamp.org',
    description: 'A charity’s free, project-based curriculum in programming and related skills, with certifications.',
    goodFor: 'Learning to code by building projects', category: 'learning', type: 'course', audience: ['diy'],
    price: 'free', url: 'https://www.freecodecamp.org/', checked: C,
    keywords: ['coding', 'programming', 'javascript', 'certification', 'bootcamp'],
  },
  {
    id: 'the-odin-project', name: 'The Odin Project', publisher: 'The Odin Project',
    description: 'A free, open-source full-stack curriculum that puts outside tutorials and readings in order and has you build projects along the way.',
    goodFor: 'A complete path from beginner to building apps', category: 'learning', type: 'course', audience: ['diy'],
    price: 'free', url: 'https://www.theodinproject.com/', checked: C,
    keywords: ['full stack', 'javascript', 'ruby', 'web development', 'curriculum'],
  },
  {
    id: 'cs50x', name: 'CS50x: Introduction to Computer Science', publisher: 'Harvard University',
    description: 'Harvard’s introductory computer science course, free online with lectures, problem sets and a final project. A good foundation before specializing.',
    goodFor: 'Understanding programming from the ground up', category: 'learning', type: 'course', audience: ['diy'],
    price: 'free', priceNote: 'Paid certificates and credit are offered separately.', account: 'none',
    url: 'https://cs50.harvard.edu/x/', checked: C,
    keywords: ['computer science', 'programming', 'python', 'harvard', 'course'],
  },
];

export const categoryById = Object.fromEntries(categories.map((c) => [c.id, c])) as Record<CategoryId, Category>;
export const resourceById = Object.fromEntries(resources.map((r) => [r.id, r])) as Record<string, Resource>;
export const inCategory = (id: CategoryId) => resources.filter((r) => r.category === id);
export const startHere = resources.filter((r) => r.start);
export const publisherHost = (r: Resource) => new URL(r.url).hostname.replace(/^www\./, '');

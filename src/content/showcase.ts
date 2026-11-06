// The home page's "What I’ve built": one featured project and three supporting
// ones. Every portfolio project (an independent project or a concept with a
// working demo; no tools or games) can be featured, and has a share link,
// /p/<code>/, that opens the home page with it featured (pages/p/[code].astro).
// The plain home page features one at random per browser session
// (scripts/showcase.ts); without JavaScript it shows the first in `showcase`.
//
// Share links are public, unlisted addresses: not in the nav, the sitemap or
// /work/, and noindex. The code is opaque (lib/share-code.ts): the address
// names neither the project nor the prospect.
import { inquiryDemos, type Demo } from './demos';
import { nextAfter } from '../lib/rotation';
import { shareCode } from '../lib/share-code';

const rank = (d: Demo) => (d.type === 'independent' ? 0 : d.featured !== undefined ? 1 : 2);

/** Fixed rotation: independent projects, then the home page's featured concepts, then the rest. */
export const showcase: Demo[] = [...inquiryDemos].sort((a, b) =>
  rank(a) - rank(b) || (a.featured ?? 0) - (b.featured ?? 0) || a.order - b.order);

export const showcaseSlugs = showcase.map((d) => d.slug);
export const defaultFeature = showcaseSlugs[0];

/** The next three projects after `slug` in the rotation, so every project page looks the same each time. */
export const supportingFor = (slug: string): Demo[] => nextAfter(showcase, showcase.find((d) => d.slug === slug)!, 3);

export const sharePath = (slug: string) => `/p/${shareCode(slug)}/`;

/** Share code → project. Fails the build if two projects ever get the same code. */
export const shareCodes = new Map(showcaseSlugs.map((slug) => [shareCode(slug), slug]));
if (shareCodes.size !== showcaseSlugs.length) throw new Error('showcase: two projects have the same share code');

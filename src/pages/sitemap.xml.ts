import type { APIRoute } from 'astro';
import { site } from '../site';
import { projects } from '../content/projects';
import { services } from '../content/services';

// Small enough to list by hand; no integration needed.
export const GET: APIRoute = async () => {
  const paths = [
    '/', '/work/', '/explore/', '/arcade/', '/arcade/patch-quest/', '/arcade/after-hours/', '/arcade/cross-wire/', '/services/', ...services.map((s) => `/services/${s.slug}/`),
    ...projects.filter((p) => p.notes?.length).map((p) => `/work/${p.slug}/`),
    '/resources/suggest/',
    '/privacy/', '/terms/',
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${new URL(p, site.url).href}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};

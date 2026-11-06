import type { APIRoute } from 'astro';
import { site, isPreview } from '../site';

// Preview builds ask crawlers to stay out entirely (see site.contact.emailVerified).
export const GET: APIRoute = () =>
  new Response(
    isPreview
      ? 'User-agent: *\nDisallow: /\n'
      : `User-agent: *\nAllow: /\nDisallow: /preview/\nDisallow: /clients/\nDisallow: /resources/wp-admin/\nAllow: /resources/wp-admin/admin-ajax.php\n\n`
        // /resources/ is WordPress, with its own sitemap.
        + `Sitemap: ${new URL('/sitemap.xml', site.url).href}\nSitemap: ${new URL('/resources/wp-sitemap.xml', site.url).href}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );

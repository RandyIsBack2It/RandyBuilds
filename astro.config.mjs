// @ts-check
import { defineConfig } from 'astro/config';

// Static site for https://randybuilds.tech, served from the root of its own
// nginx container. No adapters or integrations: the sitemap is a tiny
// endpoint (src/pages/sitemap.xml.ts).
export default defineConfig({
  site: 'https://randybuilds.tech',
  trailingSlash: 'ignore',
  build: { format: 'directory', assets: '_astro', inlineStylesheets: 'never' },
  compressHTML: true,
  // Ship every asset as a file so the CSP can stay strict (no data: fonts).
  vite: { build: { assetsInlineLimit: 0 } },
});

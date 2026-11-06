// @ts-check
import { defineConfig } from 'astro/config';

// Private client previews (/preview/<id>/). A separate build so none of these
// files land in the public site root: the Dockerfile copies previews/dist to
// /usr/share/nginx/private/preview, which nginx serves only after the gate
// accepts the visitor's session cookie. Build: astro build --root previews
export default defineConfig({
  site: 'https://randybuilds.tech',
  base: '/preview',
  trailingSlash: 'ignore',
  build: { format: 'directory', assets: '_assets', inlineStylesheets: 'never' },
  compressHTML: true,
  vite: { build: { assetsInlineLimit: 0 } },
});

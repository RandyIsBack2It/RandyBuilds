# Resources: where they live

Resources are one site: **https://randybuilds.tech/resources/**, self-hosted WordPress in
`wordpress/` (read `wordpress/README.md`). Listings and guides are edited there
(`/resources/wp-admin/`).

The main site's nginx passes `/resources/…` to the WordPress container (`nginx.conf`, "Resources").
The old static hub was removed on 2026-10-27; its pages are in git history. Redirects:

| Old | New |
|---|---|
| `/resources/guides/` | `/resources/topic/guides/` |
| `/resources/guides/<slug>/` | `/resources/<slug>/` |
| `https://resources.randybuilds.tech/<path>` | `https://randybuilds.tech/resources/<path>` (WordPress's Apache) |

`/resources/directory/` is the same address on WordPress.

## What stays on the main site

- **`/resources/suggest/`** (`src/pages/resources/suggest.astro`): suggest a resource or report a
  listing. It posts to the mailer (`/api/contact`, `kind=resource|report`), with the same honeypot,
  timing check, Turnstile and rate limits as the contact form. One email to `connect@`; nothing is
  published automatically. WordPress links to it (footer, home page, each listing's "Report a problem").
  `?report=<slug>` preselects a listing.
- **`src/content/resources.ts`**: the listing names for the report dropdown. A listing added only in
  WordPress isn't in it; add a row (and to `RESOURCE_RESEARCH.md`) so it can be reported by name.
  `node tests/resources.mjs` checks the data.
- Header nav "Resources" and the footer link point to `/resources/`.

## Rules (both sites)

Own-words descriptions, official URLs, a checked date, "Free" / "Free tier" / "Free trial", no
third-party prices, never an endorsement. No accounts, comments, profiles or community activity
exist: never fake them.

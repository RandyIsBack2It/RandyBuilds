# RandyBuilds.tech — guidance for Claude

Portfolio and client site for https://randybuilds.tech (live since 2026-10-12). Static Astro site
served by unprivileged nginx, plus a tiny dependency-free mailer for the contact form
(`mailer/server.mjs`, Resend). No database, no accounts.

## Isolation (non-negotiable)
- Fully separate from the unmaskd. platform (`/mnt/nvme/unmaskd.app`) and from
  `/mnt/nvme/unmaskd-designs`. Never run their deploy scripts or compose files from here.
- Deploy only with `tech` (= `scripts/deploy.sh`). It touches only the `randybuilds-tech`
  Compose project, its images and the `randybuilds-edge` network.
- The shared Caddyfile, Cloudflare Tunnel and DNS are changed only with Randy's explicit
  approval. The prepared change is `deploy/randybuilds.tech.caddy`; steps in `deploy/LAUNCH.md`.
- Never `compose down` other projects, never prune, never kill by pattern.

## Content rules
- **unmaskd.** is listed as the first independent project (Randy, 2026-10-12), linked to
  getunmaskd.com. Describe Randy only as its designer/builder who set up its infrastructure — never
  as the person who runs or operates it. Screenshots: public pages only, sample profiles only.
  On the home page it appears ONLY in #work ("Independent projects") — not in the hero, About,
  services, FAQ or anywhere else, not even indirectly ("a social platform") (Randy, 2026-10-14).
  Its project page and service-page "Related work" keep the full detail.
- Never invent clients, testimonials, results, years of experience or certifications.
- **Private client previews** (Randy, 2026-10-15) are the one exception to "concepts are fictional": website
  concepts for real prospective clients, built from their own current site (their text, photos, facts),
  to show what their site could become. Rules: password-protected under `/preview/<id>/` only; never in the
  portfolio, nav, sitemap, Work pages or anywhere public; every page carries the "Website concept prepared by
  RandyBuilds.tech — For demonstration purposes." banner; forms are demos that send nothing; facts only from
  their site (no invented reviews, claims, prices or hours); nothing that implies they commissioned or approved
  it. Earlier client previews have been removed and are not part of this repository. The gate, vault and client container stay for future previews. Licensed stock photos only for atmosphere (never as product photos), captioned “Illustrative
  photo” and credited. Add others only when Randy asks.
- **Client container** (Randy, 2026-10-30): every `clients/<id>/` with an `astro.config.mjs` is built by `clients/Dockerfile`
  (base `CLIENT_BASE=/preview/<id>/`) into `randybuilds-tech-clients` (nginx, internal network only). The site's nginx
  checks the gate, serves its own private files, else proxies to that container (`@client_static`). `tech clients`
  commits only `clients/`, pushes, rebuilds and restarts only `randybuilds-tech-clients` (rolls it
  back if unhealthy); main site, mailer and gate untouched. Other changes wait for `tech`.
- `clients/<id>/` is a client's own self-contained project (own package.json, catalog, Dockerfile, compose
  project, HANDOVER.md). The RandyBuilds.tech image can build a demo of it into
  `/preview/<id>/`; its production deploy is separate and needs the owner's and Randy's approval (edge + DNS).
- Concept work is for **fictional** businesses: `kind: 'concept'`, labelled "Concept demonstration" (2026-10-22),
  sample prices, demo forms that send nothing, `noindex`.
- Fixed-price, project-based; no hourly rates, no "unlimited revisions". Price guidance (Randy, 2026-10-31): simple
  small-business websites start at $700 (standard base price, not an introductory offer; no demo or mockup included);
  larger, multi-page or feature-rich sites and redesigns are quoted individually after the scope is agreed; no other
  figures. Typical project sizes live only in `src/content/pricing.ts`
  (shown on /services/#pricing, the websites/redesigns/web-apps pages, one FAQ answer, the form's budget
  choices and `homePriceCue` on the home Business websites card, linked to /services/#pricing — 2026-10-22). Always framed as starting points, not quotes; no other prices or estimates anywhere.
- Brand (Randy, 2026-10-18): always written **RandyBuilds.tech** (`site.name`; wordmark **Randy**Builds.tech).
  URLs and email addresses stay lowercase.
- Don't imply incorporation or licensing. Footer is just "© year RandyBuilds.tech".
- Emphasise written scope and a fixed price before work starts. Never imply consultations need phone or video
  calls: the first step is a "Free project review by email" (`site.review`), no meeting required.
- Positioning (Randy, 2026-10-22): new builds and well-defined projects. Don't advertise rescuing stalled projects,
  taking over abandoned or unfinished codebases, or acting as a replacement team. Redesigns and clearly scoped
  fixes/features for existing websites are fine (`existing-projects` = "Website improvements", URL kept). Labels
  (2026-10-22): "Website redesigns" = a broader rebuild or change of look/structure; "Website improvements" = a clearly
  scoped fix or feature on a site that mostly works. Keep the two apart in titles, cards and links. Explore has
  no "something unfinished" answer or "finishing" suggestion (tested).
- AI-assisted development is not a selling point; don't feature it.
- FAQ answers (index.astro `faqs`) state only facts Randy confirmed on 2026-10-12: clients own their
  site, he can host it (quoted separately), help after launch (quoted first), help with content; plus
  typical project sizes (2026-10-22, built from pricing.ts).
  Ask before adding any other answer (timelines, self-editing, service area, etc.).
- Copy pass (Randy, 2026-10-13): each fact has one home on the home page — fixed price → process step 2
  + FAQ; free project review + reply time → Contact (and the CTA band on other pages); working with Randy
  directly → hero points and the About lede (Randy, 2026-10-22); unmaskd. features/infrastructure → its project page only. Don't re-add them
  elsewhere. About (rewritten 2026-10-14): independent web developer; practical, problem-first approach;
  defined scope agreed in writing; range of work (new sites, redesigns, custom apps, improvements);
  design, code and server; can keep it running after launch; open to people and businesses of all kinds.
- Editorial revision (2026-10-14, agreed by ChatGPT and Claude under Randy's conditional authorization):
  About (2026-10-18) is one home section with the process: "About Randy" + lede + "How I work" (problem-first; no
  technical background needed; everything can be done in writing) beside "How a project works" (`#process`); scope,
  progress, testing and handover live only in the process steps (Project discussion · Proposal and agreed
  scope · Design, development and review · Handover). "Handover", not "launch", is the deliverable.
  Home service cards are the three categories with short item lists (2026-10-22; no `~/services/` paths); service pages gained factual
  "How it's scoped"-style notes. The existing-project review fee is unspecified — don't call it free or paid.
  unmaskd. is not Related work on /services/existing-projects/ (not a takeover). No timeline/self-editing FAQs.
  Professional tone — no hobbyist lines ("I like making things"), no personal unmaskd. story. American spelling.
- Contact: the form on the home page (→ mailer → Resend → `connect@randybuilds.tech`, Reply-To = visitor)
  plus the address itself as a fallback. `connect@` is a Zoho Mail mailbox (MX → Zoho since about
  2026-10-14; Cloudflare Email Routing is no longer in the path). Zoho filed form mail from forms@getunmaskd.com as spam
  (2026-10-24): allowlist it in Zoho, or verify randybuilds.tech in Resend and set `RBT_MAIL_FROM`. Mailer secrets live only in this project's `.env` (chmod 600): `RESEND_API_KEY` (send-only
  key, shared with the unmaskd. account; sends from `forms@getunmaskd.com` until randybuilds.tech is
  verified in Resend, then set `RBT_MAIL_FROM`). Never print it. Form messages: keep `MESSAGES` in
  `mailer/server.mjs` and `src/scripts/contact.ts` identical.
  Spam check (2026-10-26): Cloudflare Turnstile on every form. Site key (public) = `site.turnstileSiteKey`; secret =
  `TURNSTILE_SECRET_KEY` in `.env`. The mailer enforces it only when the secret is set (fails closed if Cloudflare is
  unreachable; no-JS posts then land on /message-not-sent/). The widget loads only when a form is near, stays invisible
  unless Cloudflare needs a click, and uses Cloudflare's test key on localhost. CSP allows challenges.cloudflare.com
  (script + frame) on public pages; Privacy names it. Browser tests stub it (`tests/turnstile-stub.mjs`).
- If `emailVerified` is set to false the site shows preview notices, is `noindex`, and `tech release` refuses to run.

## Voice (same principle as unmaskd.)
Plain language, sentences under ~20 words, one idea per sentence. Assert, don't justify:
no rationale sentence just because one is available. No exclamation marks, no hype,
no quote marks for effect. It's a portfolio; keep it short.

## Site structure (v5, 2026-10-18, Randy approved the audit's Option A+)
Header nav: Services (/services/) · Work (/work/) · Resources (/resources/, WordPress, 2026-10-27) · About (/#about) · FAQ (/#faq) + "Start a project" (phone menu below 62rem so it fits). On the home
page a band-coloured indicator slides under the item whose section is in view. Labels must match their destination.
One-page home, six sections: hero (intro + three points: work directly with the builder, written scope and fixed
price, free project review by email) · #services (the three `categories` in services.ts: Business websites, Custom
applications and business tools, Website improvements; + Explore line, `#explore` anchor) · #work (one featured
project + 3 compact cards "More projects" + "See all work"; see Share links below) · #about (with #process) · #faq · #contact ("Free project review by email";
form; `?topic=<service>` preselects its project type). Large screens only (≥75rem wide and ≥46rem tall): sections are full-screen `.panel`s with
proximity snapping; everything smaller scrolls naturally (Randy: no rigid full-screen behaviour). Panels must fit
one screen at 1366×768. /about/, /faq/, /contact/ 301 to their sections; /demos/ 301 to /work/ (query kept).
Services (2026-10-14; existing-projects renamed "Website improvements" 2026-10-22, URL kept):
build group — websites, redesigns, web-apps, existing-projects, presented as the three categories; support group —
website-management, server-setup (on /services/ only, never the home page's emphasis). /services/: categories ·
#pricing (typical project sizes) · support · "Which service fits?". Keep server/Docker terminology off the home page. Infrastructure claims are limited to
what Randy's own projects run (Linux, Docker Compose, Caddy/nginx, Postgres, Redis, object storage, email
sending, DNS/HTTPS, backups, deployment); no enterprise, security-consulting, high-availability or
large-scale cloud claims. No maintenance plans, hosting packages, uptime or ongoing obligations; prices only as pricing.ts guidance.
Explore what's possible (2026-10-18; 2026-10-22 covers all six services and the product concepts): `/explore/` asks
4 questions (+ up to 3 follow-ups: what they have, what people would do online, who would use it) and shows 2–3
possibilities, each linking to its service page and, where one fits, a working demo on /work/ (`Rec.demo`: site →
auto-repair, contact → landscaping, ordering → ember-rye, booking → cove, product builder → alder-pine, internal tool →
tidewater; never games, private previews or unmaskd.). Every service must be a possible result (tested). Questions, possibilities and rules: `src/content/explore.ts` (pure, tested by `node tests/explore.mjs`);
UI: `src/scripts/explore.ts`. Possibilities link only to existing service pages and /work/ demos; never claim a site was reviewed,
assume a problem with it, or promise traffic/sales. Answers stay in sessionStorage; they are sent only as the
optional, editable `summary` field of the contact form shown under the results (mailer accepts `summary`; the
message is then optional). Linked from the hero, under the home service cards, /services/ ("Which service
fits?"), every service page and the footer; `/explore/?start=<value>` preselects the first answer.
Work (2026-10-22): `/work/` has two customer-facing sections: Business websites (`#websites`: the website concepts) ·
Custom applications and interactive tools (`#apps`: product concepts, unmaskd., Explore), then the "Want something
similar for your business?" form (#similar). Old anchors (#independent, #products, #concepts, #tools) are kept as
aliases. Every card has a "Good for …" line (`demo.solves`) and "Discuss a similar project".
Registry: `src/content/demos.ts` (projects.ts entries + `tools`); cards: `DemoCard.astro` (also on service pages'
Related work and, `compact`, on the home page).
Inquiry flow (2026-10-22): one form (`ContactForm.astro`): name, email, optional project type / budget / "an example
you liked" (choices in `src/content/inquiry.ts`, budgets from pricing.ts), what they need (required), optional current
website. The mailer accepts `type`, `budget`, `demo` (one line each) and puts them in the email. "Discuss a similar
project" (cards, demo banner, demo promo, /work/<slug>/ → `/work/?similar=<slug>#similar`) preselects the example and
a matching project type; nothing sends until Send. unmaskd. is an example choice only on /work/ (`allExamples`).
Every demo page (layouts/Concept.astro) has the concept banner on top (with a "Discuss a similar project" button) and
`DemoPromo.astro` ("Like what you see?") after `<main>`: never fixed, floating or modal. Concept
forms and call buttons are simulated and say so (`scripts/demo-forms.ts`). Never list private previews.
Product concepts (2026-10-22): `demo.group: 'products'` puts a concept in /work/#apps; there are four
flagship concept apps: Ember & Rye (`ember-rye`, pickup-only ordering + reservations by party size, date and time (no floor plan or table picking, Randy 2026-10-24; capacity per seating in `src/concepts/ember-rye/reserve.ts`, demo bookings in sessionStorage without contact details); Randy 2026-10-24: no delivery, promo codes, live tracker or fake live readouts; every figure is labelled sample; totals and pickup times live in `src/concepts/ember-rye/order.ts`), Alder & Pine (`alder-pine`, simulated build-slot request, never a payment or held slot; sample ordering terms; 2026-10-24; drawn in SVG by `src/concepts/alder-pine/render.ts`), Tidewater Mechanical Ops (`tidewater`, a heating/cooling/plumbing back office, not marine; no live labels or financing; a customer service-request view (#request) adds a job to the Unassigned tray, 2026-10-24; field-service
dispatch/estimates/customers/reports; every Reports figure is a sum over one ledger in `src/concepts/tidewater/reports.ts`,
tested by `node tests/tidewater.mjs`) and Cove Wellness (`cove`, booking wizard, body-map intake, My visits, gift cards). Logic and
styles live in `src/concepts/<slug>/` (shared helpers `src/concepts/shared.ts`); pages in `src/pages/concepts/<slug>.astro`. A
project joins the group with `demo.group: 'products'`. They are the home page's three featured concept cards (ember-rye,
alder-pine, tidewater); the older website concepts stay on /work/. All data is generated sample data; orders, bookings, texts,
signatures and payments are simulated and say so; saved carts/designs/visits stay in localStorage. Fictional phone numbers use
555-01xx. No reviews, ratings or testimonials in them.
Frost Heave Creamery (2026-10-25, `frost-heave`): a website concept (in /work/#websites; on the home page only through the rotation and its share link) for a fictional
ice cream shop in fictional Wessick Falls, Maine. Kept simple on purpose (Randy, 2026-10-25: model it on Gifford's and Fielder's Choice,
not an elaborate set-up): four sections only, Flavors · Menu · Our story · Visit. No cart, online shop, cone planner, events, catering,
job forms, social feed or team bios; don't add them back. Everything the owner would change lives in `src/concepts/frost-heave/data.ts`
(flavors with `months` for seasonal ones, menu prices, hours by season + closures); rules in `logic.ts` (tested by
`node tests/frost-heave.mjs`), SVG drawings in `art.ts` (no photos), UI in `app.ts`. A demo owner panel (footer) marks flavors sold out and
posts a notice for today, in localStorage only. Prices are sample prices; no reviews or ratings.
Browser test: `node tests/frost-heave-e2e.mjs` (after `tech preview`).
Share links (Randy, 2026-10-25): `src/content/showcase.ts` is the rotation of every portfolio project (independent +
concepts with demos; no tools/games): unmaskd., then the `featured` concepts, then the rest. `/p/<code>/`
(`pages/p/[code].astro`, same `HomePage.astro` as `/`) features that project with the next three in the rotation as
supporting cards: fixed, built statically, `noindex` (meta + nginx header), not in nav, sitemap or /work/; unknown codes
302 to `/`. The code is opaque, 7 characters, worked out from the slug (`src/lib/share-code.ts`) so it stays the same between
builds: the URL never names the project (Randy, 2026-10-25) or a prospect. Once loaded, the page shows the plain home address (`history.replaceState` to `/`, Randy
2026-10-25: default URL) and makes the project this session's home pick, so a reload or the logo keeps it first. They are public, unlisted addresses: never call them
private or protected. Plain `/` picks one at random per browser session (`scripts/showcase.ts`, sessionStorage); without JS it shows
unmaskd. + ember-rye, alder-pine, tidewater. Concepts featured there use their tagline and stay labelled "Concept
demonstration". The Work panel must still fit 1366×768 for every featured project (`node tests/share-links-e2e.mjs`).
Link manager: a faint `>_` mark (aria-label "Admin sign-in"): on wide screens right after the footer copyright, on phones and
tablets (below 62rem, the menu drawer) at the bottom of the drawer instead, never both (Randy 2026-10-27). Same on Resources
(WordPress copy: `assets/js/admin-key.js`, regenerated from the TypeScript; keep in step). It
opens in place as a muted prompt like the hero's, `> who are you?` (Randy 2026-10-25: a question, nothing personal), with the key typed where the _ cursor was
(`scripts/admin-key.ts`; Escape closes the prompt, not the menu). Easter egg (Randy, 2026-10-25): wrong answers show "wrong.", "wrong!", then
"intruder alert" and open `/watching/`: only a giant alien eye (it stays still; only the pupil follows the pointer), "WE ARE WATCHING YOU." and a
Back button beside the "Classified · eyes only" tab (Randy, 2026-10-25: nothing else: no readouts, file numbers or footer).
Never a real agency, seal, official, .gov or show quote. Not linked anywhere, not in the sitemap, noindex. Without
JS the footer mark links to `/admin/` (public sign-in page). Either way the key goes to POST `/api/admin/login` (gate container; master key only, same hash, cookie and rate limit as the
vault) → `/admin/links/` (the /work/ cards with a Share/copy control). `/admin/links/` is built with the site, then moved
out of the public root by the Dockerfile into `/usr/share/nginx/private/admin/`, and served only after `auth_request`
accepts a master session. Never check a password in the browser. Sign out: POST `/api/admin/logout`.
Resources (2026-10-27, Randy: one Resources, on WordPress, at /resources/, not a subdomain; see `RESOURCE_HUB.md`):
`/resources/` is the WordPress site in `wordpress/`; this site's nginx proxies the path unchanged to `randybuilds-resources:80`
over the external `randybuilds-resources-edge` network (compose.yaml and compose.preview.yaml join it), with its own headers
(not the static CSP). The old static hub is gone; `/resources/guides/<slug>/` 301s to `/resources/<slug>/`, and the old
subdomain 301s to `/resources/<path>` (WordPress's Apache, `wordpress/apache/000-default.conf`). Only `/resources/suggest/`
is this build's (suggest or report via the mailer, `kind=resource|report`; WordPress links to it); `src/content/resources.ts`
only feeds its report dropdown (`node tests/resources.mjs`). Content rules: own-words descriptions, official URL, checked date, "Free" / "Free tier" / "Free trial";
no third-party prices; never an endorsement. No accounts, comments, profiles or community activity exist: never fake them. The way
to hire Randy is the CTA band and one quiet card, not a pitch on every listing.
WordPress (2026-10-27): /resources/ is self-hosted WordPress in `wordpress/` (read
`wordpress/README.md` first). Own Compose project `randybuilds-resources` (WordPress + MariaDB, own volumes, internal DB
network, edge network `randybuilds-resources-edge`); manage only with `wordpress/rbr.sh`, never `tech`. Custom theme
`wordpress/theme/randybuilds-resources/` (no plugins). Its header is the main site's (Randy, 2026-10-27): plain wordmark and the same nav, kept in sync with `src/site.ts` by hand in `header.php`, Resources current; the `^ top` back-to-top key is copied too (`assets/js/to-top.js`). Content was imported once (5 guides, 68 listings); WordPress is now the source and
`rbr.sh import` is retired. Admin `randy` / connect@randybuilds.tech; password only via
`secrets/admin-password` + `rbr.sh set-admin-password` (never WP-CLI `--prompt`: it echoes the value). A self-directed portfolio project: never describe it as client work. Test: `RBR_URL=… node wordpress/tests/e2e.mjs`.
Arcade (2026-10-18): kept separate from Work (Randy: more games coming). `/arcade/` lists every `group: 'games'`
entry (three: PATCH QUEST, AFTER HOURS, CROSS//WIRE); `/arcade/patch-quest/` has its own page shell (no site header/CTA band; no ads or forms inside the game).
Linked from the footer's Site column, never from the home page.
AFTER HOURS: Bad Decisions (2026-10-18): `/arcade/after-hours/`, a mature-humor arcade brawler (crude language,
suggestive but never explicit, cartoon violence; an 18+ advisory shows before play, once per session; its card
carries a "Mature humor" badge). Code in `src/arcade/after-hours/` (reuses `src/game/pixels|physics|particles`);
encounters are data in `encounters.ts` (every option must change something), areas in `zones.ts`. Tests:
`node tests/after-hours.mjs` (rules + bot-played full nights). Images: `node scripts/capture-after-hours.mjs`.
Keep it out of business pages; no ads, forms or sales messages inside any game.
CROSS//WIRE (2026-10-19): `/arcade/cross-wire/`, a retro crossword game (DOM grid, no canvas). Code in
`src/arcade/cross-wire/` (crossword.ts model + validator, solve.ts state/hints/clock/score, puzzles.ts, daily.ts,
storage.ts, audio.ts, main.ts UI). 24 puzzles: 12 minis + a 3-sector campaign (each sector unlocks the next); the
Daily Circuit is the same for everyone per UTC day (day 1 = 2026-10-19) and cycles through `DAILY_ORDER` (append new
ids there; say it rotates, never that it's new every day). Every puzzle must pass `node tests/cross-wire.mjs`
(validator: square 4–9, all squares checked, answers 3+ letters, numbering, clues, no duplicates, connected).
Saves only in localStorage (`cross-wire-v1`); share text never contains answers. Images: `node scripts/capture-cross-wire.mjs`
(uses a demo grid that isn't in the game, so no spoilers). Landscape on touch screens: every game goes full screen
with controls at the bottom (`src/game/immersive.ts`). Engine in `src/game/` (Canvas 2D + WebAudio, no deps; logic modules are DOM-free and tested by
`node tests/patch-quest.mjs`). Images: `node scripts/capture-patch-quest.mjs`; Explore card: `scripts/capture-explore.mjs`.
Other pages: /services/ (all six services in two groups + "Which service fits?"), /services/<slug>/ ×6 (CTAs carry
`?topic=<slug>`), /work/<slug>/, live demos at /concepts/<slug>/, Privacy, Terms.
Every page except Home ends with the "Let’s talk about your project" band, then a 4-column footer.
Differences kept on purpose: no testimonials/stats until real ones exist, no photo; prices only as pricing.ts guidance.
Confirmed promises (2026-10-12) live in `src/site.ts` (`area`, `replyTime`) and `src/content/faq.ts`:
free project review by email (no obligation), aim to reply within three business days (2026-10-13), Maine-based and
neurodivergent-owned (2026-10-13; the footer is the only place that names Maine — Randy: too many location mentions look artificial), New England + remote, fixed price,
client owns the site, hosting and post-launch help quoted separately, help with content.
"Included" in website projects: mobile-friendly design, contact form, basic SEO setup — nothing else
(no domain/launch, analytics, training or phone/video calls promised). Ask before adding claims.

## Design: "terminal blueprint" (Randy, 2026-10-13: "something epic", a merger of terminal, blueprint and circuit)
Dark terminal panels (`--bg`/`--bg-2`) on a blueprint grid that drifts with the scroll, mono labels
(JetBrains Mono, vendored, OFL) with Schibsted Grotesk for text. Accents cobalt + signal orange; each
service keeps a colour (`data-color` → `--c`). `--cobalt`/`--orange`/`--sea`/`--yellow` are fills
with dark `--on-fill` text; text-safe accents are `--cobalt-hi`/`--orange-hi`. No buoys anywhere
(Randy: a capsule reads as a pill; wanted something tech).
- Header floats over the page (inside each panel on large screens) on a near-opaque dark background (Randy 2026-10-27: text never shows through).
- Circuit trace (`.trace`, `src/scripts/trace.ts`) runs down the left margin, lit to mid-screen, with a
  branch + node to each section kicker (`01 services` …); the active panel's node glows orange.
- Hero: typed `dev@randybuilds:~$ ./build --your-idea` prompt, headline with blinking cursor, and a
  blueprint wireframe figure (`HeroFigure.astro`) whose layers move at different depths. Callouts name
  only confirmed inclusions (mobile-friendly, contact form, basic SEO).
- Parallax (`src/scripts/parallax.ts`): off under reduced motion and below 48rem.
- Back to top (2026-10-26, Base layout only, so not concepts or games): a mono `^ top` key bottom right (`.totop`,
  `src/scripts/to-top.ts`), shown a screen down, with a cobalt→orange scroll bar along its base; hidden while the phone
  menu is open; plain `#main` link without JS.
- Wordmark: `>_` mark + "**Randy**builds.tech" (orange dot, mono "tech"). Favicons/og.png: `pnpm assets`.
- unmaskd. card and project page use a looping clip (`Clip.astro`, `public/work/unmaskd/hero.mp4`,
  `scripts/capture-unmaskd-video.mjs`) with a pause button; still image under reduced motion.
Tokens in `src/styles/global.css`. Strict CSP: no inline `style=""` (JS sets styles through CSSOM).

## Structure
- `src/site.ts` — name, email, verified flag, nav.
- `src/content/projects.ts` — every portfolio entry; Work pages are generated from it.
- `src/content/services.ts`, `src/content/faq.ts` — services and FAQ (pages, footer, home).
- `src/pages/concepts/<slug>.astro` — live concept demos (own styles, `layouts/Concept.astro`).
- `scripts/capture-concepts.mjs` — re-shoots concept screenshots into `public/work/<slug>/`.
- `scripts/capture-unmaskd.mjs` / `capture-unmaskd-video.mjs` — unmaskd. stills and the hero loop.
- `scripts/render-assets.mjs` — favicon PNGs and `public/og.png`.
- `previews/` — a SEPARATE Astro build (`astro build --root previews`, base `/preview`) for private client
  previews. Its output goes to `/usr/share/nginx/private/preview`, outside the public root; nginx serves it
  only after `auth_request` to the `gate` container (`gate/server.mjs`, no deps) accepts the session cookie.
  `/preview/` (src/pages/preview/, “the vault”) is the public code form; /clients/ redirects there. Prospects:
  `/preview/<id>/` (`tech preview-code <id> <keyword>`). Clients who said yes: their full project under `/clients/<id>/`
  (`tech preview-code <id> <keyword> --client`, files in /usr/share/nginx/private/clients/<id>/). Randy’s master key
  (`tech preview-code --master <key>`) opens `/preview/vault/`, an index of every project (previews/src/projects.ts). Codes are keywords Randy assigns to each
  project, never random (Randy, 2026-10-20): `tech preview-code <id> <keyword>` (4–64 letters/digits, not the id, unique;
  stores only a SHA-256 in `.env.previews`, chmod 600, never in git), `--revoke`, `--list`. Preview pages
  have their own CSP (no analytics), `X-Robots-Tag: noindex`, `no-store`.

## Workflow
`tech preview` builds the working tree into a SEPARATE Compose project (`randybuilds-tech-preview`,
127.0.0.1:18480, mailer without a key so it never sends). Never use the live compose project for
previews. `tech clients` = client projects only (above). `tech` = commit (shows the changes, asks for a message) → push to GitHub (`RandyIsBack2It/RandyBuildsTech`, private) → release. `pnpm test` (Playwright + axe + CSP +
keyboard + links + form, against the preview; `QA_BASE=https://randybuilds.tech` for live; the form
test intercepts requests and never sends) · `node tests/mailer.mjs` (fake Resend) ·
`node tests/lighthouse.mjs [url]` · `node tests/explore.mjs` (Explore rules) · `node tests/patch-quest.mjs` (game levels, physics, rules) · `node tests/after-hours.mjs` · `node tests/cross-wire.mjs` · `node tests/tidewater.mjs` · `node tests/tidewater-e2e.mjs` (request form, honesty, browser) · `node tests/ember-rye.mjs` (order totals, pickup times) · `node tests/frost-heave.mjs` · `node tests/frost-heave-e2e.mjs` (browser) · `node tests/ember-rye-e2e.mjs` (browser, after `tech preview`) · `node tests/alder-pine.mjs` (quotes, slots, share links) · `node tests/alder-pine-e2e.mjs` (browser) · `pnpm check` · `node tests/gate.mjs` (gate unit tests) ·
`node tests/previews.mjs` (vault and gate end to end on the local preview, fixed QA codes from compose.preview.yaml) ·
`pnpm cards` (WebP srcset copies of every `public/work/*/card.jpg`, named after the JPEG's hash; run after re-shooting a card,
otherwise cards fall back to the JPEG) · `node tests/resources.mjs` (resource data for the suggest form) · `node tests/share-links-e2e.mjs` (share links, random home pick, link manager sign-in and copy; after `tech preview`).

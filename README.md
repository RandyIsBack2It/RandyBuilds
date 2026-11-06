# Randy Builds Tech

The website for **randybuilds.tech**: who Randy is, what he builds, his work, and how to get in touch.

Static site (Astro) in its own nginx container, plus a small mailer container for the contact form.
No database, nothing to log in to.

## Everyday use

Type `tech` in a terminal.

It checks everything is committed, builds a new version, swaps it in, and checks the live site.
If the new version isn't healthy, the old one stays.

Other commands:

| Command | What it does |
|---|---|
| `tech status` | What's running |
| `tech logs` | Recent server logs (`tech logs -f` to follow) |
| `tech rollback` | Go back to the previous release |
| `tech preview` | Try uncommitted changes privately at http://127.0.0.1:18480/ (never touches the live site; its form never sends) |

## Changing the site

| To change… | Edit |
|---|---|
| Email address, service area, reply time | `src/site.ts` |
| Services (/services/, detail pages, footer, home cards) | `src/content/services.ts` |
| FAQ answers | `src/content/faq.ts` |
| Portfolio entries | `src/content/projects.ts` |
| Home page | `src/pages/index.astro` |
| About, Contact, Privacy, Terms | `src/pages/*.astro` |
| Where form messages go | `.env`: `RBT_MAIL_TO` (default connect@randybuilds.tech) |
| Colours, type, spacing | `src/styles/global.css` |
| A concept demo site | `src/pages/concepts/<name>.astro` |

Then commit and run `tech`.

### Adding a concept site
1. Build it as `src/pages/concepts/<slug>.astro` using `layouts/Concept.astro` (copy an existing one).
2. Add an entry to `src/content/projects.ts` with `kind: 'concept'`, `demoUrl`, and `shots`.
3. Add the slug to `scripts/capture-concepts.mjs` and `tests/run.mjs`, run `tech preview`, then
   `node scripts/capture-concepts.mjs`.
4. `pnpm test`, commit, `tech`.

Concepts are always fictional businesses, clearly labelled, with sample prices and forms that send nothing.

## Testing

```
tech preview                 # start the preview container
pnpm test                    # 5 screen sizes, axe accessibility, CSP, keyboard/menu, links, fonts, contact form
node tests/mailer.mjs        # contact form API against a fake mail service
node tests/lighthouse.mjs    # performance / accessibility / best practices / SEO
pnpm check                   # type check
```

Screenshots and reports land in `tests/out/`.

## Going live

Live since 2026-10-12. How it was launched, and the plan to retire /designs: `deploy/LAUNCH.md`.

Contact form messages arrive from "Randy Builds Tech" with Reply-To set to the visitor, so just hit reply.

## Fonts

Bricolage Grotesque, Atkinson Hyperlegible Next, Hanken Grotesk and Fraunces, all under the SIL
Open Font License (licence files in `src/fonts/`).

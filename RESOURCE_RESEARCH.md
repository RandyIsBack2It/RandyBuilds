# Resource research record

The record behind the resource directory (`/resources/directory/`, data in
`src/content/resources.ts`). Every published listing is below with its official
URL, category, free-access status, account requirement and the date it was checked.
`node tests/resources.mjs` fails if a listing's URL is missing from this file.

## How each listing was checked (2026-10-25)

1. The official page was opened, first with a plain HTTP request and then in a real
   browser (headless Chrome) where sites block plain requests. Search snippets were
   only used to find a page's current address, never as the source for a description.
2. The link was confirmed to be on the publisher's own domain. Redirects were followed,
   and the listing uses the final address.
3. What "free" means was read from the page itself: **Free** (no cost to use),
   **Free tier** (a free plan with limits, paid plans alongside) or **Free trial**
   (time-limited; none are listed at the moment).
4. Descriptions were written from scratch in plain language. No publisher text, images
   or files were copied. Third-party prices are deliberately not stated, because they
   change and the site's only prices are `src/content/pricing.ts`.
5. Where a detail couldn't be confirmed on the page, it was left out. Account
   requirements show "Not checked" rather than a guess.

No logins, paywalls, CAPTCHAs or bot checks were bypassed. Pages behind a bot check
were either confirmed another way (a plain request or a different fetch returned the
real page) or left out.

## Counts by category

| Category | Listings |
|---|---|
| Starting and planning | 10 |
| Website planning and content | 13 |
| Website platforms and web tools | 7 |
| Accessibility | 8 |
| Search visibility and analytics | 6 |
| Marketing and customer communication | 5 |
| Booking, forms and operations | 7 |
| Cybersecurity and privacy | 6 |
| Finance and recordkeeping | 6 |
| Learning for founders and builders | 7 |
| **Total** | **75** |

## Published listings

### Starting and planning

| Listing | Publisher | Free status | Account | Checked | URL |
|---|---|---|---|---|---|
| Plan your business | U.S. Small Business Administration | Free | No account needed | 2026-10-25 | https://www.sba.gov/counseling/plan-your-business/ |
| Launch your business | U.S. Small Business Administration | Free | No account needed | 2026-10-25 | https://www.sba.gov/counseling/launch-your-business/ |
| Break-even point calculator | U.S. Small Business Administration | Free | No account needed | 2026-10-25 | https://www.sba.gov/counseling/plan-your-business/break-even-point-calculator/ |
| Local assistance finder | U.S. Small Business Administration | Free: Counseling is free or low-cost; some training has a fee. | No account needed | 2026-10-25 | https://www.sba.gov/counseling/local-assistance/ |
| SCORE mentoring | SCORE | Free: You fill in a request form to be matched. | Not checked | 2026-10-25 | https://www.score.org/how-mentoring-works/ |
| Business templates | SCORE | Free | Not checked | 2026-10-25 | https://www.score.org/templates/ |
| Find your SBDC | America’s SBDC | Free: Consulting is no-cost; training is low-cost. | No account needed | 2026-10-25 | https://americassbdc.org/find-your-sbdc/ |
| Get an employer identification number (EIN) | Internal Revenue Service | Free: Must be finished in one session. | No account needed | 2026-10-25 | https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number |
| Trademark basics | U.S. Patent and Trademark Office | Free: Reading is free; filing an application has government fees. | No account needed | 2026-10-25 | https://www.uspto.gov/trademarks/basics |
| Do you need a business coach or a consultant? | Jacob Top Møller | Free | No account needed | 2026-10-30 | https://topmoller.com/articles/business-coach-or-consultant/ |

### Website planning and content

| Listing | Publisher | Free status | Account | Checked | URL |
|---|---|---|---|---|---|
| Plain language guides | Digital.gov | Free | No account needed | 2026-10-25 | https://digital.gov/guides/plain-language/ |
| Writing to GOV.UK standards | GOV.UK | Free | No account needed | 2026-10-25 | https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/ |
| Articles and videos | Nielsen Norman Group | Free | No account needed | 2026-10-25 | https://www.nngroup.com/articles/ |
| Content Style Guide | Mailchimp | Free | No account needed | 2026-10-25 | https://styleguide.mailchimp.com/ |
| Google Fonts | Google | Free | No account needed | 2026-10-25 | https://fonts.google.com/ |
| Unsplash | Unsplash | Free: Unsplash+ images are a separate paid collection. | Not checked | 2026-10-25 | https://unsplash.com/license |
| Squoosh | Google Chrome Labs | Free | No account needed | 2026-10-25 | https://squoosh.app/ |
| Canva Free | Canva | Free tier: Premium templates, brand kits and more AI features are paid. | Account required | 2026-10-25 | https://www.canva.com/pricing/ |
| GIMP | The GIMP Team | Free | No account needed | 2026-10-25 | https://www.gimp.org/ |
| Inkscape | Inkscape Project | Free | No account needed | 2026-10-25 | https://inkscape.org/ |
| Figma Starter | Figma | Free tier: Professional and team plans are paid. | Account required | 2026-10-25 | https://www.figma.com/pricing/ |
| Neatbo | Neatbo | Free tier: The tools are free; a paid Pro plan adds saved CSV workflows. | Account optional | 2026-10-30 | https://neatbo.com/ |
| Telugu font comparison | English in Telugu Typing | Free | No account needed | 2026-11-01 | https://englishintelugutyping.com/telugu-fonts/ |

### Website platforms and web tools

| Listing | Publisher | Free status | Account | Checked | URL |
|---|---|---|---|---|---|
| WordPress | WordPress.org | Free: The software is free; hosting and a domain are not. | No account needed | 2026-10-25 | https://wordpress.org/download/ |
| Let’s Encrypt | Internet Security Research Group | Free | Not checked | 2026-10-25 | https://letsencrypt.org/ |
| Cloudflare Free plan | Cloudflare | Free tier: Paid plans and add-ons exist. | Account required | 2026-10-25 | https://www.cloudflare.com/plans/free/ |
| PageSpeed Insights | Google | Free | No account needed | 2026-10-25 | https://pagespeed.web.dev/ |
| SSL Server Test | Qualys SSL Labs | Free | No account needed | 2026-10-25 | https://www.ssllabs.com/ssltest/ |
| Security Headers | Snyk | Free | No account needed | 2026-10-25 | https://securityheaders.com/ |
| HeyUtils | HeyUtils | Free | No account needed | 2026-11-01 | https://heyutils.com/ |

### Accessibility

| Listing | Publisher | Free status | Account | Checked | URL |
|---|---|---|---|---|---|
| Easy Checks: a first review of web accessibility | W3C Web Accessibility Initiative | Free | No account needed | 2026-10-25 | https://www.w3.org/WAI/test-evaluate/easy-checks/ |
| How to Meet WCAG (Quick Reference) | W3C Web Accessibility Initiative | Free | No account needed | 2026-10-25 | https://www.w3.org/WAI/WCAG22/quickref/ |
| WAVE | WebAIM | Free: The online tool and extensions are free; the API is paid. | No account needed | 2026-10-25 | https://wave.webaim.org/ |
| Contrast Checker | WebAIM | Free | No account needed | 2026-10-25 | https://webaim.org/resources/contrastchecker/ |
| Guidance on web accessibility and the ADA | U.S. Department of Justice | Free | No account needed | 2026-10-25 | https://www.ada.gov/resources/web-guidance/ |
| Accessibility checklist | The A11Y Project | Free | No account needed | 2026-10-25 | https://www.a11yproject.com/checklist/ |
| NVDA screen reader | NV Access | Free: Windows only. | No account needed | 2026-10-25 | https://www.nvaccess.org/download/ |
| ColorPairLab | ColorPairLab | Free | No account needed | 2026-10-30 | https://colorpairlab.online/ |

### Search visibility and analytics

| Listing | Publisher | Free status | Account | Checked | URL |
|---|---|---|---|---|---|
| Google Search Console | Google | Free | Account required | 2026-10-25 | https://search.google.com/search-console/about |
| SEO Starter Guide | Google Search Central | Free | No account needed | 2026-10-25 | https://developers.google.com/search/docs/fundamentals/seo-starter-guide |
| Bing Webmaster Tools | Microsoft | Free | Account required | 2026-10-25 | https://www.bing.com/webmasters/about |
| Google Business Profile | Google | Free | Account required | 2026-10-25 | https://business.google.com/us/business-profile/ |
| Bing Places for Business | Microsoft | Free | Account required | 2026-10-25 | https://www.bing.com/forbusiness/ |
| Google Analytics | Google | Free: A paid enterprise version exists. | Account required | 2026-10-25 | https://marketingplatform.google.com/about/analytics/ |

### Marketing and customer communication

| Listing | Publisher | Free status | Account | Checked | URL |
|---|---|---|---|---|---|
| CAN-SPAM Act: a compliance guide for business | Federal Trade Commission | Free | No account needed | 2026-10-25 | https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business |
| Endorsement Guides: what people are asking | Federal Trade Commission | Free | No account needed | 2026-10-25 | https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking |
| Manage your business | U.S. Small Business Administration | Free | No account needed | 2026-10-25 | https://www.sba.gov/counseling/manage-your-business/ |
| MailerLite Free | MailerLite | Free tier: The free plan caps subscribers and monthly emails; paid plans remove the caps. | Account required | 2026-10-25 | https://www.mailerlite.com/pricing |
| HubSpot Academy | HubSpot | Free: Expect product promotion alongside the lessons. | Not checked | 2026-10-25 | https://academy.hubspot.com/courses |

### Booking, forms and operations

| Listing | Publisher | Free status | Account | Checked | URL |
|---|---|---|---|---|---|
| Calendly Free | Calendly | Free tier: More event types, team scheduling and integrations are paid. | Account required | 2026-10-25 | https://calendly.com/pricing |
| Cal.com Free | Cal.com | Free tier: Team features and removing its branding are paid. | Account required | 2026-10-25 | https://cal.com/pricing |
| Square Appointments Free | Square | Free tier: Card processing fees apply; larger plans are paid. | Account required | 2026-10-25 | https://squareup.com/us/en/appointments/pricing |
| Trello Free | Atlassian | Free tier: Collaborators and boards per workspace are capped on the free plan. | Account required | 2026-10-25 | https://trello.com/pricing |
| LibreOffice | The Document Foundation | Free | No account needed | 2026-10-25 | https://www.libreoffice.org/ |
| Print Calendar Lab | Print Calendar Lab | Free: The site shows ads. A separate iOS app has paid options. | No account needed | 2026-11-01 | https://printcalendarlab.com/ |
| Client paperwork checklist | Stack PDF | Free | No account needed | 2026-11-01 | https://stackpdf.com/#client-paperwork-checklist |

### Cybersecurity and privacy

| Listing | Publisher | Free status | Account | Checked | URL |
|---|---|---|---|---|---|
| Cybersecurity for small business | Federal Trade Commission | Free | No account needed | 2026-10-25 | https://www.ftc.gov/business-guidance/small-businesses/cybersecurity |
| Protecting personal information | Federal Trade Commission | Free | No account needed | 2026-10-25 | https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business |
| Data breach response | Federal Trade Commission | Free | No account needed | 2026-10-25 | https://www.ftc.gov/business-guidance/resources/data-breach-response-guide-business |
| Cyber Essentials | Cybersecurity and Infrastructure Security Agency | Free | No account needed | 2026-10-25 | https://www.cisa.gov/resources-tools/resources/cyber-essentials |
| Small Business Cybersecurity Corner | National Institute of Standards and Technology | Free | No account needed | 2026-10-25 | https://www.nist.gov/itl/smallbusinesscyber |
| Bitwarden Free | Bitwarden | Free tier: Team and business plans are paid. | Account required | 2026-10-25 | https://bitwarden.com/pricing/ |

### Finance and recordkeeping

| Listing | Publisher | Free status | Account | Checked | URL |
|---|---|---|---|---|---|
| Small business and self-employed tax center | Internal Revenue Service | Free | No account needed | 2026-10-25 | https://www.irs.gov/businesses/small-businesses-self-employed |
| Recordkeeping | Internal Revenue Service | Free | No account needed | 2026-10-25 | https://www.irs.gov/businesses/small-businesses-self-employed/recordkeeping |
| Publication 583: Starting a business and keeping records | Internal Revenue Service | Free | No account needed | 2026-10-25 | https://www.irs.gov/publications/p583 |
| Wave Starter | Wave Financial | Free tier: Payment processing, payroll and the Pro plan are paid. | Account required | 2026-10-25 | https://www.waveapps.com/pricing |
| GnuCash | GnuCash Project | Free | No account needed | 2026-10-25 | https://www.gnucash.org/ |
| Wages and the Fair Labor Standards Act | U.S. Department of Labor | Free | No account needed | 2026-10-25 | https://www.dol.gov/agencies/whd/flsa |

### Learning for founders and builders

| Listing | Publisher | Free status | Account | Checked | URL |
|---|---|---|---|---|---|
| Entrepreneurship (textbook) | OpenStax, Rice University | Free: Print copies are sold separately. | No account needed | 2026-10-25 | https://openstax.org/details/books/entrepreneurship |
| LearnFree (GCFGlobal) | Goodwill Community Foundation | Free | Not checked | 2026-10-25 | https://www.learnfree.org/ |
| Learn web development | MDN Web Docs (Mozilla) | Free | No account needed | 2026-10-25 | https://developer.mozilla.org/en-US/docs/Learn_web_development |
| Learn courses on web.dev | Google Chrome team | Free | No account needed | 2026-10-25 | https://web.dev/learn |
| freeCodeCamp | freeCodeCamp.org | Free | Not checked | 2026-10-25 | https://www.freecodecamp.org/ |
| The Odin Project | The Odin Project | Free | Not checked | 2026-10-25 | https://www.theodinproject.com/ |
| CS50x: Introduction to Computer Science | Harvard University | Free: Paid certificates and credit are offered separately. | No account needed | 2026-10-25 | https://cs50.harvard.edu/x/ |

## Added from submissions (2026-10-30)

Three suggestions sent through `/resources/suggest/` were reviewed by hand and approved by Randy.
Only these three were added; other submissions were not reviewed here or imported.

- **Do you need a business coach or a consultant?** (Jacob Top Møller): the article was opened and read.
  The author sells coaching and consulting; the description says so.
- **ColorPairLab:** the contrast checker was run (black on white showed 21:1, Pass; #999999 on white
  2.85:1, Fail). The converter, palette builder and palette matrix pages load. Its About page says
  everything runs in the browser and no account is needed.
- **Neatbo:** tools were run in headless Chrome with made-up sample files only: QR code maker (PNG out),
  resize images (800×600 PNG → 400×300), compress images (PNG → smaller JPEG), merge PDF (two one-page
  PDFs → one two-page PDF) and the JSON formatter. No file uploads (POST/PUT requests) were seen during
  those runs. That is an observation, not a security review. A paid Pro plan (saved CSV workflows) and
  an optional Google sign-in exist, so it is listed as Free tier, account optional.

## Added from submissions (2026-11-01)

Randy approved six submissions. Business coach or consultant, ColorPairLab and Neatbo were already
published (2026-10-30), so only three were added. Other submissions were not reviewed here or imported.

- **Neatbo (re-checked):** in headless Chrome with made-up files, the QR code maker gave a PNG, resize
  turned an 800×600 PNG into 400×300, and merge PDF turned two one-page PDFs into one two-page PDF. No
  POST or PUT requests were seen. Its listing was left unchanged.
- **Telugu font comparison** (English in Telugu Typing): sample Telugu text showed in all six fonts
  (Mandali, Ramabhadra, Suranna, NTR, Mallanna, Timmana). The size slider changed the preview (40 → 64 px).
  Each card links to its Google Fonts specimen and says OFL 1.1. Its About page says the editor is free
  and needs no registration. Its privacy page says it runs no ads and keeps text in the browser.
- **HeyUtils:** in the JSON formatter, sample JSON was formatted and minified. Broken JSON gave "Invalid JSON …
  Line 1, column 12". The privacy page says there are no user accounts. Most tools run in the browser;
  network tools contact the providers they name. The only POST seen was Cloudflare's page analytics.
- **Print Calendar Lab:** Download PDF produced three files. November with US holidays (Thanksgiving
  shown), Letter: a one-page landscape PDF. A yearly calendar, A4, Monday start, German holidays: a
  one-page A4 landscape PDF. All months, one per page: a 12-page PDF. The home page says no signup is
  required. The site loads Google AdSense and Analytics. Its privacy page describes a separate iOS app
  with paid Pro options. Both are noted on the listing.

## Added (2026-11-01, second batch)

Randy approved one resource: Stack PDF's client paperwork checklist. It was not listed before (no post,
draft or URL matched "stackpdf"). Only the checklist is listed, not Stack PDF's app.

- **Client paperwork checklist** (Stack PDF, post 93, Booking, forms and operations): the section
  `#client-paperwork-checklist` is on the public home page. "Download the checklist" gives a one-page,
  49 KB PDF (`/downloads/client-paperwork-checklist.pdf`, "Client paperwork ready to send") with no signup.
  It covers requirements and completeness, page order, readability, signatures and dates, sensitive
  information, file size, filename and a final send check. The PDF and page both say Stack PDF's app is in
  development (target launch 1 December 2026; Premium planned for export and sharing). The listing's Note says
  the page promotes an unfinished app. The site's analytics are opt-in (its privacy page, updated 2026-10-26).

## Listing notes (2026-11-01)

A listing's facts can carry a **Note**: a scope or limit to know before relying on it. Notes are added
only where the fact is plain from the resource itself (a U.S. agency, a U.S. law, a country-specific
page), never as a recommendation. Notes added: SBA (plan, launch, local assistance, manage), America's
SBDC, IRS (EIN, tax center, recordkeeping, Publication 583), USPTO, FTC (CAN-SPAM, endorsements, data
breach), ADA guidance, GOV.UK writing standards, Square Appointments, and the Stack PDF checklist.

Two descriptions were reworded to drop claims that weren't checked: web.dev ("each written by an industry
expert") and The Odin Project ("the best tutorials").

## Details still to review by hand

- **"Free advice" on Let's Encrypt and Cloudflare Free plan:** the import mapped the `service` type to the
  "Free advice" tag, so these two cards say "Free advice". They are services, not advice. Fix by adding a
  "Service" type tag (group `type`) and moving them to it.
- **MailerLite's description** ("Email newsletter software with a free plan for small lists") is thin
  next to the others. Re-check its free plan and rewrite it.
- **Link check (2026-11-01):** 73 of 75 listing URLs were confirmed loading (plain request or headless
  Chrome). Plain requests get a 403 or 404 from ftc.gov, dol.gov, score.org, canva.com, inkscape.org and
  unsplash.com, but those pages load in a browser. The two W3C pages (Easy Checks, WCAG Quick Reference)
  showed a bot check to both; open them by hand.

- **Account requirements marked "Not checked":** SCORE mentoring and templates, Unsplash,
  Let's Encrypt (your host or server software usually handles it), HubSpot Academy,
  LearnFree, freeCodeCamp and The Odin Project. The pages didn't say clearly.
- **SCORE templates:** the template pages load, but the download step may ask for
  details. It wasn't tested, to avoid submitting forms. Confirm whether an email is required.
- **W3C pages (Easy Checks, WCAG Quick Reference):** a headless browser met a
  Cloudflare check. A plain request and a separate fetch both returned the real pages.
  Re-open them in a normal browser once.
- **Google Analytics:** listed as Free. A paid enterprise version (Analytics 360) exists.
- **Square Appointments, Wave:** the free plans are real, but card payments carry
  processing fees. The listings say so without stating rates.
- **Cloudflare:** the free plan page promises an ongoing free plan but states no fixed terms.
- **Re-check every listing about every six months**, or when someone reports a problem.
  Update `checked` only after opening the page again.

## Candidates left out (and why)

| Candidate | Reason |
|---|---|
| Census Business Builder (cbb.census.gov) | Returned 403 to every check; couldn't confirm it works. |
| FCC Small Biz Cyber Planner | Page still loads, but the tool dates from 2012. The FTC, CISA and NIST guidance is current. |
| Have I Been Pwned | The pages checked didn't state which searches are free. |
| Google Forms | The product page didn't confirm free use or the account requirement. |
| Apple Business Connect | Now part of "Apple Business"; the page didn't make free access clear. |
| Grow with Google | The landing page is mostly certificate promotions with paid parts. |
| GitHub Pages | Usage limits and allowed uses weren't clear from the pages checked. |
| ICANN registrant pages | The listed page redirects to an archive. |
| Hemingway Editor | Only the paid version's trial was clearly described. |
| FTC "Start with Security" | Not linked from the FTC's current small-business hub; its cybersecurity pages cover the same ground. |
| SBA startup cost worksheet | Covered by the "Plan your business" listing; kept off to avoid a duplicate. |
| State-specific resources (for example a state SBDC) | Kept national, so the directory suits visitors anywhere in the U.S. |

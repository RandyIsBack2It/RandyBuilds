# RandyBuilds.tech Resources (WordPress)

https://randybuilds.tech/resources/: a self-hosted WordPress site holding the Resources section of
randybuilds.tech (5 guides, 75 listings). Self-directed portfolio project, not client work.

Separate from everything else on this host: its own Compose project (`randybuilds-resources`), its own
database container, volumes and networks. The only shared pieces are the edge Caddy proxy and the
existing Cloudflare Tunnel, plus the main site's nginx, which serves `/resources/` from it (2026-10-27).

```
Browser ─▶ Cloudflare (TLS) ─▶ Tunnel ─▶ Caddy :80 ─▶ randybuilds-tech nginx (/resources/…, path unchanged)
                                                         └─▶ randybuilds-resources:80 (WordPress, Apache + PHP 8.4)
                                                         └─▶ randybuilds-resources-db (MariaDB 11.8 LTS, internal network only)
```

## Files

| Path | What it is |
|---|---|
| `compose.yaml` | WordPress, MariaDB and a WP-CLI tool service. Pinned images, dropped capabilities, health checks, memory limits. |
| `compose.local.yaml` | Local test mode: adds `127.0.0.1:18490` (used with `rbr.sh local`). |
| `rbr.sh` | Every operation below. Touches only this project. |
| `php/rbr.ini` | PHP limits (16 MB uploads), errors logged, not shown. |
| `theme/randybuilds-resources/` | The theme (bind-mounted read-only into the container). |
| `migrate/` | `setup.php` (settings, used by `setup`). `export.mjs` + `import.php` did the one-time import (retired). |
| `caddy/resources.randybuilds.tech.caddy` | The block added to the shared Caddyfile (2026-10-27). |
| `tests/e2e.mjs` | Browser check: pages at desktop and phone width, axe, menu, search, filters, migrated content. |
| `secrets/` | **Not in git** (chmod 700, files 600): `db.env`, `wp.env`, and briefly `admin-password`. |
| `backups/` | **Not in git** (chmod 700): nightly database dumps and wp-content archives. |

Images: `wordpress:7.1.3-php8.4-apache`, `wordpress:cli-2.12.0-php8.4`, `mariadb:11.8`.

## Plugins

None. Everything needed is in WordPress core or the theme:

- Search (also matches a listing's keywords, publisher and "Good for"), directory filters, sitemap
  (`/wp-sitemap.xml`, core), meta description and Open Graph tags: `functions.php`.
- Security defaults: no XML-RPC (also blocked in Caddy), no comments or pingbacks, no author archives or
  public user list, no file editor in the admin (`DISALLOW_FILE_EDIT`), install screens blocked in Caddy.
- Akismet and Hello Dolly, which ship with WordPress, were deleted.

Before adding one, ask: does core or a few lines in the theme do it? If a plugin is needed, pick one that
is actively maintained on wordpress.org, record here why it's there, and update it with the others.

## Content

- **Guides** are posts in the Guides category. **Listings** are every other post; their topic is the
  category. Tags group by type ("Online tool"), cost ("Free", "Free tier"), audience ("Starting a
  business") and "Good first stop" (shown on the home page).
- Listing cards read custom fields (`rbr_publisher`, `rbr_url`, `rbr_good_for`, `rbr_price` =
  `free|free-tier|free-trial`, `rbr_price_note`, `rbr_type`, `rbr_keywords`). Editor → ⋮ → Preferences →
  Panels → "Custom fields" shows them. A guide's `rbr_related` is a comma-separated list of listing slugs
  shown under it; `rbr_summary` is its card text; `rbr_featured` = 1 puts it first on the home page.
- New posts appear first (lists are newest first). Drafts and pending posts never show.
- WordPress is the source. The one-time import from the main site is done and `rbr.sh import` is
  retired (the pages it read were removed). Restore from backups, never re-import.
- Rules from the main site still apply: own-words descriptions, official URLs, a checked date, no
  third-party prices, never an endorsement, no invented content. Unfinished posts stay drafts.
- Nothing is published automatically: no comments, no registrations, no scheduled or generated posts.

## Running it

```
wordpress/rbr.sh init            # once: secrets + network
wordpress/rbr.sh up              # production mode (what runs now)
wordpress/rbr.sh local           # test mode on http://127.0.0.1:18490/ (same data; links use that address)
wordpress/rbr.sh setup           # once: install, settings
wordpress/rbr.sh status | logs | stop
wordpress/rbr.sh wp <command>    # WP-CLI, e.g. rbr.sh wp post list --post_status=draft
```

Always go through `rbr.sh`: a raw `docker compose run` without `RBR_HOME` set recreates the WordPress
container with the production address.

The proxy joins `randybuilds-resources-edge` at runtime (`rbr.sh attach-edge`). A recreate of the proxy
container drops runtime-attached networks; reconnect afterwards, as for `randybuilds-edge`.

## Administrator password

The admin user is `randy` (`connect@randybuilds.tech`). It was installed with a random password nobody
has seen. To set yours, in **your own terminal** (not pasted into a chat), from `/mnt/nvme/randybuilds-tech`:

```
install -m 600 /dev/null wordpress/secrets/admin-password
read -rsp 'New WordPress password: ' p && printf '%s' "$p" > wordpress/secrets/admin-password; unset p; echo
wordpress/rbr.sh set-admin-password
```

`read -s` doesn't echo, and the password is never on a command line, so it isn't in shell history.
`set-admin-password` feeds it to WordPress on stdin, prints nothing, then shreds the file. Sign in at
https://randybuilds.tech/resources/wp-admin/. The same steps reset it if it's ever lost. Outgoing mail is
not configured, so "Lost your password?" emails won't arrive.

## Backups

`rbr.sh backup` writes `backups/db-<time>.sql.gz` (a consistent `mariadb-dump`) and
`backups/wp-content-<time>.tar.gz` (uploads, plugins, installed themes), checks both, and keeps the newest
14 of each. The theme is in git.

- Nightly: `wordpress/rbr.sh cron-install` adds `17 3 * * * …/rbr.sh backup` to your crontab. **Not
  installed yet** (the setup session wasn't allowed to change the crontab); run it once.
- Off this machine: copy `backups/` somewhere else now and then (it's on the same disk as the site).
- `rbr.sh update` and `rbr.sh restore` back up first on their own.

**Restore:** `wordpress/rbr.sh restore backups/db-….sql.gz [backups/wp-content-….tar.gz]`. It asks first,
takes a fresh backup, replaces the database (and wp-content if given), then starts again. Checked on
2026-10-27: a dump restored into an empty MariaDB container has all 73 posts.

## Updates

1. Check for news: https://wordpress.org/news/ (core), Docker Hub `wordpress` and `mariadb` tags.
2. **WordPress core and PHP:** change the `wordpress:` and `cli` tags in `compose.yaml` (e.g.
   `7.1.4-php8.4-apache`), then `wordpress/rbr.sh update`. It backs up, pulls, recreates WordPress with
   the new core files (`--renew-anon-volumes`), and upgrades the database. Minor core security releases
   also install themselves between image updates (`WP_AUTO_UPDATE_CORE = minor`).
3. **MariaDB:** stay on 11.8 (LTS) and let `rbr.sh update` pull its patch releases. A jump to a new
   major is a separate job: back up first; `MARIADB_AUTO_UPGRADE=1` upgrades the data files on start.
4. **Theme:** edit `theme/randybuilds-resources/`, check with `rbr.sh local` and
   `RBR_URL=http://127.0.0.1:18490/resources node wordpress/tests/e2e.mjs`, commit, then `rbr.sh up`. The theme
   is mounted read-only, so changes show at once.
5. **Plugins (if any are added):** `rbr.sh wp plugin update --all` after a backup.
6. After any update: `RBR_URL=https://randybuilds.tech/resources node wordpress/tests/e2e.mjs`.

## Address and proxy

- WordPress's address is `https://randybuilds.tech/resources` (`RBR_HOME`; local test mode uses
  `http://127.0.0.1:18490/resources`). HTTPS is Cloudflare's; the proxy in front tells WordPress the request
  was HTTPS (`X-Forwarded-Proto`).
- The main site's `nginx.conf` passes `/resources/…` to `randybuilds-resources:80` unchanged, over the
  `randybuilds-resources-edge` network (its `compose.yaml` joins it), with its own headers (not the static
  site's CSP) and the same blocked paths as the Caddy block. `/resources/suggest/` stays the main site's.
- `apache/000-default.conf` (mounted over the image's default site) aliases `/resources` to the WordPress
  files and 301s any request for the old subdomain to `https://randybuilds.tech/resources/<path>`.
- The old subdomain: its DNS record, tunnel hostname and Caddy block
  (`caddy/resources.randybuilds.tech.caddy`, in `/mnt/nvme/unmaskd.app/infrastructure/compose/Caddyfile`
  since 2026-10-27, backup `Caddyfile.backup-before-resources-20261027-210532`) still route here, so old links
  keep redirecting. Removing them is a shared-infrastructure change and needs Randy's approval. **Undo the
  Caddy block:** delete it, then
  `docker exec compose-reverse-proxy-1 caddy validate --config /etc/caddy/Caddyfile && docker exec compose-reverse-proxy-1 caddy reload --config /etc/caddy/Caddyfile`.

## Verify

```
curl -sI https://randybuilds.tech/resources/ | head -1                      # HTTP/2 200
curl -s -o /dev/null -w '%{http_code}\n' https://randybuilds.tech/resources/xmlrpc.php   # 404
curl -s -o /dev/null -w '%{redirect_url}\n' https://resources.randybuilds.tech/directory/  # …/resources/directory/
wordpress/rbr.sh status
RBR_URL=https://randybuilds.tech/resources node wordpress/tests/e2e.mjs     # all checks pass
```

## The main site's /resources/ (2026-10-27)

This site is the only home of Resources, served at the main site's `/resources/`. The old static hub was
removed; its guide URLs (`/resources/guides/<slug>/`) 301 to `/resources/<slug>/` (main `nginx.conf`).
`/resources/suggest/` stays a main-site page: it uses the mailer, and this site links to it.

## Describing it publicly

Suggested wording, if it goes on the portfolio: "A self-hosted WordPress resource section for
RandyBuilds.tech, with a custom lightweight theme. A self-directed portfolio project." Don't present it
as client work.

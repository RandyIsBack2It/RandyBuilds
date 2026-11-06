# Launch randybuilds.tech, then retire /designs

Sections A–C are done: randybuilds.tech went live 2026-10-12 (existing tunnel, published application routes). Section D has not been run. Each step that touches shared infrastructure needs Randy's go-ahead.
Steps are in order; each one can be undone on its own.

## A. Before launch (Randy)

1. ~~**Mailbox.**~~ Done 2026-10-12: `reach@randybuilds.tech` forwards to Randy's inbox (site address changed to `connect@` the same day)
   (Cloudflare Email Routing); test message received.
2. ~~**Cloudflare.**~~ Done: the domain is on Cloudflare (Email Routing requires it).
3. **Look over the preview** at http://127.0.0.1:18480/ (from this machine).

## B. ~~Flip the site to "launch" mode~~ Done 2026-10-12

`emailVerified: true` in `src/site.ts`: no preview notices, indexing allowed, robots.txt + sitemap
published. (It is still only reachable on localhost until C is done.)

## C. Go live (needs approval: shared proxy and tunnel)

1. **Run the site container:** `tech release` (refuses if the tree is dirty or the mailbox flag is false).
   This replaces the localhost preview with the production container (no host port).
2. **Connect the proxy to the site's network:** `tech attach-edge`
   (runtime `docker network connect`; no restart; the platform compose files are unchanged).
3. **Caddy route.** Back up, then add the two blocks from `deploy/randybuilds.tech.caddy`
   just above the final catch-all `http:// { … }` block:
   ```
   F=/mnt/nvme/unmaskd.app/infrastructure/compose/Caddyfile
   cp -p "$F" "$F.backup-before-randybuilds-$(date +%Y%m%d)"
   ```
   Edit **in place** (same inode). The file is a single-file bind mount, so `sed -i` or editor
   "save as new file" leaves the container seeing the old file. Then:
   ```
   docker exec compose-reverse-proxy-1 caddy validate --config /etc/caddy/Caddyfile
   docker exec compose-reverse-proxy-1 grep -c randybuilds /etc/caddy/Caddyfile   # expect > 0
   docker exec compose-reverse-proxy-1 caddy reload --config /etc/caddy/Caddyfile
   ```
4. **Cloudflare Tunnel.** In the tunnel's Public Hostnames add `randybuilds.tech` and
   `www.randybuilds.tech` → `http://localhost:80` (same service as the existing hostnames).
   In SSL/TLS, set "Always Use HTTPS" on.
5. **Check:** `curl -I https://randybuilds.tech/` returns 200 with the CSP header, `www` redirects to
   the apex, and `QA_BASE=https://randybuilds.tech pnpm test` passes.

**Undo:** remove the two Caddy blocks and reload; remove the tunnel hostnames. The container can keep running.

## D. Retire /designs (needs approval; only after C is live)

The three concept sites now live here. State checked 2026-10-12: the inquiry log volume
is empty, and the unmaskd. platform has no links to /designs.

**Open question first:** the remaining `/designs` previews are private previews of real
businesses (passcode-locked). Retiring /designs takes them offline. Decide whether to keep them
somewhere before step 2.

1. **Caddy:** back up, then delete the `@designs` matcher + `handle @designs { … }` from **both**
   `www.getunmaskd.com` blocks (https and `http://`), validate, reload (same in-place rule as C.3).
   `/designs` then falls through to the platform's own 404. Recommended: no redirect to
   randybuilds.tech, which would publicly tie the two brands together.
2. **Containers:** `docker compose -p unmaskd-designs -f /mnt/nvme/unmaskd-designs/compose.yaml down`
   (removes `unmaskd-designs` and `unmaskd-designs-mailer` only; named volume kept).
3. **Networks:** `docker network disconnect designs-edge compose-reverse-proxy-1`, then
   `docker network rm designs-edge unmaskd-designs-mail`.
4. **Command:** `rm ~/.local/bin/design`.
5. **Files:** archive, then remove:
   `tar czf /mnt/nvme/unmaskd-private-backups/unmaskd-designs-$(date +%Y%m%d).tgz -C /mnt/nvme --exclude=node_modules unmaskd-designs`
   then `rm -rf /mnt/nvme/unmaskd-designs` and `docker volume rm unmaskd-designs-inquiries`.
   Images: `docker rmi` the `unmaskd-designs:*` and `unmaskd-designs-mailer:*` tags.
6. Update the unmaskd. memory/docs that mention /designs.

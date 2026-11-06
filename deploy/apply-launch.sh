#!/usr/bin/env bash
# One-time go-live for randybuilds.tech (LAUNCH.md §C steps 2–3). Run by Randy.
#   1. attach the shared proxy to randybuilds-edge (no restart)
#   2. back up the Caddyfile, insert the randybuilds.tech blocks IN PLACE (same inode,
#      it's a single-file bind mount), validate inside the proxy, reload
#   3. check randybuilds.tech through the proxy and that every existing site answers as before
# Any failure before the reload restores the backup. Safe to re-run (skips what's done).
set -Eeuo pipefail

PROXY=compose-reverse-proxy-1
F=/mnt/nvme/unmaskd.app/infrastructure/compose/Caddyfile
BLOCK=/mnt/nvme/randybuilds-tech/deploy/randybuilds.tech.caddy
SITES=(www.getunmaskd.com getunmaskd.com unmaskd.app www.unmaskd.app empower.getunmaskd.com build.getunmaskd.com)

ok()  { printf '  \e[32m✓\e[0m %s\n' "$*"; }
die() { printf '  \e[31m✗ %s\e[0m\n' "$*" >&2; exit 1; }
codes() { for h in "${SITES[@]}"; do printf '%s=%s ' "$h" "$(curl -s -o /dev/null -w '%{http_code}' -m 5 -H "Host: $h" http://127.0.0.1/)"; done; }

echo "▸ Before"
BEFORE="$(codes)"; echo "  $BEFORE"

echo "▸ 1. Proxy ↔ randybuilds-edge"
tech attach-edge
docker exec "$PROXY" wget -q -O /dev/null http://randybuilds-tech:8080/healthz.txt && ok "proxy reaches randybuilds-tech:8080" || die "proxy cannot reach the site container"

echo "▸ 2. Caddyfile"
if grep -q '^http://randybuilds.tech {' "$F"; then
  ok "randybuilds.tech blocks already present"
else
  BK="$F.backup-before-randybuilds-$(date +%Y%m%d-%H%M%S)"
  cp -p "$F" "$BK"; ok "backup: $BK"
  INODE="$(stat -c %i "$F")"
  python3 - "$F" "$BLOCK" <<'PY'
import sys
path, block_path = sys.argv[1:3]
block = open(block_path).read()
# Drop the "PROPOSED" header comment; keep only the site blocks.
block = block[block.index('http://randybuilds.tech {'):].rstrip('\n')
header = ("# ── randybuilds.tech — independent site (own container randybuilds-tech on the\n"
          "# randybuilds-edge network). Added 2026-10-12. Source and undo notes:\n"
          "# /mnt/nvme/randybuilds-tech/deploy/. To undo: delete these two blocks, reload.\n")
with open(path, 'r+') as f:          # in place: same inode for the bind mount
    s = f.read()
    marker = '\nhttp:// {\n'
    assert s.count(marker) == 1, 'catch-all http:// block not found exactly once'
    s = s.replace(marker, '\n' + header + block + '\n\n' + 'http:// {\n', 1)
    f.seek(0); f.write(s); f.truncate()
PY
  [[ "$(stat -c %i "$F")" == "$INODE" ]] || die "inode changed (should never happen)"
  restore() { cat "$BK" > "$F"; printf '  restored the original Caddyfile\n'; }
  docker exec "$PROXY" grep -q '^http://randybuilds.tech {' /etc/caddy/Caddyfile || { restore; die "proxy does not see the edit"; }
  docker exec "$PROXY" caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 || { restore; die "caddy validate failed"; }
  ok "edited in place, proxy sees it, validate passed"
  docker exec "$PROXY" caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || { restore; die "reload failed (original restored; proxy still on old config)"; }
  ok "caddy reloaded"
fi

echo "▸ 3. Checks"
sleep 1
c="$(curl -s -o /dev/null -w '%{http_code}' -m 5 -H 'Host: randybuilds.tech' http://127.0.0.1/)"
[[ "$c" == 200 ]] && ok "randybuilds.tech via proxy: 200" || printf '  ! randybuilds.tech via proxy: %s\n' "$c"
c="$(curl -s -o /dev/null -w '%{http_code}' -m 5 -H 'Host: www.randybuilds.tech' http://127.0.0.1/)"
[[ "$c" == 301 ]] && ok "www.randybuilds.tech redirects: 301" || printf '  ! www.randybuilds.tech: %s\n' "$c"
AFTER="$(codes)"
if [[ "$AFTER" == "$BEFORE" ]]; then ok "existing sites unchanged: $AFTER"
else printf '  \e[31m! existing sites changed\e[0m\n  before: %s\n  after:  %s\n' "$BEFORE" "$AFTER"; fi
echo "Done. Next: add the two public hostnames to the existing tunnel in Cloudflare."

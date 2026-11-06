#!/usr/bin/env bash
# tech — build and run the Randy Builds Tech site (installed as ~/.local/bin/tech)
#
#   tech              update: commit any uncommitted work (shows it, asks for a
#                     message), push if a remote exists, then release
#                     (before launch: refresh the local preview instead)
#   tech preview      build the working tree into a separate localhost-only
#                     preview on 127.0.0.1:18480 (never touches the live site)
#   tech release      pre-flight → build tagged image → run (no host port)
#   tech clients      update ONLY the client projects on the live site: commit
#                     changes in clients/ (asks for a message), push, rebuild
#                     and restart the static client container. Main site,
#                     mailer and gate untouched.
#   tech rollback     switch back to the previous release image
#   tech status       images and container state
#   tech logs [-f]    container logs
#   tech preview-code <id> <keyword>           set the keyword for /preview/<id>/ (prospect)
#   tech preview-code <id> <keyword> --client  set the keyword for /clients/<id>/ (client)
#                     (only its hash is stored in .env.previews)
#   tech preview-code <id> --revoke  remove that code (ends its sessions)
#   tech preview-code --master <key> set the master key (opens /preview/vault/)
#   tech preview-code --list         active codes
#   tech attach-edge  ONE-TIME at launch (needs approval): connect the shared
#                     Caddy proxy to the randybuilds-edge network
#
# Touches ONLY the `randybuilds-tech` Compose project, its images and the
# randybuilds-edge network. Never edits the Caddyfile, never reloads Caddy,
# never runs `compose down` on anything else, never prunes.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
PROJECT=randybuilds-tech
IMAGE=randybuilds-tech
CONTAINER=randybuilds-tech
MAILER=randybuilds-tech-mailer
GATE=randybuilds-tech-gate
CLIENTS=randybuilds-tech-clients    # static client projects (clients/Dockerfile)
CODES="$ROOT/.env.previews"
NETWORK=randybuilds-edge
PROXY="${RBT_PROXY_CONTAINER:-compose-reverse-proxy-1}"
KEEP_IMAGES=4

ok()  { printf '  \e[32m✓\e[0m %s\n' "$*"; }
die() { printf '  \e[31m✗ %s\e[0m\n' "$*" >&2; exit 1; }
compose() { RBT_TAG="$1" docker compose -p "$PROJECT" -f "$ROOT/compose.yaml" "${@:2}"; }
health() { docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2>/dev/null || echo missing; }
wait_healthy() { for _ in $(seq 1 40); do [[ "$(health "$CONTAINER")" == healthy && "$(health "$MAILER")" == healthy && "$(health "$GATE")" == healthy && "$(health "$CLIENTS")" == healthy ]] && return 0; sleep 1.5; done; return 1; }
ensure_network() { docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null; }

# Like unmaskd.'s ./deploy: uncommitted work is shown, then committed as ONE
# commit after a human answers the prompt. Never automatic without a terminal.
risky_path() { [[ "$1" =~ (^|/)\.env($|\.)|\.(pem|key|p12|pfx)$|(^|/)id_(rsa|ed25519)|secret|credential ]]; }
# Optional arguments limit it to those paths (tech clients: clients/ only).
commit_work() {
  [[ -n "$(git status --porcelain -- "$@")" ]] || return 0
  local path blocked=0 msg what="ALL of it"
  [[ $# -gt 0 ]] && what="Everything in $*"
  while IFS= read -r path; do risky_path "$path" && { echo "  BLOCKED: $path"; blocked=1; }; done \
    < <(git status --porcelain --untracked-files=all -- "$@" | cut -c4- | sed 's/.* -> //')
  [[ "$blocked" == 0 ]] || die "possible secret file in the changes — nothing was staged"
  echo "▸ Uncommitted work"
  git status --short -- "$@"
  [[ -t 0 ]] || die "uncommitted changes — committing needs an interactive terminal"
  echo "  $what will be committed as one commit, pushed and released."
  read -r -p "  Commit message [blank: Update site, q: cancel]: " msg
  [[ "${msg,,}" == q ]] && { echo "  Cancelled. Nothing was committed or released."; exit 0; }
  git add --all -- "$@"
  git diff --cached --check >/dev/null || die "whitespace or conflict-marker errors in the staged change"
  if git diff --cached --unified=0 | grep -E '^\+[^+]' | \
      grep -Eq 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|re_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|sk_live_[A-Za-z0-9]{16,}'; then
    git reset -q; die "a secret pattern was found in the staged diff — nothing was committed"
  fi
  git commit -q -m "${msg:-Update site}"
  ok "committed $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"
}
push_work() {
  if ! git remote get-url origin >/dev/null 2>&1; then
    printf '  ! no git remote "origin" — push skipped\n'; return 0
  fi
  if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    [[ -z "$(git log --oneline '@{u}..HEAD')" ]] && return 0
    git push -q || die "push failed"
  else
    git push -q --set-upstream origin "$(git symbolic-ref --short HEAD)" || die "push failed"
  fi
  ok "pushed $(git rev-parse --short HEAD)"
}

cd "$ROOT"
cmd="${1:-update}"
# "Launched" = the shared proxy is attached to this site's network (tech attach-edge).
launched() { docker inspect -f '{{json .NetworkSettings.Networks}}' "$PROXY" 2>/dev/null | grep -q "\"$NETWORK\""; }
if [[ "$cmd" == update ]]; then
  if launched; then
    commit_work
    push_work
    live="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"
    if [[ "${live##*-}" == "$(git rev-parse --short HEAD)" && "$(health "$CONTAINER")" == healthy ]]; then
      ok "already live: $live"; exit 0
    fi
    cmd=release
  else echo "Not launched yet — refreshing the local preview."; cmd=preview; fi
fi
case "$cmd" in
  preview)
    exec "$ROOT/scripts/preview.sh" ;;

  release)
    echo "▸ Pre-flight"
    [[ -z "$(git status --porcelain)" ]] || die "uncommitted changes — commit first so the release matches git"
    grep -q 'emailVerified: true' src/site.ts || die "site.contact.emailVerified is false — verify the mailbox before a public release"
    pnpm build >/dev/null || die "build failed"
    ok "clean tree, mailbox verified, build OK"
    TAG="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
    PREV="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"
    echo "▸ Build $IMAGE:$TAG"
    docker build -q -t "$IMAGE:$TAG" . >/dev/null
    docker build -q -t "$MAILER:$TAG" mailer >/dev/null
    docker build -q -t "$GATE:$TAG" gate >/dev/null
    docker build -q -t "$CLIENTS:$TAG" -f clients/Dockerfile . >/dev/null
    # A release from before the preview gate / client container has no image for them; give it these so restoring it works.
    [[ -n "$PREV" ]] && { docker image inspect "$GATE:${PREV#*:}" >/dev/null 2>&1 || docker tag "$GATE:$TAG" "$GATE:${PREV#*:}"; }
    [[ -n "$PREV" ]] && { docker image inspect "$CLIENTS:${PREV#*:}" >/dev/null 2>&1 || docker tag "$CLIENTS:$TAG" "$CLIENTS:${PREV#*:}"; }
    [[ -n "$PREV" ]] && echo "$PREV" > "$ROOT/.last-release"
    ensure_network
    echo "▸ Run"
    compose "$TAG" up -d --force-recreate --remove-orphans >/dev/null 2>&1
    if wait_healthy; then
      docker tag "$IMAGE:$TAG" "$IMAGE:current"; docker tag "$MAILER:$TAG" "$MAILER:current"; docker tag "$GATE:$TAG" "$GATE:current"; docker tag "$CLIENTS:$TAG" "$CLIENTS:current"
      docker exec "$CONTAINER" wget -q -O /dev/null http://randybuilds-tech-mailer:8081/api/health 2>/dev/null && ok "site reaches the mailer" || printf '  ! site cannot reach the mailer\n'
      docker exec "$CONTAINER" wget -q -O /dev/null http://$CLIENTS:8080/healthz.txt 2>/dev/null && ok "site reaches the client projects" || printf '  ! site cannot reach the client projects\n'
      grep -q '^RESEND_API_KEY=.' "$ROOT/.env" 2>/dev/null || printf '  ! no RESEND_API_KEY in .env — the contact form will answer "unavailable"\n'
      ok "running $IMAGE:$TAG (healthy)"
      if docker exec "$PROXY" wget -q -T 5 -O /dev/null "http://$CONTAINER:8080/healthz.txt" 2>/dev/null; then
        code="$(curl -s -o /dev/null -w '%{http_code}' -m 10 https://randybuilds.tech/ || true)"
        [[ "$code" == 200 ]] && ok "https://randybuilds.tech/ answers 200" || printf '  ! public site answered %s\n' "$code"
      else
        printf '  ! edge proxy cannot reach the site yet (launch steps not applied?)\n'
      fi
    else
      [[ -n "$PREV" ]] && { compose "${PREV#*:}" up -d --force-recreate >/dev/null 2>&1; die "new image unhealthy — restored $PREV"; }
      die "new image unhealthy"
    fi
    for img in "$IMAGE" "$MAILER" "$GATE" "$CLIENTS"; do
      docker images "$img" --format '{{.Tag}}' | grep -E '^[0-9]{8}-' | sort -r | tail -n +$((KEEP_IMAGES + 1)) | xargs -r -I{} docker rmi "$img:{}" >/dev/null 2>&1 || true
    done
    ;;

  rollback)
    [[ -f "$ROOT/.last-release" ]] || die "no previous release recorded"
    PREV="$(cat "$ROOT/.last-release")"
    # Releases from before the preview gate existed have no gate image: reuse the current one.
    docker image inspect "$GATE:${PREV#*:}" >/dev/null 2>&1 || docker tag "$GATE:current" "$GATE:${PREV#*:}"
    docker image inspect "$CLIENTS:${PREV#*:}" >/dev/null 2>&1 || docker tag "$CLIENTS:current" "$CLIENTS:${PREV#*:}"
    compose "${PREV#*:}" up -d --force-recreate >/dev/null 2>&1
    wait_healthy && ok "rolled back to $PREV" || die "rollback image unhealthy"
    ;;

  clients)
    # Only the static client projects container.
    # The main site, mailer and gate keep running untouched.
    launched || die "not launched yet — use: tech preview"
    docker exec "$CONTAINER" grep -q randybuilds-tech-clients /etc/nginx/conf.d/default.conf 2>/dev/null \
      || die "the live site doesn't route to the client container yet — run a full \`tech\` once first"
    commit_work clients
    push_work
    [[ -z "$(git status --porcelain -- clients)" ]] || die "uncommitted changes in clients/"
    other="$(git status --porcelain | grep -v ' clients/' || true)"
    [[ -n "$other" ]] && printf '  ! changes outside clients/ were left alone (they go live with \`tech\`):\n%s\n' "$other"
    TAG="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
    PREV_C="$(docker inspect -f '{{.Config.Image}}' "$CLIENTS" 2>/dev/null || true)"
    echo "▸ Build client images $TAG"
    docker build -q -t "$CLIENTS:$TAG" -f clients/Dockerfile . >/dev/null || die "client projects build failed — nothing changed"
    echo "▸ Run (client container only)"
    compose "$TAG" up -d --no-deps --force-recreate clients >/dev/null 2>&1
    for _ in $(seq 1 40); do [[ "$(health "$CLIENTS")" == healthy ]] && break; sleep 1.5; done
    if [[ "$(health "$CLIENTS")" != healthy ]]; then
      [[ -n "$PREV_C" ]] && compose "${PREV_C#*:}" up -d --no-deps --force-recreate clients >/dev/null 2>&1
      die "new client container unhealthy — restored ${PREV_C:-nothing}"
    fi
    docker tag "$CLIENTS:$TAG" "$CLIENTS:current"
    docker exec "$CONTAINER" wget -q -O /dev/null "http://$CLIENTS:8080/healthz.txt" 2>/dev/null && ok "site reaches the client projects" || printf '  ! site cannot reach the client projects\n'
    ok "client projects live: $CLIENTS:$TAG (main site unchanged: $(docker inspect -f '{{.Config.Image}}' "$CONTAINER"))"
    # Older client images, keeping any that a recorded release can roll back to.
    keep="$(cat "$ROOT/.last-release" 2>/dev/null | sed 's/.*://')"
    for img in "$CLIENTS"; do
      docker images "$img" --format '{{.Tag}}' | grep -E '^[0-9]{8}-' | grep -vx "${keep:-none}" | sort -r | tail -n +$((KEEP_IMAGES + 1)) | xargs -r -I{} docker rmi "$img:{}" >/dev/null 2>&1 || true
    done
    ;;

  preview-code)
    # Codes are keywords Randy assigns to each project (e.g. "pupos"). The gate
    # ignores case, spaces and hyphens, and stores only SHA-256(lowercase code
    # without separators).
    #   <id> <keyword>           prospect preview  → /preview/<id>/
    #   <id> <keyword> --client  client project    → /clients/<id>/
    #   --master <key>           master key (yours) → /preview/vault/, opens every project
    id="${2:-}"; flag="${3:-}"; keyword=""
    if [[ "$id" != --* && -n "$flag" && "$flag" != --* ]]; then keyword="$flag"; flag="${4:-}"; fi
    touch "$CODES"; chmod 600 "$CODES"
    grep -q '^RBT_PREVIEW_SECRET=.' "$CODES" || echo "RBT_PREVIEW_SECRET=$(openssl rand -hex 32)" >> "$CODES"
    if [[ "$id" == --list ]]; then
      { grep -o '^RBT_PREVIEW_CODE_[a-z0-9]*' "$CODES" || true; } | sed 's|^RBT_PREVIEW_CODE_|  /preview/|; s|$|/|'
      { grep -o '^RBT_CLIENT_CODE_[a-z0-9]*' "$CODES" || true; } | sed 's|^RBT_CLIENT_CODE_|  /clients/|; s|$|/|'
      if grep -q '^RBT_MASTER_CODE=' "$CODES"; then echo "  master key → /preview/vault/"; fi
      exit 0
    fi
    restart_gate() {
      if docker inspect "$GATE" >/dev/null 2>&1; then
        compose "$(docker inspect -f '{{.Config.Image}}' "$GATE" | sed 's/.*://')" up -d --no-deps --force-recreate gate >/dev/null 2>&1
        for _ in $(seq 1 20); do [[ "$(health "$GATE")" == healthy ]] && break; sleep 1; done
        [[ "$(health "$GATE")" == healthy ]] || die "gate unhealthy after restart — check: tech logs"
        ok "$1; gate restarted"
      else
        ok "$1; the gate starts with the next release"
      fi
    }
    tmp="$(mktemp "$ROOT/.env.previews.XXXXXX")"; chmod 600 "$tmp"; trap 'rm -f "$tmp"' EXIT
    if [[ "$id" == --master ]]; then
      grep -v '^RBT_MASTER_CODE=' "$CODES" > "$tmp" || true
      if [[ "$flag" == --revoke ]]; then mv "$tmp" "$CODES"; restart_gate "master key removed"; exit 0; fi
      key="${flag,,}"; key="${key//[[:space:]-]/}"
      [[ ${#key} -ge 4 ]] || die "usage: tech preview-code --master <key>  (at least 4 letters/digits; spaces and dashes ignored)"
      echo "RBT_MASTER_CODE=$(printf '%s' "$key" | sha256sum | cut -d' ' -f1)" >> "$tmp"; mv "$tmp" "$CODES"
      [[ ${#key} -ge 12 ]] || printf '  ! a short master key is easier to guess; the vault allows 5 wrong tries per visitor every 15 minutes\n'
      restart_gate "master key set (opens /preview/vault/ and every project)"; exit 0
    fi
    [[ "$id" =~ ^[a-z0-9]{2,40}$ && "$id" != master && "$id" != vault ]] || die "usage: tech preview-code <id> <keyword> [--client] | <id> --revoke | --master <key> | --list"
    area=preview; var=RBT_PREVIEW_CODE
    if [[ "$flag" == --client ]]; then area=clients; var=RBT_CLIENT_CODE; fi
    [[ "$flag" == --revoke || "$area" == clients || -d "$ROOT/previews/src/pages/$id" || -d "$ROOT/clients/$id" ]] || die "no preview at previews/src/pages/$id/ or clients/$id/"
    grep -v -e "^RBT_PREVIEW_CODE_${id}=" -e "^RBT_CLIENT_CODE_${id}=" "$CODES" > "$tmp" || true
    if [[ "$flag" == --revoke ]]; then
      mv "$tmp" "$CODES"; restart_gate "revoked the code for $id (its sessions end now)"; exit 0
    fi
    code="${keyword,,}"; code="${code//[[:space:]-]/}"
    [[ "$code" =~ ^[a-z0-9]{4,64}$ ]] || die "usage: tech preview-code <id> <keyword> [--client]  (4–64 letters/digits; case, spaces and dashes ignored)"
    [[ "$code" != "$id" ]] || die "the keyword can't be the project id (it appears in the URL)"
    hash="$(printf '%s' "$code" | sha256sum | cut -d' ' -f1)"
    grep -q "=${hash}\$" "$tmp" && die "that keyword is already used by another project or the master key — nothing changed"
    echo "${var}_${id}=${hash}" >> "$tmp"; mv "$tmp" "$CODES"
    restart_gate "keyword set for /$area/$id/ (any earlier code for it no longer works)"
    printf '\n  Keyword: %s\n  URL:     https://randybuilds.tech/preview/\n  Only its hash is stored.\n\n' "$code"
    ;;

  attach-edge)
    ensure_network
    docker inspect "$PROXY" >/dev/null 2>&1 || die "proxy container $PROXY not found"
    if docker inspect -f '{{json .NetworkSettings.Networks}}' "$PROXY" | grep -q "\"$NETWORK\""; then
      ok "$PROXY already on $NETWORK"
    else
      docker network connect "$NETWORK" "$PROXY"
      ok "attached $PROXY to $NETWORK (no restart; Caddyfile unchanged)"
    fi
    ;;

  status)
    docker ps -a --filter "name=^${CONTAINER}" --format '{{.Names}}  {{.Image}}  {{.Status}}  {{.Ports}}'
    docker images "$IMAGE" --format '{{.Repository}}:{{.Tag}}  {{.CreatedSince}}  {{.Size}}'
    docker images "$MAILER" --format '{{.Repository}}:{{.Tag}}  {{.CreatedSince}}  {{.Size}}'
    docker images "$GATE" --format '{{.Repository}}:{{.Tag}}  {{.CreatedSince}}  {{.Size}}'
    docker images "$CLIENTS" --format '{{.Repository}}:{{.Tag}}  {{.CreatedSince}}  {{.Size}}'
    ;;

  logs) docker logs "${2:---tail=100}" "$CONTAINER"; echo "── mailer"; docker logs "${2:---tail=50}" "$MAILER"; echo "── gate"; docker logs "${2:---tail=50}" "$GATE"; echo "── clients"; docker logs "${2:---tail=50}" "$CLIENTS" ;;

  help|-h|--help) sed -n '2,25p' "$(readlink -f "$0")" ;;
  *) sed -n '2,25p' "$(readlink -f "$0")"; exit 1 ;;
esac

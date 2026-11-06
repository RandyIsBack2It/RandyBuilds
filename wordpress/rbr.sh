#!/usr/bin/env bash
# rbr — run and maintain Resources (WordPress) at randybuilds.tech/resources/
#
#   rbr.sh init              create secrets/ (random DB password, keys and salts) and the edge network
#   rbr.sh up                run in production mode (canonical https address, no host port)
#   rbr.sh local             run in local test mode on http://127.0.0.1:18490/resources/ (same data)
#   rbr.sh setup             install WordPress if needed, apply settings
#   rbr.sh import            retired: WordPress is the only home of Resources (2026-10-27)
#   rbr.sh set-admin-password    set the admin password from secrets/admin-password, then delete that file
#   rbr.sh wp <args>         run WP-CLI (e.g. rbr.sh wp plugin list)
#   rbr.sh backup            database dump + wp-content archive into backups/ (keeps the newest 14 of each)
#   rbr.sh restore <db.sql.gz> [<wp-content.tar.gz>]   restore from a backup (asks first, backs up first)
#   rbr.sh update            back up, pull the images named in compose.yaml, recreate, upgrade the database
#   rbr.sh attach-edge       connect the shared Caddy proxy to randybuilds-resources-edge (no restart)
#   rbr.sh cron-install      add a nightly `rbr.sh backup` to this user's crontab (once)
#   rbr.sh status | logs [-f] | stop
#
# Touches ONLY the randybuilds-resources Compose project, its volumes and the
# randybuilds-resources-edge network. Never edits the Caddyfile, never runs
# `compose down -v`, never prunes. The admin password is never an argument,
# never printed and never written outside secrets/.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT=randybuilds-resources
APP=randybuilds-resources
DB=randybuilds-resources-db
CONTENT_VOLUME=randybuilds-resources-wp-content
NETWORK=randybuilds-resources-edge
PROXY="${RBT_PROXY_CONTAINER:-compose-reverse-proxy-1}"
SECRETS="$ROOT/secrets"
BACKUPS="${RBR_BACKUP_DIR:-$ROOT/backups}"
KEEP=14
CANONICAL=https://randybuilds.tech/resources
LOCAL=http://127.0.0.1:18490/resources
ADMIN_USER=randy
ADMIN_EMAIL=connect@randybuilds.tech

ok()  { printf '  \e[32m✓\e[0m %s\n' "$*"; }
die() { printf '  \e[31m✗ %s\e[0m\n' "$*" >&2; exit 1; }
# Local mode is remembered in .mode so `wp`, `setup` and `status` use the same address.
mode() { cat "$ROOT/.mode" 2>/dev/null || echo production; }
compose() {
  if [[ "$(mode)" == local ]]; then
    RBR_HOME="$LOCAL" docker compose -p "$PROJECT" -f "$ROOT/compose.yaml" -f "$ROOT/compose.local.yaml" "$@"
  else
    docker compose -p "$PROJECT" -f "$ROOT/compose.yaml" "$@"
  fi
}
wp() { compose run --rm -T cli wp "$@" 2> >(grep -v "^ *Container " >&2); }
health() { docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2>/dev/null || echo missing; }
wait_healthy() { for _ in $(seq 1 60); do [[ "$(health "$APP")" == healthy && "$(health "$DB")" == healthy ]] && return 0; sleep 2; done; return 1; }
ensure_network() { docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null; }
need_secrets() { [[ -f "$SECRETS/db.env" && -f "$SECRETS/wp.env" ]] || die "no secrets yet: run rbr.sh init"; }
rand() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-"${1:-40}"; }

backup() {
  umask 077; mkdir -p "$BACKUPS"; chmod 700 "$BACKUPS"
  local ts db files
  ts="$(date +%Y%m%d-%H%M%S)"; db="$BACKUPS/db-$ts.sql.gz"; files="$BACKUPS/wp-content-$ts.tar.gz"
  [[ "$(health "$DB")" == healthy ]] || die "database container is not healthy"
  # MYSQL_PWD keeps the password out of the process list.
  docker exec "$DB" sh -c 'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb-dump --single-transaction --quick --routines --triggers --default-character-set=utf8mb4 -u"$MARIADB_USER" "$MARIADB_DATABASE"' \
    | gzip -9 > "$db"
  gzip -cd "$db" | tail -n 1 | grep -q 'Dump completed' || { rm -f "$db"; die "database dump incomplete"; }
  docker run --rm --network none -v "$CONTENT_VOLUME:/src:ro" --entrypoint tar "$(image wordpress)" -C /src -czf - . > "$files"
  tar -tzf "$files" >/dev/null || { rm -f "$files"; die "wp-content archive unreadable"; }
  ok "backup: $db ($(du -h "$db" | cut -f1)), $files ($(du -h "$files" | cut -f1))"
  for kind in db wp-content; do
    ls -1t "$BACKUPS"/"$kind"-*.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
  done
}
image() { compose config --images "$1" 2>/dev/null | head -n1; }

cd "$ROOT"
cmd="${1:-help}"
case "$cmd" in
  init)
    umask 077; mkdir -p "$SECRETS"; chmod 700 "$SECRETS"
    if [[ ! -f "$SECRETS/db.env" ]]; then
      pw="$(rand 40)"
      printf 'MARIADB_DATABASE=wordpress\nMARIADB_USER=wordpress\nMARIADB_PASSWORD=%s\nMARIADB_ROOT_PASSWORD=%s\nMARIADB_AUTO_UPGRADE=1\n' "$pw" "$(rand 40)" > "$SECRETS/db.env"
      { printf 'WORDPRESS_DB_PASSWORD=%s\n' "$pw"
        for k in AUTH_KEY SECURE_AUTH_KEY LOGGED_IN_KEY NONCE_KEY AUTH_SALT SECURE_AUTH_SALT LOGGED_IN_SALT NONCE_SALT; do
          printf 'WORDPRESS_%s=%s\n' "$k" "$(rand 64)"; done; } > "$SECRETS/wp.env"
      unset pw
      ok "created secrets/db.env and secrets/wp.env (chmod 600; never commit them)"
    else ok "secrets already exist (unchanged)"; fi
    chmod 600 "$SECRETS"/*.env
    ensure_network; ok "network $NETWORK ready"
    ;;

  up|local)
    need_secrets; ensure_network
    if [[ "$cmd" == local ]]; then echo local > "$ROOT/.mode"; else rm -f "$ROOT/.mode"; fi
    compose up -d --remove-orphans >/dev/null 2>&1 || compose up -d --remove-orphans
    wait_healthy || die "containers not healthy — check: rbr.sh logs"
    if [[ "$cmd" == local ]]; then ok "running in local test mode: $LOCAL/"
    else ok "running in production mode ($CANONICAL/, no host port)"; fi
    ;;

  setup)
    need_secrets
    [[ "$(health "$APP")" == healthy ]] || die "start it first: rbr.sh local (or rbr.sh up)"
    if ! wp core is-installed >/dev/null 2>&1; then
      # Installed with a random password nobody sees; set yours with set-admin-password.
      # (--prompt echoes the completed command on stdout, hence >/dev/null.)
      rand 40 | wp core install --url="$CANONICAL" --title='RandyBuilds.tech Resources' \
        --admin_user="$ADMIN_USER" --admin_email="$ADMIN_EMAIL" --skip-email --prompt=admin_password >/dev/null
      ok "WordPress installed (admin user: $ADMIN_USER, $ADMIN_EMAIL)"
    else ok "WordPress already installed"; fi
    wp eval-file /migrate/setup.php
    ;;

  import)
    # The one-time import from the main site's /resources/ is done; those pages are gone and
    # WordPress is the source. Edit here; restore from a backup (rbr.sh restore) if needed.
    die "retired: Resources are edited in WordPress now (the main site's /resources/ pages were removed)"
    ;;

  set-admin-password)
    f="$SECRETS/admin-password"
    [[ -f "$f" ]] || die "create it first (see README.md, 'Administrator password')"
    [[ "$(stat -c %a "$f")" == 600 ]] || die "secrets/admin-password must be chmod 600"
    [[ "$(wc -c < "$f")" -ge 12 ]] || die "the password in secrets/admin-password is shorter than 12 characters"
    # Read from stdin inside PHP: never on a command line, never printed. (WP-CLI's
    # --prompt is not used here: it echoes the completed command, value included.)
    wp eval '$pw = rtrim(stream_get_contents(STDIN), "\r\n");
      $u = get_user_by("login", "'"$ADMIN_USER"'");
      if (!$u || strlen($pw) < 12) { fwrite(STDERR, "no admin user, or password too short\n"); exit(1); }
      wp_set_password($pw, $u->ID);' < "$f" >/dev/null || die "password not changed"
    wp user update "$ADMIN_USER" --user_email="$ADMIN_EMAIL" --skip-email >/dev/null
    shred -u "$f" 2>/dev/null || rm -f "$f"
    ok "admin password set for $ADMIN_USER; secrets/admin-password deleted"
    ;;

  wp) shift; need_secrets; compose run --rm cli wp "$@" ;;

  backup) backup ;;

  restore)
    dbf="${2:-}"; files="${3:-}"
    [[ -f "$dbf" ]] || die "usage: rbr.sh restore <db-….sql.gz> [<wp-content-….tar.gz>]"
    [[ -z "$files" || -f "$files" ]] || die "no such file: $files"
    gzip -t "$dbf" || die "$dbf is not a valid gzip file"
    [[ -t 0 ]] || die "restore needs an interactive terminal"
    read -r -p "  Replace the live database${files:+ and wp-content} with this backup? A fresh backup is taken first. [y/N] " a
    [[ "${a,,}" == y ]] || { echo "  Cancelled."; exit 0; }
    backup
    if [[ -n "$files" ]]; then
      compose stop wordpress >/dev/null 2>&1
      docker run --rm -i --network none -v "$CONTENT_VOLUME:/dst" --entrypoint sh "$(image wordpress)" \
        -c 'find /dst -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -C /dst -xzf - && chown -R www-data:www-data /dst' < "$files"
      ok "wp-content restored"
    fi
    gzip -cd "$dbf" | docker exec -i "$DB" sh -c 'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb -u"$MARIADB_USER" "$MARIADB_DATABASE"'
    ok "database restored"
    compose up -d >/dev/null 2>&1; wait_healthy || die "not healthy after restore — check: rbr.sh logs"
    wp cache flush >/dev/null 2>&1 || true
    ok "running again"
    ;;

  update)
    need_secrets
    backup
    compose pull wordpress db >/dev/null
    docker pull -q "$(image cli)" >/dev/null
    # --renew-anon-volumes: the image keeps core files in an anonymous volume; renewing it brings the new version's files.
    compose up -d --renew-anon-volumes wordpress db >/dev/null 2>&1
    wait_healthy || die "not healthy after update — restore with: rbr.sh restore <latest backups>"
    wp core update-db >/dev/null
    ok "now running WordPress $(wp core version) on $(image wordpress)"
    wp plugin list --update=available --format=count 2>/dev/null | grep -qx 0 || printf '  ! plugin updates are available: rbr.sh wp plugin update --all\n'
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

  cron-install)
    line="17 3 * * * $ROOT/rbr.sh backup >> $BACKUPS/backup.log 2>&1"
    umask 077; mkdir -p "$BACKUPS"
    if crontab -l 2>/dev/null | grep -qF "$ROOT/rbr.sh backup"; then ok "nightly backup already in crontab"
    else { crontab -l 2>/dev/null || true; echo "$line"; } | crontab -; ok "nightly backup added: $line"; fi
    ;;

  status)
    echo "  mode: $(mode)"
    docker ps -a --filter "name=^randybuilds-resources" --format '  {{.Names}}  {{.Image}}  {{.Status}}  {{.Ports}}'
    if docker exec "$PROXY" wget -q -T 5 -O /dev/null "http://$APP/wp-includes/images/blank.gif" 2>/dev/null; then ok "edge proxy reaches WordPress"
    else printf '  ! edge proxy cannot reach WordPress (rbr.sh attach-edge?)\n'; fi
    ls -1t "$BACKUPS"/db-*.sql.gz 2>/dev/null | head -n1 | sed 's/^/  latest backup: /' || true
    ;;

  logs) docker logs "${2:---tail=100}" "$APP"; echo "── db"; docker logs "${2:---tail=50}" "$DB" ;;
  stop) compose stop ;;
  help|-h|--help) sed -n '2,21p' "$0" ;;
  *) sed -n '2,21p' "$0"; exit 1 ;;
esac

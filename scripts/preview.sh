#!/usr/bin/env bash
# Build the current working tree and (re)start the localhost-only preview on
# 127.0.0.1:18480. Uses its own Compose project and :preview image tags — it
# never touches the live randybuilds-tech containers.
set -euo pipefail
cd "$(dirname "$0")/.."
docker build -q -t randybuilds-tech:preview . >/dev/null
docker build -q -t randybuilds-tech-mailer:preview mailer >/dev/null
docker build -q -t randybuilds-tech-gate:preview gate >/dev/null
docker build -q -t randybuilds-tech-clients:preview -f clients/Dockerfile . >/dev/null
docker compose -f compose.preview.yaml up -d --force-recreate >/dev/null 2>&1
for _ in $(seq 1 20); do curl -fs -o /dev/null http://127.0.0.1:18480/healthz.txt 2>/dev/null && break; sleep 0.5; done
echo "Preview: http://127.0.0.1:18480/"

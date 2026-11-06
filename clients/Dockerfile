# syntax=docker/dockerfile:1
# Static client projects (randybuilds-tech-clients): every clients/<id>/ with
# an astro.config.mjs is built at /preview/<id>/ and served by unprivileged
# nginx. The main site's nginx checks the preview gate first, then proxies
# here, so this container is never reachable without a session. Live apps with
# their own server would need their own images.
# Build context: the repository root (Astro comes from the root lockfile).
#   docker build -f clients/Dockerfile .      (or: tech clients)
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY clients ./clients
RUN set -e; mkdir -p /out/preview; \
    for cfg in clients/*/astro.config.mjs; do \
      [ -e "$cfg" ] || continue; \
      id="$(basename "$(dirname "$cfg")")"; \
      CLIENT_BASE="/preview/$id/" CLIENT_OUT="/out/preview/$id" pnpm exec astro build --root "clients/$id"; \
    done; \
    echo ok > /out/healthz.txt

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY clients/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz.txt || exit 1

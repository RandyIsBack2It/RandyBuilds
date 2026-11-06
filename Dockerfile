# syntax=docker/dockerfile:1
# ── Build: static site ─────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY astro.config.mjs tsconfig.json ./
COPY src ./src
COPY public ./public
COPY previews ./previews
COPY clients ./clients
RUN pnpm exec astro build && pnpm exec astro build --root previews
# The share-link manager is built with the site but must not be public:
# move it out of the public root (served behind the gate, nginx.conf).
RUN mkdir -p private/admin && mv dist/admin/links private/admin/links

# ── Runtime: unprivileged nginx serving files only ─────────────────────────
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Private client previews: outside the public root, served only after the
# gate accepts the session (nginx.conf, location ~ ^/preview/).
COPY --from=build /app/previews/dist /usr/share/nginx/private/preview
COPY --from=build /app/private/admin /usr/share/nginx/private/admin
# Client projects (said yes) are added under /usr/share/nginx/private/clients/<id>/.
# Static client concepts (clients/<id>/) live in their own container instead
# (clients/Dockerfile), so `tech clients` can update them without a release.
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz.txt || exit 1

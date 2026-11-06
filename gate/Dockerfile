FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./server.mjs
USER node
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8082/api/health || exit 1
CMD ["node", "server.mjs"]

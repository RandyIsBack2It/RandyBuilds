FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./server.mjs
# Inquiry log lives on a named volume mounted here; owned by the runtime user.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8081/api/health || exit 1
CMD ["node", "server.mjs"]

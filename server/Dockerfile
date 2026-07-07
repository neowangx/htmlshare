# The self-hosted server imports only Node built-ins (node:http, node:crypto, …) and its own
# lib/ files — zero npm runtime dependencies — so there is no dependency-install stage. This
# keeps the image minimal (D14) and avoids shipping the CLI's markdown/sanitize packages.
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8090 \
    DATA_DIR=/data
WORKDIR /app
# package.json only supplies "type": "module" so server.js runs as ESM; no deps installed.
COPY package.json ./
COPY server ./server
RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 8090
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8090) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server/server.js"]

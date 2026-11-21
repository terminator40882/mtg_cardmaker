FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    FONTS_DIR=/app/fonts

WORKDIR /app

# Abhängigkeiten (Express + frei lizenzierte Ersatzschriften) werden beim Build
# ins Image installiert – zur Laufzeit wird nichts von CDNs nachgeladen.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY public ./public
COPY fonts ./fonts

RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/api/fonts > /dev/null || exit 1

CMD ["node", "server/index.js"]

# Mehrstufiger Build fuer die Next.js-App (Standalone-Output).
# Setzt "output: 'standalone'" in next.config.js voraus.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Nicht als root laufen. Die Gruppe "nodejs" ist zugleich die Hauptgruppe
# des Benutzers -- ohne -G landete er in "nogroup" (65533), und alles, was
# er anlegte, gehoerte einer Gruppe, die mit dem Abbild nichts zu tun hat
# (bug-027).
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
# su-exec gibt die root-Rechte des Einstiegsskripts wieder ab, bevor die
# Anwendung startet (siehe deploy/docker-entrypoint.sh).
RUN apk add --no-cache su-exec

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public/ wird im Builder notfalls angelegt, damit der COPY nie fehlschlaegt.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Migrationen laufen beim Start an (siehe scripts/migrate.mjs); pg kommt
# aus dem Standalone-node_modules, da lib/db/pool.ts es bereits nutzt.
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Ablageort der Bilddateien; im Betrieb ein Host-Volume. Dieses chown trifft
# nur das leere Verzeichnis im Abbild -- der Mount legt sich beim Start
# darueber. Die Rechte, auf die es ankommt, setzt das Einstiegsskript
# (bug-027).
RUN mkdir -p /data/images /data/backups && chown -R nextjs:nodejs /data

COPY --chmod=755 deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
# Der Einstieg laeuft als root, richtet die gemounteten Verzeichnisse ein
# und wechselt fuer die Anwendung selbst auf "nextjs".
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]

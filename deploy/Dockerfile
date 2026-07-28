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

# Nicht als root laufen.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public/ wird im Builder notfalls angelegt, damit der COPY nie fehlschlaegt.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Ablageort der Bilddateien; im Betrieb ein Host-Volume.
RUN mkdir -p /data/images && chown -R nextjs:nodejs /data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

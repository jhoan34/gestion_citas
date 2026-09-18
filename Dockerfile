FROM node:24-alpine AS base
WORKDIR /app

# ---------- Frontend ----------
FROM base AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# ARGs para inyectar config pública en build-time (docker build --build-arg ...)
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---------- Backend ----------
FROM base AS backend-build
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
# El cliente Prisma está gitignoreado: hay que generarlo en el build.
# (DATABASE_URL dummy: `generate` no se conecta a la BD, solo lee el schema.)
ENV DATABASE_URL="postgresql://localhost:5432/placeholder"
RUN npx prisma generate
RUN npm run build

# ---------- Final ----------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV STATIC_DIR=/app/public
# Default local; Render inyecta su propio PORT en runtime y lo sobrescribe.
ENV PORT=4000

COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma7.config.ts ./
# Deps completas (incl. prisma CLI + tsx): se necesitan en runtime para
# `migrate deploy` y `db seed` al arrancar el contenedor.
RUN npm ci && npm cache clean --force

COPY --from=backend-build --chown=node:node /app/backend/dist ./dist
# El seed (tsx prisma/seed.ts) importa el cliente vía ../src/generated (layout dev):
# se necesitan las fuentes .ts, que tsc no emite a dist/.
COPY --from=backend-build --chown=node:node /app/backend/src/generated ./src/generated
# Migraciones + seed para `migrate deploy` / `db seed` en el arranque.
COPY --from=backend-build --chown=node:node /app/backend/prisma ./prisma
COPY --from=frontend-build --chown=node:node /app/frontend/dist ./public

USER node

EXPOSE 4000

# CMD-SHELL para que $PORT se expanda en runtime (Render inyecta su propio puerto).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migra, siembra base (sin demo: SEED_DEMO no está seteado) y arranca.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/index.js"]

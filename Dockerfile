FROM node:22-alpine AS base
WORKDIR /app

# ---------- Frontend ----------
FROM base AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# ARG permite inyectar la key en build-time (docker build --build-arg ...)
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

RUN npm run build

# ---------- Backend ----------
FROM base AS backend-build
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
RUN npm run build

# ---------- Final ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV STATIC_DIR=/app/public
ENV PORT=4000

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=backend-build --chown=node:node /app/backend/dist ./dist
COPY --from=frontend-build --chown=node:node /app/frontend/dist ./public

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]

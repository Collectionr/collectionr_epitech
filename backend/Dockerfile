# syntax=docker/dockerfile:1

# Multi-stage build for the NestJS backend (COLLR-683).
# Build context: backend/ (see .dockerignore). Node version aligned with engines in package.json.

ARG NODE_VERSION=24.18.0

# ---------------------------------------------------------------------------
# Stage 1 — dependencies (dev included, needed to compile TypeScript)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps

WORKDIR /app

# Prisma schema + config are needed before `npm ci`: its postinstall runs `prisma generate`.
# tsconfig.json must be there too: Prisma picks the generated client's module format (CJS/ESM,
# .js/.ts imports) from it. Without it the client is generated as ESM and fails to load at runtime.
COPY package.json package-lock.json ./
COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2 — build (TypeScript compilation via nest build)
# ---------------------------------------------------------------------------
FROM deps AS build

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3 — production dependencies only
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./

# --ignore-scripts: the Prisma client is already generated and compiled in the build stage (dist/generated).
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 4 — runtime image (no toolchain, no sources, non-root)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]

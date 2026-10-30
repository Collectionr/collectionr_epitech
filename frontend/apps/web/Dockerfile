# syntax=docker/dockerfile:1

# Image de l'application web : build Vite sur Node, puis fichiers statiques servis par nginx non-root.
# Contexte de build : frontend/ (docker build -f apps/web/Dockerfile .)

# Aligné sur .nvmrc
ARG NODE_VERSION=24.18.0

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Seuls les manifestes de web et shared sont copiés avant npm ci : le workspace mobile
# reste absent, ce qui garde Expo et React Native hors de l'image.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# URL de l'API figée au build (défaut : même domaine derrière l'Ingress)
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build -w @collectionr/web

FROM nginxinc/nginx-unprivileged:1.30-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

# syntax=docker/dockerfile:1

# Image de l'application web : build Vite sur Node, puis fichiers statiques servis par nginx non-root.
# Contexte de build : frontend/ (docker build -f apps/web/Dockerfile .)

# Aligné sur .nvmrc
ARG NODE_VERSION=24.18.0

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @collectionr/web

FROM nginxinc/nginx-unprivileged:1.30-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

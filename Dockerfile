# syntax=docker/dockerfile:1.7

# ---- Stage 1: build ----
# Pinned to the exact current Node 24 LTS patch (matches @types/node in
# package.json) rather than a floating "alpine"/"lts" tag, so this build
# is reproducible instead of silently picking up a new Node release later.
FROM node:24.18.0-alpine AS build
WORKDIR /app

# Copy only the manifest files first so Docker can cache the `npm ci`
# layer and skip reinstalling dependencies on rebuilds where only
# source files changed.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines any VITE_* variable into the compiled JS at build time
# (import.meta.env) — they must be supplied as build ARGs, not container
# runtime env vars, since setting them at `docker run` time would have no
# effect on an already-compiled bundle.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ---- Stage 2: serve ----
# nginx-unprivileged (not the plain "nginx" image) runs as a non-root
# user (uid 101) and listens on port 8080 by default, so even if the
# app or Nginx itself were ever compromised, the process never has root
# inside the container. Pinned to the exact digest-verified current
# stable release rather than a floating tag.
FROM nginxinc/nginx-unprivileged:1.30.4-alpine AS serve

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]

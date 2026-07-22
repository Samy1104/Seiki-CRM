# Running Seiki-CRM in Docker

Seiki-CRM is a static single-page app (React + Vite + TypeScript). It has no
backend of its own — Supabase is an external managed service the built app
talks to over HTTPS. Containerizing it means: compile it, then serve the
resulting static files. No database, no server process to configure, no
Node.js required on the host that runs the container.

This is a standalone, host-agnostic setup — it does not assume any
particular VM, domain, or OS. It works the same way on a Windows machine via
Docker Desktop, a Linux VM, or any container platform (Kubernetes, Coolify,
Dokploy, ECS, ...). For deploying it specifically to the project's VM behind
its existing Nginx, see [DEPLOY_VM.md](DEPLOY_VM.md).

## What's in this setup

| File | Purpose |
|---|---|
| [`Dockerfile`](Dockerfile) | Two-stage build: Node compiles the app, then a minimal non-root Nginx image serves it. |
| [`docker/nginx.conf`](docker/nginx.conf) | SPA routing, gzip, security headers (CSP, etc.), caching rules — this runs *inside* the container. |
| [`docker-compose.yml`](docker-compose.yml) | One-command build+run with security hardening (read-only filesystem, dropped capabilities, resource limits). |
| [`.dockerignore`](.dockerignore) | Keeps secrets and `node_modules` out of the image build context. |
| [`nginx/seiki-crm.conf`](nginx/seiki-crm.conf) | The VM's *system* Nginx config — reverse-proxies to the container. Not used locally. |

## Why the env vars work differently here

`npm run build` compiles `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
directly into the JavaScript bundle — they are not read again once the app
is running. That means:

- They must be provided when the **image is built**, not when the
  **container is started**. Setting them with `docker run -e ...` would do
  nothing, because by then the JS has already been compiled.
- If the Supabase project ever changes, you must **rebuild the image**
  (`docker compose up -d --build`), not just restart the container.
- The anon key is safe to embed this way — it's the same public key your
  browser already downloads today; it's meant to be public and is
  restricted by Supabase Row Level Security.

## Security hardening in this setup

- **Non-root**: the final image is built on `nginxinc/nginx-unprivileged`,
  which runs Nginx as an unprivileged user (uid 101), not root.
- **Pinned, verified image versions**: `node:24.18.0-alpine` and
  `nginxinc/nginx-unprivileged:1.30.4-alpine` are exact versions, not
  floating `latest`/`alpine` tags that could silently change what you're
  running.
- **Read-only root filesystem** (`read_only: true`). The container can't
  write anywhere except two small in-memory `tmpfs` mounts (`/tmp`,
  `/var/cache/nginx`) that Nginx needs for its pid file and cache.
- **All Linux capabilities dropped** (`cap_drop: [ALL]`) and
  **privilege escalation disabled** (`no-new-privileges:true`).
- **Not exposed to the network directly**: the container publishes to
  `127.0.0.1:8080` only (see `docker-compose.yml`). It is unreachable from
  outside the machine it runs on — a reverse proxy in front (system Nginx
  on the VM, or nothing extra needed for local testing via `localhost`) is
  what the outside world actually talks to.
- **Resource limits** (`mem_limit`, `cpus`, `pids_limit`) so the container
  can't exhaust the host.
- **Security headers** set by Nginx on every response: `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and a
  `Content-Security-Policy` restricting scripts/styles/fonts/connections to
  the app's own origin, Google Fonts, and `*.supabase.co`.
- **`server_tokens off`** so Nginx doesn't advertise its exact version.
- Hidden files (`.env`, `.git`, ...) are denied by Nginx even if one ever
  ends up inside the image by mistake.
- The container never terminates TLS itself. Whoever hosts it puts their
  own reverse proxy in front for the actual domain and HTTPS certificate.

## 1. Prerequisites

Docker (Docker Desktop locally, or Docker Engine on a server). Confirm:

```bash
docker --version
docker compose version
```

## 2. Configure the Supabase credentials

Create a file named `.env` (not `.env.local` — that's the separate file
Vite reads for `npm run dev`) next to `docker-compose.yml`, with the same
two values described in [`.env.example`](.env.example):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

Docker Compose loads `.env` automatically — that's what fills in
`${VITE_SUPABASE_URL}` in `docker-compose.yml`. This file is already
git-ignored, so it never gets committed.

## 3. Build and run

```bash
docker compose up -d --build
```

This builds the image and starts the container in the background,
publishing it on `http://localhost:8080` (bound to `127.0.0.1` only — see
"Security hardening" above).

To use a different local port, add to the same `.env` file:

```env
HOST_PORT=3000
```

Check it's healthy:

```bash
docker compose ps        # STATUS column should say "healthy" after ~30s
```

Or just open `http://localhost:8080` in a browser.

## 4. Everyday commands

| Task | Command |
|---|---|
| View logs | `docker compose logs -f` |
| Stop | `docker compose down` |
| Redeploy after a code or env change | `docker compose up -d --build` |
| Rebuild from scratch (ignore cache) | `docker compose build --no-cache && docker compose up -d` |

## 5. Handing off to whoever hosts it

They don't need this repository's source code at all if you push the built
image to a registry instead:

```bash
docker build -t <your-dockerhub-username>/seiki-crm:latest \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your_anon_public_key .
docker push <your-dockerhub-username>/seiki-crm:latest
```

Then on their machine:

```bash
docker run -d --restart unless-stopped -p 127.0.0.1:8080:8080 \
  <your-dockerhub-username>/seiki-crm:latest
```

They put their own reverse proxy in front for the domain and HTTPS — see
`nginx/seiki-crm.conf` for a working example of that reverse-proxy config.

## 6. Troubleshooting

- **Blank page / old data after changing Supabase credentials**: you
  restarted the container instead of rebuilding it. Run
  `docker compose up -d --build`.
- **404 on page refresh for a client-side route**: check
  `docker/nginx.conf` still has the `try_files $uri $uri/ /index.html;`
  fallback.
- **Container marked "unhealthy"**: `docker compose logs` — usually means
  the build produced an empty/broken `dist/`, check the build step output.
- **Something is blocked by Content-Security-Policy** (check the browser
  console for a `Refused to ...` message): add the domain it's complaining
  about to the relevant directive in `docker/nginx.conf`.
- **Can't reach the site from another machine**: expected — the container
  only binds `127.0.0.1`. That's by design; put a reverse proxy in front
  (see [DEPLOY_VM.md](DEPLOY_VM.md)) rather than exposing the container
  directly.

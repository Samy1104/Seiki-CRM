# Cheat sheet — updating the live site

## 1. On your machine

```bash
# ...make your changes...
git add .
git commit -m "describe what changed"
git push origin main
```

## 2. On the VM

```bash
ssh samy1104@Seiki-CRM
cd /var/www/seiki-crm
./deploy.sh
```

That's it. `deploy.sh` does `git pull` + rebuilds the Docker image + restarts
the container + cleans up old images.

---

## Sanity checks after deploying

```bash
docker compose ps                 # STATUS should say "healthy"
docker compose logs -f            # Ctrl+C to stop watching
curl -I http://127.0.0.1:8080     # should return 200 OK
```

Then check the real domain in a browser: `http://seikicrm.h.minet.net`

## If something looks wrong

| Symptom | Command |
|---|---|
| Old version still showing | `docker compose up -d --build` (rebuild wasn't picked up) |
| Container unhealthy / won't start | `docker compose logs` |
| Nginx (system, the reverse proxy) acting up | `sudo nginx -t && sudo systemctl status nginx` |
| Roll back to previous commit | `git log --oneline -5` then `git checkout <hash> -- .` and redeploy |

## Optional: test the container locally before pushing

From `Projet/` on your machine (Docker Desktop):

```bash
docker compose up -d --build
```

Open `http://localhost:8080` and check it before pushing to `main`.

---

Full details: [DEPLOY_VM.md](DEPLOY_VM.md) (VM setup) · [DOCKER.md](DOCKER.md) (Docker internals & security).

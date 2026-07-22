# Guide de déploiement Seiki-CRM sur VM (Docker)

Ce guide déploie l'application avec le conteneur Docker décrit dans
[DOCKER.md](DOCKER.md), derrière le Nginx système de la VM en reverse
proxy. Le Nginx système garde la main sur le port 80/443, le domaine et
(plus tard) le certificat HTTPS ; il ne fait que transmettre les requêtes
au conteneur, qui écoute en local sur `127.0.0.1:8080`.

```
Internet → Nginx système (VM, port 80/443, domaine + TLS)
              → proxy_pass → conteneur Docker (127.0.0.1:8080 uniquement)
```

## Étape 1 — Prérequis sur la VM

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx

# Docker Engine (pas Docker Desktop — c'est un serveur headless)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Se déconnecter puis se reconnecter pour que l'appartenance au groupe
# "docker" prenne effet (ou lancer : newgrp docker)
```

## Étape 2 — Cloner le projet

```bash
sudo mkdir -p /var/www/seiki-crm
sudo chown -R $USER:$USER /var/www/seiki-crm
git clone https://github.com/Samy1104/Seiki-CRM.git /var/www/seiki-crm
cd /var/www/seiki-crm
```

## Étape 3 — Configurer les identifiants Supabase

Docker Compose lit automatiquement un fichier `.env` placé à côté de
`docker-compose.yml` pour les arguments de build (voir
[DOCKER.md](DOCKER.md) pour le détail de pourquoi ces valeurs doivent être
fournies au moment du build, pas au lancement du conteneur) :

```bash
nano .env
```
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-publique-ici
```

## Étape 4 — Construire et lancer le conteneur

```bash
docker compose up -d --build
```

Le conteneur écoute uniquement sur `127.0.0.1:8080` — il n'est pas
accessible depuis Internet directement, seul le Nginx système (étape
suivante) peut l'atteindre.

Vérifier qu'il est en bonne santé :
```bash
docker compose ps   # STATUS doit afficher "healthy" après ~30s
```

## Étape 5 — Configurer le Nginx système en reverse proxy

```bash
sudo cp /var/www/seiki-crm/nginx/seiki-crm.conf /etc/nginx/sites-available/seiki-crm
sudo ln -sf /etc/nginx/sites-available/seiki-crm /etc/nginx/sites-enabled/seiki-crm
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

Le site est maintenant accessible sur `http://seikicrm.h.minet.net` (ou
l'IP de la VM, si le DNS n'est pas encore configuré).

### HTTPS (une fois le domaine pointé vers cette VM)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seikicrm.h.minet.net
```

## Étape 6 — Déploiements suivants

Chaque fois que du code est poussé sur `main` :

```bash
cd /var/www/seiki-crm
./deploy.sh
```

Voir [`deploy.sh`](deploy.sh) — il fait `git pull` puis reconstruit et
relance le conteneur. Le Nginx système n'a besoin d'être touché que si
`nginx/seiki-crm.conf` change (nouveau domaine, etc.), auquel cas il faut
refaire l'étape 5.

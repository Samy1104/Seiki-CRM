# Spécification technique : Hébergement de Seiki-CRM sur VM Debian 13 (MiNET Hosting)

Ce document décrit l'architecture et les étapes de déploiement de l'application **Seiki-CRM** sur une machine virtuelle (VM) Debian 13 hébergée sur la plateforme Hosting de l'association MiNET.

## Architecture cible
* **Frontend :** Client React (v19) / Vite (v8) compilé de manière statique.
* **Serveur Web :** Nginx servant les fichiers statiques depuis le répertoire `/var/www/seiki-crm/dist`.
* **Routage :** Redirection SPA (`try_files` dans Nginx) pour supporter React Router côté client.
* **Backend & Base de données :** Supabase Cloud (supabase.com), requêté en HTTPS direct depuis le navigateur des clients via les clés publiques injectées au build.
* **Déploiement :** Script bash local (`deploy.sh`) effectuant un `git pull`, `npm install` et `npm run build` directement sur la VM (qui dispose de 2 vCPUs, 3 Go de RAM et 10 Go de stockage).

---

## 1. Installation des prérequis système
Nous allons installer les paquets système nécessaires sur Debian 13.

### Commandes à exécuter :
```bash
# Mise à jour des listes de paquets
sudo apt update

# Installation de Git et Curl (outils de base)
sudo apt install -y git curl

# Installation du dépôt officiel NodeSource pour Node.js 20 LTS (Debian 13)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installation de Nginx
sudo apt install -y nginx
```

---

## 2. Clonage et configuration du projet
Nous allons cloner le projet, accorder les permissions et configurer les clés Supabase.

### Commandes à exécuter :
```bash
# Création du répertoire parent et attribution des droits à l'utilisateur actuel (samy1104)
sudo mkdir -p /var/www/seiki-crm
sudo chown -R samy1104:samy1104 /var/www

# Clonage du projet
git clone https://github.com/Samy1104/Seiki-CRM.git /var/www/seiki-crm
```

### Configuration des variables d'environnement :
Créer le fichier `/var/www/seiki-crm/.env.local` et y insérer les variables suivantes :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-publique-ici
```

---

## 3. Configuration du serveur Nginx
Configuration d'un hôte virtuel (Virtual Host) Nginx pour servir le dossier `dist/` et configurer le routage SPA.

### Fichier à créer : `/etc/nginx/sites-available/seiki-crm`
```nginx
server {
    listen 80;
    listen [::]:80;

    server_name _; # Remplacez par votre domaine ou sous-domaine si disponible

    root /var/www/seiki-crm/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Optimisation du cache pour les fichiers statiques de Vite (compilés avec hash de version)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }

    # Sécurité basique
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
}
```

### Commandes pour activer la configuration :
```bash
# Activer le site dans Nginx
sudo ln -sf /etc/nginx/sites-available/seiki-crm /etc/nginx/sites-enabled/seiki-crm

# Désactiver le site par défaut s'il interfère
sudo rm -f /etc/nginx/sites-enabled/default

# Tester la configuration Nginx
sudo nginx -t

# Recharger Nginx pour appliquer les modifications
sudo systemctl reload nginx
```

---

## 4. Script d'automatisation des mises à jour (`deploy.sh`)
Création d'un script simple à la racine pour automatiser le cycle de mise à jour.

### Fichier à créer : `/var/www/seiki-crm/deploy.sh`
```bash
#!/bin/bash
set -e

echo "=== DÉBUT DU DÉPLOIEMENT DE SEIKI-CRM ==="
cd /var/www/seiki-crm

echo "1. Récupération des dernières modifications..."
git pull origin main

echo "2. Installation des dépendances npm..."
npm install

echo "3. Compilation de l'application..."
npm run build

echo "=== DÉPLOIEMENT TERMINÉ AVEC SUCCÈS ! ==="
```

### Rendre le script exécutable :
```bash
chmod +x /var/www/seiki-crm/deploy.sh
```

---

## 5. Plan de vérification
* **Build :** S'assurer que `npm run build` se termine sans erreur.
* **Service :** Valider que Nginx écoute bien sur le port 80 (`sudo ss -tulpn | grep nginx`).
* **Accès web :** Ouvrir l'IP de la VM ou le domaine fourni par MiNET Hosting dans un navigateur et tester la navigation.
* **Supabase :** Tester l'authentification ou les requêtes de données pour s'assurer que le fichier `.env.local` a correctement été pris en compte lors de la compilation.

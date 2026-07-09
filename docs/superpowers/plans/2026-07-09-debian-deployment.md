# Plan d'implémentation : Déploiement de Seiki-CRM sur Debian 13

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurer le projet en local avec les scripts et configurations de déploiement nécessaires, les versionner, puis guider l'utilisateur pas à pas pour l'installation finale sur sa VM Debian 13.

**Architecture:** 
1. Préparation locale : création de `deploy.sh` et d'une configuration Nginx versionnée.
2. Préparation serveur : installation des outils sur la VM, clonage et application de la configuration.
3. Mise en ligne et vérification.

**Tech Stack:** Debian 13, Nginx, Node.js v20, Git, Bash.

## Global Constraints
- Fichiers locaux à stocker à la racine du dépôt local.
- Version Node.js cible : v20 LTS.
- Chemin sur la VM : `/var/www/seiki-crm`.

---

### Task 1 : Création du script de déploiement et de la configuration Nginx en local

**Files:**
- Create: `deploy.sh` (à la racine)
- Create: `nginx/seiki-crm.conf`
- Create: `DEPLOY_VM.md` (un guide pas à pas simplifié pour l'utilisateur sur la VM)

**Interfaces:**
- Consumes: Rien.
- Produces: Fichiers de déploiement prêts à être commités.

- [ ] **Step 1: Créer le fichier `deploy.sh` à la racine**
  Créer le fichier local `d:\Stage\SEIKI\Projet\deploy.sh` avec le contenu suivant :
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

- [ ] **Step 2: Créer le dossier `nginx/` et le fichier de configuration Nginx**
  Créer le dossier `d:\Stage\SEIKI\Projet\nginx` et le fichier `nginx/seiki-crm.conf` avec le contenu suivant :
  ```nginx
  server {
      listen 80;
      listen [::]:80;

      server_name _;

      root /var/www/seiki-crm/dist;
      index index.html;

      location / {
          try_files $uri $uri/ /index.html;
      }

      location /assets/ {
          expires 1y;
          add_header Cache-Control "public, no-transform";
      }

      add_header X-Frame-Options "SAMEORIGIN";
      add_header X-XSS-Protection "1; mode=block";
      add_header X-Content-Type-Options "nosniff";
  }
  ```

- [ ] **Step 3: Créer le fichier `DEPLOY_VM.md` à la racine**
  Créer un guide simple `d:\Stage\SEIKI\Projet\DEPLOY_VM.md` avec toutes les commandes à copier-coller sur le terminal Debian.
  Contenu :
  ```markdown
  # Guide de Déploiement Seiki-CRM sur Debian 13

  Exécutez ces commandes dans l'ordre sur la console de votre VM.

  ## Étape 1 : Mettre à jour et installer les prérequis
  ```bash
  # 1. Mise à jour de la VM
  sudo apt update && sudo apt upgrade -y

  # 2. Installation de Git et Curl
  sudo apt install -y git curl

  # 3. Installation de Node.js 20 LTS via le dépôt NodeSource
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs

  # 4. Installation de Nginx
  sudo apt install -y nginx
  ```

  ## Étape 2 : Préparer le dossier et cloner le projet
  ```bash
  # 1. Créer le dossier et attribuer les droits
  sudo mkdir -p /var/www/seiki-crm
  sudo chown -R samy1104:samy1104 /var/www

  # 2. Cloner le dépôt Git
  git clone https://github.com/Samy1104/Seiki-CRM.git /var/www/seiki-crm
  ```

  ## Étape 3 : Configurer l'environnement de production
  Créez le fichier de variables d'environnement :
  ```bash
  nano /var/www/seiki-crm/.env.local
  ```
  Collez-y les clés Supabase :
  ```env
  VITE_SUPABASE_URL=https://votre-projet.supabase.co
  VITE_SUPABASE_ANON_KEY=votre-cle-anon-publique-ici
  ```
  *(Quittez nano avec `Ctrl+O`, `Entrée`, puis `Ctrl+X`)*

  ## Étape 4 : Configurer Nginx
  Copiez la configuration configurée depuis le dépôt Git vers Nginx :
  ```bash
  # Copier le fichier de configuration
  sudo cp /var/www/seiki-crm/nginx/seiki-crm.conf /etc/nginx/sites-available/seiki-crm

  # Activer le site dans Nginx
  sudo ln -sf /etc/nginx/sites-available/seiki-crm /etc/nginx/sites-enabled/seiki-crm

  # Désactiver le site par défaut de Nginx
  sudo rm -f /etc/nginx/sites-enabled/default

  # Tester et recharger Nginx
  sudo nginx -t
  sudo systemctl reload nginx
  ```

  ## Étape 5 : Premier Build et Lancement
  ```bash
  # Rendre le script de déploiement exécutable
  chmod +x /var/www/seiki-crm/deploy.sh

  # Lancer le build initial
  cd /var/www/seiki-crm
  ./deploy.sh
  ```
  ```

- [ ] **Step 4: Commiter et pousser les modifications sur GitHub**
  Comptabiliser les nouveaux fichiers locaux et faire un commit/push pour qu'ils soient disponibles en ligne.

---

### Task 2 : Exécution et Accompagnement de l'utilisateur

**Files:**
- Modify: Aucun fichier local (cette tâche est le suivi de l'exécution sur la VM).

**Interfaces:**
- Consumes: Fichiers poussés à la tâche 1.
- Produces: Site en ligne et fonctionnel.

- [ ] **Step 1: Inviter l'utilisateur à exécuter l'Étape 1 sur sa VM**
  Fournir les commandes de l'Étape 1 et attendre la confirmation de l'installation des paquets.

- [ ] **Step 2: Inviter l'utilisateur à exécuter l'Étape 2 (Clonage)**
  Guider pour le clonage et s'assurer que Git récupère bien les fichiers.

- [ ] **Step 3: Inviter l'utilisateur à configurer le `.env.local`**
  Rappeler la création de `.env.local` et la saisie des clés Supabase.

- [ ] **Step 4: Inviter l'utilisateur à copier la config Nginx et à faire le premier build**
  Guider pour l'application de la config Nginx, la suppression du site `default`, et le lancement final de `./deploy.sh`.

- [ ] **Step 5: Vérifier le bon fonctionnement**
  Valider que le site répond sur le port 80.

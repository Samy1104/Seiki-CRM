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

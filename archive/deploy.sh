#!/bin/bash
set -e

echo "=== DÉBUT DU DÉPLOIEMENT DE SEIKI-CRM ==="
cd /var/www/seiki-crm

echo "1. Récupération des dernières modifications..."
git pull origin main

echo "2. Installation des dépendances npm..."
npm ci

echo "3. Compilation de l'application..."
npm run build

echo "=== DÉPLOIEMENT TERMINÉ AVEC SUCCÈS ! ==="

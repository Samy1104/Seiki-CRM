#!/bin/bash
set -e

echo "=== DEPLOIEMENT DE SEIKI-CRM (Docker) ==="
cd /var/www/seiki-crm

echo "1. Recuperation des dernieres modifications..."
git pull origin main

echo "2. Construction et relance du conteneur..."
docker compose up -d --build

echo "3. Nettoyage des anciennes images inutilisees..."
docker image prune -f

echo "=== DEPLOIEMENT TERMINE AVEC SUCCES ! ==="
docker compose ps

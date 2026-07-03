# Seiki CRM

Un client CRM moderne développé en React, TypeScript et Vite, connecté à Supabase.

## Prérequis

- [Node.js](https://nodejs.org/) (version 18 ou supérieure recommandée)
- Un projet [Supabase](https://supabase.com/) configuré

## Démarrage rapide

### 1. Cloner le projet
```bash
git clone https://github.com/Samy1104/Seiki-CRM.git
cd Seiki-CRM
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer l'environnement
Créez un fichier `.env.local` à la racine du projet et ajoutez vos identifiants Supabase :
```env
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_publique_ou_service_role
```

### 4. Lancer le serveur de développement
```bash
npm run dev
```
L'application sera accessible par défaut sur `http://localhost:5173`.

## Commandes disponibles

- `npm run dev` : Démarre le serveur de développement local avec HMR.
- `npm run build` : Compile le projet pour la production dans le dossier `dist/`.
- `npm run lint` : Analyse et valide le code avec Oxlint.
- `npm run preview` : Lance un serveur local pour prévisualiser la version de production.

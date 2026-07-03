# Seiki CRM — STATE.md

> Mémoire persistante du projet — mis à jour après chaque phase

## Statut global

- **Milestone** : M1 — Consolidation & Features Manquantes
- **Phase courante** : Aucune (projet initialisé)
- **Prochaine action** : `/gsd-plan-phase 1`

## Phases

| Phase | Titre | Statut |
|---|---|---|
| 1 | Fiche Lead Détaillée | 🔜 À planifier |
| 2 | Module Séquences | 🔜 À planifier |
| 3 | Envoi Email SMTP | 🔜 À planifier |
| 4 | Réception IMAP & Boîte Unifiée | 🔜 À planifier |
| 5 | Déduplication & Fusion | 🔜 À planifier |
| 6 | Pipeline SLA & Filtres Avancés | 🔜 À planifier |
| 7 | UX Polish | 🔜 À planifier |
| 8 | Tests & CI/CD | 🔜 À planifier |
| 9 | Scoring ICP IA (optionnel) | 🔜 À planifier |

## Décisions techniques

- Navigation par state React (`currentView`) — pas de React Router. À reconsidérer si > 10 vues.
- RLS Supabase : politique `authenticated_full_access` sur toutes les tables → suffisant pour M1 en équipe restreinte.
- Pas d'Edge Functions déployées pour l'instant → nécessaires en Phase 3 & 4.
- Linter : Oxlint (très rapide, pas ESLint). Configs dans `.oxlintrc.json`.

## Notes & contexte

- Projet de stage (Samy). Dépôt GitHub : `Samy1104/Seiki-CRM`.
- Langue de l'interface : Français.
- Le schéma DB est versionné dans `schema_supabase.sql` (v1.0 — 2026-07-02).
- `.env.local` contient `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (non versionné).
- `ToastContext` existe déjà — à utiliser pour toutes les notifications UX.
- Aucun router SPA : navigation par `setView()` propagée via props.

## Dernières modifications

| Date | Auteur | Description |
|---|---|---|
| 2026-07-03 | Antigravity | Initialisation du projet GSD — création .planning/ |

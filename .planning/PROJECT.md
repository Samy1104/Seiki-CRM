# Seiki CRM — PROJECT.md

> Dernière mise à jour : 2026-07-03

## Vision

Seiki CRM est un outil de gestion commerciale sur-mesure, développé en interne pour l'équipe Seiki. Il centralise le pipeline de prospection, la gestion des leads, les tâches, l'agenda et les statistiques dans une interface web moderne et responsive.

## Contexte

- **Équipe** : Start-up / PME — équipe commerciale restreinte (≤ 10 personnes)
- **Stack** : React 19 + TypeScript + Vite + Supabase (PostgreSQL + Auth + RLS)
- **Design** : SPA mono-page avec sidebar de navigation, thème sombre / glassmorphisme
- **Hébergement** : Client web, BDD Supabase cloud

## Fonctionnalités existantes (v0.1 — baseline)

| Module | Statut | Description |
|---|---|---|
| Auth | ✅ Opérationnel | Login via Supabase Auth |
| Pipeline | ✅ Opérationnel | Kanban drag-and-drop par étapes |
| Leads | ✅ Opérationnel | Liste + filtres + scoring ICP |
| Add Lead | ✅ Opérationnel | Formulaire d'ajout de lead |
| Tasks | ✅ Opérationnel | Vue liste et tableau (style ClickUp) |
| Agenda | ✅ Opérationnel | Calendrier d'événements réseau |
| Stats | ✅ Opérationnel | Tableau de bord analytique |
| Codir | ✅ Opérationnel | Vue dirigeants / reporting |
| Settings | ✅ Opérationnel | Paramétrage pipeline, membres, SLA |
| Email | 🚧 Partiel | Générateur de mails (composant EmailGenerator) |
| Sequences | 📋 Schéma DB | Table séquences créée, UI non connectée |
| IMAP/SMTP | 📋 Schéma DB | Table email_accounts créée, pas d'intégration |

## Base de données (Supabase PostgreSQL)

**14 tables** couvrant :
- `users` — Profils CRM (liés à auth.users)
- `team_members` — Membres assignables
- `app_settings` — Paramètres globaux (SLA, scoring, entreprise)
- `pipeline_stages` — Étapes pipeline personnalisables
- `leads` — Table centrale des prospects (scoring ICP, séquence, SLA)
- `lead_scores` — Scoring détaillé par critère (6 critères ICP)
- `tasks` + `task_assignees` — Tâches multi-assignées
- `events` — Agenda réseau
- `history` — Timeline d'activité par lead
- `sequences` + `sequence_steps` — Automatisation multicanale
- `email_accounts` — Config SMTP/IMAP
- `email_logs` — Logs emails complets
- `lead_merge_proposals` — Déduplication

## Services frontend

- `supabaseClient.ts` — Instance Supabase
- `leadsService.ts` — CRUD leads (le plus complet)
- `tasksService.ts` — CRUD tâches
- `eventsService.ts` — CRUD événements
- `settingsService.ts` — Lecture/écriture paramètres

## Contraintes techniques

- TypeScript strict, linter Oxlint
- Pas de router SPA (navigation par state `currentView`)
- RLS activé sur toutes les tables (politique `authenticated_full_access`)
- Toutes les dates en `TIMESTAMPTZ`
- `updated_at` géré par triggers DB

## Objectifs Milestone 1

Consolider le CRM existant, connecter les modules incomplets (séquences, email), améliorer l'UX et préparer le déploiement.

## Équipe / Ownership

- Développeur principal : Samy (stagiaire)
- Dépôt : `Samy1104/Seiki-CRM` (GitHub)

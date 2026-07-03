# Seiki CRM — REQUIREMENTS.md

> Milestone 1 — Consolidation & Features Manquantes
> Version : 1.0 | Date : 2026-07-03

---

## Objectifs du Milestone

Rendre le CRM pleinement opérationnel pour une utilisation quotidienne en équipe commerciale :
1. Connecter les modules partiellement développés (séquences, email)
2. Améliorer la robustesse et la cohérence UX
3. Finaliser l'intégration email (SMTP/IMAP)
4. Préparer pour le déploiement et la mise en production

---

## REQ-01 — Module Séquences (UI)

**Priorité** : Haute  
**Contexte** : La table `sequences` et `sequence_steps` existent en base mais aucune UI n'est connectée.

### Critères d'acceptation
- [ ] Vue liste des séquences (nom, nombre d'étapes, statut actif/inactif)
- [ ] Créer / éditer / supprimer une séquence
- [ ] Ajouter des étapes : `send_email`, `create_task`, `wait`, `linkedin_connect`
- [ ] Assigner une séquence à un lead depuis la fiche lead
- [ ] Suivi du statut de séquence par lead (`idle`, `active`, `paused`, `completed`, `replied`)
- [ ] Vue "Séquence en cours" sur la fiche lead avec avancement des étapes

---

## REQ-02 — Intégration Email (SMTP/IMAP)

**Priorité** : Haute  
**Contexte** : Le composant `EmailGenerator.tsx` génère des emails mais ne les envoie pas. Les tables `email_accounts` et `email_logs` sont prêtes.

### Critères d'acceptation
- [ ] Formulaire de configuration compte SMTP/IMAP dans Paramètres
- [ ] Envoi d'email depuis le générateur (via backend Supabase Edge Function ou API relay)
- [ ] Récupération IMAP des réponses (polling ou webhook)
- [ ] Boîte unifiée : liste des emails envoyés/reçus par lead dans `history`
- [ ] Tracking ouverture email (pixel de tracking ou header)
- [ ] Mise à jour automatique du statut séquence à la réception d'une réponse

---

## REQ-03 — Fiche Lead Détaillée

**Priorité** : Haute  
**Contexte** : Il n'existe pas de vue de détail lead — tout est dans la liste ou le pipeline.

### Critères d'acceptation
- [ ] Modale ou page de détail lead : infos complètes + scoring ICP
- [ ] Timeline `history` chronologique par lead
- [ ] Édition inline des champs (email, téléphone, note, score)
- [ ] Bouton "Démarrer séquence" depuis la fiche
- [ ] Bouton "Fusionner" pour les doublons (`lead_merge_proposals`)

---

## REQ-04 — Déduplication (Lead Merge)

**Priorité** : Moyenne  
**Contexte** : La table `lead_merge_proposals` est créée mais sans logique de détection ni UI.

### Critères d'acceptation
- [ ] Détection automatique de doublons à l'ajout d'un lead (domain + nom similaire)
- [ ] Notification dans l'interface si doublons détectés
- [ ] Vue dédiée dans Paramètres pour approuver / rejeter les fusions
- [ ] Fusion effective : copie de l'historique + archivage du lead source

---

## REQ-05 — Amélioration Pipeline & SLA

**Priorité** : Moyenne  

### Critères d'acceptation
- [ ] Indicateur visuel SLA dépassé sur les cartes kanban (couleur alerte)
- [ ] Calcul automatique de `days_in_stage` via cron ou trigger DB
- [ ] Filtre pipeline par segment, assigné, SLA dépassé
- [ ] Colonne "Propositions envoyées" avec montant total

---

## REQ-06 — Scoring ICP Automatique (IA)

**Priorité** : Basse  
**Contexte** : Le flag `scoring_auto` existe dans `app_settings`. La colonne `scored_by` dans `lead_scores` supporte `ai_auto`.

### Critères d'acceptation
- [ ] Activation du scoring IA depuis Paramètres
- [ ] Appel à un LLM (Gemini / Claude) avec les données du lead pour scorer les 6 critères ICP
- [ ] Affichage de la source du score (manuel vs IA)
- [ ] Possibilité de corriger le score IA manuellement

---

## REQ-07 — UX / Design

**Priorité** : Moyenne  

### Critères d'acceptation
- [ ] Skeleton loaders sur toutes les vues (remplacer spinners bruts)
- [ ] Toast notifications cohérentes (succès, erreur, info)
- [ ] Responsive mobile basique (sidebar repliable)
- [ ] Raccourcis clavier : `N` = nouveau lead, `T` = nouvelle tâche, `Esc` = fermer modale
- [ ] Page 404 / état vide sur chaque vue

---

## REQ-08 — Tests & Qualité

**Priorité** : Moyenne  

### Critères d'acceptation
- [ ] Tests unitaires sur les services (leadsService, tasksService)
- [ ] Tests d'intégration Supabase sur les opérations CRUD critiques
- [ ] CI GitHub Actions : lint (Oxlint) + build TypeScript à chaque PR
- [ ] Zéro erreur TypeScript strict

---

## Hors scope Milestone 1

- Application mobile native
- Multi-tenant (plusieurs entreprises)
- Extension Chrome pour import LinkedIn
- Synchro calendrier (iCal export)
- Facturation / CRM financier complet

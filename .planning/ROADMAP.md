# Seiki CRM — ROADMAP.md

> Milestone 1 — Consolidation & Features Manquantes
> Version : 1.0 | Date : 2026-07-03

---

## Structure des phases

```
Phase 1  → Fiche Lead Détaillée (modale + timeline)
Phase 2  → Module Séquences (UI complète)
Phase 3  → Intégration Email SMTP (envoi)
Phase 4  → Intégration IMAP (réception & boîte unifiée)
Phase 5  → Déduplication & Fusion de Leads
Phase 6  → Pipeline SLA & Filtres avancés
Phase 7  → UX Polish (skeletons, responsive, raccourcis)
Phase 8  → Tests & CI/CD
Phase 9  → Scoring ICP IA (optionnel)
```

---

## Phase 1 — Fiche Lead Détaillée

**Refs** : REQ-03  
**Complexité** : Moyenne  
**Dépendances** : Aucune

### Livraisons
- Modale de détail lead (`LeadDetail.tsx`)
- Section infos + édition inline
- Section scoring ICP (6 critères visuels)
- Timeline historique (`history`)
- Boutons d'action rapide (séquence, fusion, archiver)

### UAT
- [ ] Cliquer un lead dans Pipeline ouvre la modale
- [ ] Modifier un champ et sauvegarder → DB mise à jour
- [ ] Timeline affiche les entrées `history` par ordre chronologique
- [ ] Archiver un lead → disparaît du pipeline

---

## Phase 2 — Module Séquences

**Refs** : REQ-01  
**Complexité** : Haute  
**Dépendances** : Phase 1 (bouton "Démarrer séquence" dans fiche)

### Livraisons
- Vue `Sequences.tsx` dans la sidebar
- CRUD séquences + étapes
- Service `sequencesService.ts`
- Assignation séquence → lead
- Affichage statut séquence sur fiche lead

### UAT
- [ ] Créer une séquence avec 3 étapes → sauvegardée en DB
- [ ] Assigner la séquence à un lead → `sequence_id` + `sequence_status = active`
- [ ] Vue détail lead affiche les étapes avec leur statut

---

## Phase 3 — Envoi Email (SMTP)

**Refs** : REQ-02  
**Complexité** : Haute  
**Dépendances** : Phase 2

### Livraisons
- Formulaire config SMTP dans `Settings.tsx`
- Supabase Edge Function `send-email`
- Intégration avec `EmailGenerator.tsx` (bouton "Envoyer")
- Log dans `email_logs` à chaque envoi

### UAT
- [ ] Configurer compte SMTP dans Paramètres → test de connexion OK
- [ ] Générer un email depuis fiche lead → bouton Envoyer → email reçu
- [ ] Email loggué dans `email_logs` avec statut `sent`
- [ ] Entrée créée dans `history` (action_type = `email_sent`)

---

## Phase 4 — Réception IMAP & Boîte Unifiée

**Refs** : REQ-02  
**Complexité** : Très haute  
**Dépendances** : Phase 3

### Livraisons
- Supabase Edge Function `imap-sync` (polling IMAP)
- Matching réponse → lead par `In-Reply-To`
- Vue "Boîte Unifiée" dans la sidebar
- Mise à jour statut séquence à la réception d'une réponse

### UAT
- [ ] Envoyer un email → répondre → la réponse apparaît dans l'historique du lead
- [ ] Statut séquence passe à `replied` automatiquement
- [ ] Boîte unifiée liste tous les échanges récents

---

## Phase 5 — Déduplication & Fusion

**Refs** : REQ-04  
**Complexité** : Moyenne  
**Dépendances** : Phase 1

### Livraisons
- Détection doublons à l'ajout de lead (domain match)
- Notification dans l'UI si doublon potentiel
- Vue "Doublons" dans Paramètres
- Service `mergeService.ts` (fusion + archivage)

### UAT
- [ ] Ajouter un lead avec même domaine qu'un existant → alerte affichée
- [ ] Approuver une fusion → historique copié, lead source archivé
- [ ] Rejeter une fusion → proposition marquée `rejected`

---

## Phase 6 — Pipeline SLA & Filtres Avancés

**Refs** : REQ-05  
**Complexité** : Faible  
**Dépendances** : Aucune

### Livraisons
- Indicateur visuel SLA sur cartes kanban
- Calcul `days_in_stage` via Supabase scheduled trigger ou cron Edge Function
- Filtres pipeline : segment, assigné, SLA dépassé, valeur deal

### UAT
- [ ] Lead en SLA dépassé → bordure rouge sur la carte
- [ ] Filtre "SLA dépassé" dans Pipeline → affiche uniquement ces leads
- [ ] `days_in_stage` incrémenté chaque jour automatiquement

---

## Phase 7 — UX Polish

**Refs** : REQ-07  
**Complexité** : Faible  
**Dépendances** : Phases 1-6

### Livraisons
- Skeleton loaders sur toutes les vues (leads, pipeline, tasks, agenda)
- Toast système unifié via `ToastContext`
- Sidebar repliable (responsive mobile)
- Raccourcis clavier globaux
- Pages d'état vide sur chaque vue

### UAT
- [ ] Recharger une vue → skeletons affichés pendant le fetch
- [ ] Créer un lead → toast "Lead créé avec succès"
- [ ] Appuyer `N` depuis n'importe où → ouvre "Ajouter Lead"
- [ ] Sidebar se replie sur écran < 768px

---

## Phase 8 — Tests & CI/CD

**Refs** : REQ-08  
**Complexité** : Moyenne  
**Dépendances** : Toutes

### Livraisons
- Tests unitaires Vitest sur tous les services
- Tests d'intégration (mocks Supabase)
- GitHub Actions : lint + build + tests à chaque PR
- Zéro erreur TypeScript strict

### UAT
- [ ] `npm run test` → tous les tests passent
- [ ] PR créée → GitHub Actions CI passe au vert
- [ ] `npm run build` → zéro erreur TypeScript

---

## Phase 9 — Scoring ICP IA (Optionnel)

**Refs** : REQ-06  
**Complexité** : Haute  
**Dépendances** : Phase 1, Phase 3

### Livraisons
- Toggle "Scoring IA" dans Paramètres
- Edge Function `score-lead-ai` (appel LLM)
- Affichage source du score (manuel vs IA)
- Correction manuelle après scoring IA

### UAT
- [ ] Activer scoring IA → ajouter lead → score calculé automatiquement
- [ ] Source affichée = "IA automatique" sur la fiche lead
- [ ] Modifier score manuellement → source passe à "Manuel"

---

## Backlog / Hors scope M1

- 999.1 — Extension Chrome pour import LinkedIn
- 999.2 — Export iCal agenda
- 999.3 — Multi-tenant (plusieurs espaces de travail)
- 999.4 — Application mobile native

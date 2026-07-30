# Design Spec : Dashboard CODIR v2 — Snapshot, Cohortes & Drill-Down

**Date** : 2026-07-30
**Statut** : En attente de revue
**Auteur** : Claude & User

---

## 1. Contexte & Objectif

Le Dashboard actuel (`src/views/Dashboard.tsx` + 4 onglets) est fonctionnel et visuellement abouti, mais ne répond pas au besoin exprimé dans `specifications_dashboard_crm_codir.md` : piloter le CODIR avec (1) une photo instantanée du pipeline comparée au dernier CODIR et (2) une analyse de cohortes mensuelles montrant la vitesse de progression des leads dans le pipeline.

Un audit du code existant (voir historique de conversation) a identifié un bug bloquant et plusieurs écarts de modèle de données qui doivent être corrigés avant que ces nouvelles vues puissent être fiables :

- **Bug** : le drag-and-drop du Kanban (`Pipeline.tsx:233`) change `stage_id` sans jamais écrire de ligne d'historique. Seule l'édition via `LeadDetailModal.tsx` logue un `action_type: 'stage_change'`. La quasi-totalité des changements d'étape réels ne sont donc pas tracés aujourd'hui.
- **Écart de modèle** : la table `history` est générique (texte libre), sans `from_stage_id`/`to_stage_id` structurés — impossible à interroger pour reconstruire un état passé du pipeline.
- **Écart de modèle** : `codir_history` est un tableau de dates dans un blob JSON (`app_settings`), pas une table avec identifiant stable.
- **Absent** : aucun flag `is_disqualified` sur les leads.

Ce document spécifie le v2 du Dashboard : ce qui est reconstruit, ce qui est conservé tel quel, et le nouveau modèle de données qui rend tout cela fiable.

---

## 2. Modèle de Données

### 2.1 Nouveau script `archive/schema_dashboard_v2_addon.sql`

Appliqué à la main dans Supabase > SQL Editor, comme les scripts `schema_*_addon.sql` existants.

```sql
-- Historique structuré des transitions d'étape
CREATE TABLE IF NOT EXISTS public.lead_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    from_stage_id UUID NULL REFERENCES public.pipeline_stages(id),
    to_stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead ON public.lead_stage_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_to_stage ON public.lead_stage_history(to_stage_id);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_changed_at ON public.lead_stage_history(changed_at);

-- Trigger DB-level : capture TOUT changement de stage_id, quel que soit le chemin applicatif
-- (Kanban drag-and-drop, LeadDetailModal, imports en masse, futurs endpoints)
CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id)
     OR (TG_OP = 'INSERT' AND NEW.stage_id IS NOT NULL) THEN
    INSERT INTO public.lead_stage_history (lead_id, from_stage_id, to_stage_id, changed_at)
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage_id ELSE NULL END,
      NEW.stage_id,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_lead_stage_change ON public.leads;
CREATE TRIGGER trg_log_lead_stage_change
  AFTER INSERT OR UPDATE OF stage_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_lead_stage_change();

-- Table dédiée pour les réunions CODIR (remplace le blob JSON app_settings.codir_history)
CREATE TABLE IF NOT EXISTS public.codir_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    label VARCHAR(255) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Migration des dates existantes depuis app_settings.codir_history vers codir_meetings
INSERT INTO public.codir_meetings (meeting_date, label)
SELECT (d)::timestamptz, 'Migré depuis app_settings'
FROM public.app_settings, LATERAL jsonb_array_elements_text(value->'dates') AS d
WHERE key = 'codir_history'
ON CONFLICT DO NOTHING;

-- Flag de disqualification, indépendant de l'étape pipeline
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_disqualified BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.is_disqualified IS 'Exclut le lead de tous les calculs analytiques (cohortes, volumes, conversions) sans le mélanger avec Perdu';
```

### 2.2 Limite de backfill (à documenter, pas à contourner)

Les transitions d'étape antérieures à l'application de ce script ne sont pas reconstructibles avec exactitude — le trigger ne peut pas capturer rétroactivement ce qui n'a jamais été loggé. Conséquences assumées :

- La **Vue Cohorte** et les **deltas par étape** ne seront fiables qu'à partir de la date de déploiement. Les cohortes antérieures afficheront des données partielles ou nulles ; l'UI doit le signaler (badge "Historique partiel" sur les cohortes dont le mois de création précède le déploiement).
- Exception : pour les leads déjà en étape `Gagné` au moment du déploiement, `leads.stage_changed_at` correspond exactement à leur date de passage en Gagné (puisque c'est leur étape actuelle). Le calcul de **Vélocité** peut donc utiliser `stage_changed_at` comme fallback pour les deals gagnés historiques, et `lead_stage_history` pour tout ce qui est capturé après déploiement.

### 2.3 Services à mettre à jour

- `settingsService.getCodirHistory()` / `addCodirDate()` : requêtent `codir_meetings` au lieu de `app_settings`. Signature élargie pour retourner `{ id, meeting_date, label }[]` plutôt que `string[]` (nécessaire pour le drill-down et le label optionnel).
- Nouveau `pipelineHistoryService.ts` : encapsule les requêtes sur `lead_stage_history` (reconstruction d'état à une date T, comptage de transitions vers une étape sur une période, cohortes).
- `leadsService.getLeads()` exclut `is_disqualified = true` par défaut dans tout contexte analytique (nouveau paramètre `includeDisqualified` sur les fonctions de stats, défaut `false`).

---

## 3. Header & Modèle de Période

Remplace `DashboardHeader.tsx` actuel (double sélecteur A/B) par un sélecteur unique + presets, appliqué à tous les onglets.

### 3.1 Presets et fenêtre de comparaison implicite

| Preset | Fenêtre actuelle (A) | Fenêtre de comparaison (B), calculée automatiquement |
|---|---|---|
| Depuis dernier CODIR (défaut) | `[dernier codir_meetings.meeting_date, now]` | `[avant-dernier meeting_date, dernier meeting_date]` |
| Entre les 2 derniers CODIR | `[avant-dernier meeting_date, dernier meeting_date]` | `[avant-avant-dernier, avant-dernier]` |
| Mois en cours | `[1er du mois, now]` | Mois précédent, même nombre de jours écoulés |
| Trimestre en cours | `[1er du trimestre, now]` | Trimestre précédent |
| Année en cours | `[1er janvier, now]` | Année précédente |
| Personnalisée | `[start, end]` choisis | `[start - (end-start), start]` (fenêtre équivalente immédiatement précédente) |

Ce calcul remplace les props `leadsA/leadsB/historyA/historyB/emailLogsA/emailLogsB` actuelles par une paire `{ current, comparison }` dérivée d'un seul état de période — les badges de delta existants (`computeDelta`, `MetricDeltaBadge`, `DeltaBadge`) sont conservés tels quels, seule leur source change.

### 3.2 Bouton "Valider le CODIR du jour"

Ajouté dans le header du Dashboard (à côté du bouton Export CSV existant). Ouvre une modale de confirmation (réutilise `Modal.tsx`), insère dans `codir_meetings` via le `settingsService` mis à jour, rafraîchit la liste de presets. Le point d'entrée existant dans `DashboardTargetsSettings.tsx` est conservé (utile pour corriger une date a posteriori) mais n'est plus le seul chemin.

### 3.3 Ce qui ne change pas

`comparisonMode`, `customDateA/B` et le composant `SegmentedToggle` disparaissent (remplacés par un seul dropdown de presets). Le CSV export (`generateStatsCsv`) et son bouton restent inchangés dans leur position et déclenchement.

---

## 4. Composants

### 4.1 Onglet CODIR — Cartes KPI (redéfinition des calculs, UI inchangée)

| Carte | Calcul actuel | Nouveau calcul |
|---|---|---|
| Nouveaux Leads Entrants | `leads.created_at <= endA` (cumulatif) | `leads.created_at` dans `[startA, endA]` (strictement la période), hors `is_disqualified` |
| CA Signé | `deal_value` des leads `isWon` filtrés par `created_at <= endA` | Inchangé dans sa logique, mais filtré sur la fenêtre de période au lieu de cumulatif |
| Taux de Conversion Global | `won / leads-à-date` | `won parmi les leads créés dans la période / leads créés dans la période` |
| **Vélocité (nouveau)** | — (absent) | `AVG(date_passage_gagné - created_at)` en jours, via `lead_stage_history` (fallback `stage_changed_at` pour l'historique pré-déploiement, cf. §2.2) |

Hot Deals et Alertes SLA (cartes existantes, non spécifiées dans le doc cible mais jugées utiles) sont conservées sans modification.

### 4.2 Onglet Pipeline — "Vue par Statut" (upgrade du funnel existant)

- **Toggle Volume (#) / Valeur (€)** au-dessus du funnel : bascule l'affichage de la barre entre `count` et `totalVal` (actuellement les deux sont toujours affichés côte à côte — le toggle simplifie la lecture en réunion).
- **Delta par étape** : à côté de chaque barre, `{count actuel} ({+/-delta})` où le delta = nombre de leads dans cette étape à la fenêtre de comparaison B, reconstruit via `lead_stage_history` (dernier `to_stage_id` par lead dont `changed_at <= endB`).
- **Checkbox "Masquer les deals fermés"** : exclut les étapes `is_closed_won`/`is_closed_lost` du graphique (contrôle local à ce composant, ne touche pas le filtre de période global).
- Segment/Source breakdown, Valeur Pondérée du Pipeline : conservés tels quels.

### 4.3 Onglet Pipeline — "Vue Cohorte" (nouveau)

- Table/heatmap : lignes = mois de création (`YYYY-MM`, libellé "Mai 2026 · 9 leads"), colonnes = étapes triées par `position`.
- Cellule = % cumulé de la cohorte ayant atteint ou dépassé l'étape (`lead_stage_history` : au moins une transition `to_stage_id` = cette étape ou une étape ultérieure, hors `is_disqualified`).
- Intensité de fond proportionnelle au %, palette ocre foncé (100%) → beige clair (0%), cohérente avec la charte existante (`#D4C4A8` en base).
- Mois en cours affiché avec un badge "En cours" (cohorte incomplète par nature). Mois antérieurs au déploiement du trigger affichés avec badge "Historique partiel" (cf §2.2).
- Composant isolé `CohortHeatmap.tsx` sous `src/views/dashboard/`, consomme `pipelineHistoryService`.

### 4.4 Drill-Down — `Drawer.tsx` (nouveau composant partagé)

- `src/components/ui/Drawer.tsx` : même pattern que `Modal.tsx` (overlay + `AnimatePresence`/`motion`), mais panneau ancré à droite, largeur fixe (`max-w-md` à `max-w-lg`), slide horizontal au lieu de scale/fade centré.
- Déclencheurs : clic sur une barre de la Vue par Statut, une cellule de la Vue Cohorte, ou une carte KPI du CODIR.
- Contenu : titre dynamique (ex. "Leads de la cohorte Mai 2026 ayant atteint l'étape Démo (4 leads)"), liste de leads (raison sociale, montant, étape actuelle, date de création, date du dernier changement, lien `Link to={/leads/${id}}`).
- Chaque déclencheur définit son propre filtre (stage_id / cohort_month / kpi_type) passé au Drawer, qui appelle `pipelineHistoryService.getDrilldownLeads(filter)`.

### 4.5 Onglets Outreach & Tasks

Aucun changement fonctionnel. Ils consomment désormais `{ current, comparison }` fournis par le nouveau header au lieu de `emailLogsA/B` et `startDateA/endDateA` calculés localement dans `Dashboard.tsx` — changement de plomberie uniquement, props renommées mais logique interne intacte.

---

## 5. Nettoyage & Fichiers Impactés

| Fichier | Action |
|---|---|
| `archive/schema_dashboard_v2_addon.sql` | Nouveau |
| `src/services/settingsService.ts` | `getCodirHistory`/`addCodirDate` réécrits sur `codir_meetings` |
| `src/services/pipelineHistoryService.ts` | Nouveau — reconstruction d'état, cohortes, drilldown |
| `src/services/leadsService.ts` | Exclusion `is_disqualified` dans les requêtes analytiques |
| `src/views/dashboard/DashboardHeader.tsx` | Remplacement du double sélecteur A/B par le sélecteur unique + presets + bouton "Valider CODIR" |
| `src/views/Dashboard.tsx` | Calcul `{ current, comparison }` unique au lieu de `leadsA/B` etc. |
| `src/views/dashboard/DashboardCodirTab.tsx` | Nouveaux calculs KPI (§4.1), carte Vélocité ajoutée |
| `src/views/dashboard/DashboardPipelineTab.tsx` | Toggle Volume/Valeur, deltas par étape, checkbox deals fermés |
| `src/views/dashboard/CohortHeatmap.tsx` | Nouveau |
| `src/components/ui/Drawer.tsx` | Nouveau |
| `src/views/dashboard/DashboardOutreachTab.tsx`, `DashboardTasksTab.tsx` | Renommage de props uniquement |
| `src/utils/dashboardCalculations.ts` | Ajout des fonctions de reconstruction d'état / cohortes / vélocité, tests associés |
| `src/views/settings/DashboardTargetsSettings.tsx` | Conservé (édition manuelle des dates CODIR reste possible) |

---

## 6. Plan de Vérification

1. **Trigger DB** : insérer/déplacer un lead via SQL direct et via l'UI Kanban, vérifier une ligne `lead_stage_history` dans les deux cas.
2. **Non-régression Kanban** : drag-and-drop d'un lead entre colonnes continue de fonctionner visuellement (optimistic update) sans erreur réseau.
3. **Deltas par étape** : comparer manuellement le résultat de la reconstruction d'état à `endB` avec un cas connu (créer 2-3 transitions avec dates contrôlées en environnement de test).
4. **Cohortes** : vérifier que le mois en cours porte le badge "En cours" et qu'un mois antérieur au déploiement porte "Historique partiel".
5. **Drilldown** : chaque type de déclencheur (barre, cellule heatmap, carte KPI) ouvre le Drawer avec la liste attendue et un lien fonctionnel vers la fiche lead.
6. **Presets de période** : vérifier la fenêtre de comparaison calculée pour chaque preset (tableau §3.1) sur des cas limites (premier CODIR jamais créé, un seul CODIR existant, changement de mois/trimestre/année en cours de test).
7. **Build & tests** : `npm run build` et `npm test` sans régression, tests unitaires ajoutés pour les nouvelles fonctions de `dashboardCalculations.ts`.
8. **Thème & responsive** : Drawer et heatmap testés en desktop/tablette, cohérents avec la charte sombre/beige existante.

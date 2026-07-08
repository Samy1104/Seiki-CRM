# Refonte Prospection IA — Templates, Fusion de variables, Pipeline auto, File d'envoi

Date : 2026-07-08
Statut : validé par l'utilisateur, prêt pour plan d'implémentation

## Contexte

La page Prospection actuelle (`src/views/Prospection.tsx`) génère un email par lead via un appel à l'Edge Function `generate-email` (Gemini 2.5 Flash), piloté par un `system_prompt`/`tone` défini par campagne. Ce module a été livré comme MVP le 2026-07-06 (voir mémoire `project_prospection_ia_module`).

L'utilisateur veut un fonctionnement différent : des **samples d'email qu'il écrit et édite lui-même**, un par type de prospect (segment), fusionnés automatiquement avec les infos du lead — sans dépendance à un appel IA pour produire le texte. Il veut aussi que dès qu'un lead est créé, son email soit **automatiquement prêt**, avec un choix global entre validation humaine et envoi 100% automatique (y compris l'envoi réel, sans ouvrir l'app), et une gestion de la limite Resend (100 emails/jour) qui étale les envois sur plusieurs jours si besoin.

## Objectifs (in scope)

1. Bibliothèque de templates éditables par segment (Media/Retail/Instit/All) × étape (initial, relance_1, relance_2), avec insertion de variables (`{{contact_name}}`, `{{company_name}}`, `{{poste}}`, `{{custom.<clé>}}`, etc.).
2. Champs personnalisés libres par lead (`custom_fields` JSONB), utilisables comme variables dans les templates.
3. Fusion de variables locale (pas d'appel IA) pour produire le sujet/corps final par lead.
4. Création automatique d'un draft d'email dès l'ajout d'un lead, basé sur son segment.
5. Toggle global **Vérification humaine** ↔ **Automatique** :
   - Humain : draft en attente de relecture/édition/approbation/envoi manuel.
   - Automatique : draft auto-approuvé, planifié selon le quota, et envoyé sans intervention (y compris l'envoi réel, via job planifié serveur).
6. File d'envoi respectant un quota quotidien configurable (défaut 100, limite Resend) avec étalement automatique sur les jours suivants en cas de dépassement.
7. Relances (J+) avec seuils configurables dans Réglages, remplaçant les seuils fixes actuels (5j/10j).
8. Campagnes manuelles conservées pour des pushs ciblés ponctuels, en plus du flux automatique permanent par lead.
9. Rafraîchissement visuel de la page (inspiré des patterns hover.dev : tabs animés, accordion, modal, progress, toggle) adapté à l'identité graphique existante (tokens `--purple`, `--gold`, `--green`, etc.), via Tailwind ajouté au projet et scoppé aux nouveaux composants.

## Hors scope

- Génération de texte par IA (Gemini) : le chemin existant (`generate-email` Edge Function) n'est pas supprimé mais n'est plus appelé par le nouveau flux. Pourrait revenir plus tard comme bouton optionnel "reformuler avec l'IA" — non traité ici.
- Détection automatique du "type" de prospect par un modèle : le "type" est le champ `segment` déjà renseigné à la création du lead ; aucune classification à construire.
- Suppression/migration des colonnes `campaigns.system_prompt`, `campaigns.tone`, `generated_emails.model_used/prompt_used/generation_ms` : elles restent en base, simplement plus lues/écrites par la nouvelle UI (pas de migration destructive).
- Envoi SMS ou autres canaux : email uniquement.

## Modèle de données

### Nouvelle table `email_templates`

```sql
CREATE TABLE public.email_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment     TEXT NOT NULL CHECK (segment IN ('Media', 'Retail', 'Instit', 'All')),
  step        TEXT NOT NULL CHECK (step IN ('initial', 'relance_1', 'relance_2')),
  subject     TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segment, step)
);
```

Un onglet "Templates" permet d'éditer ces 12 combinaisons (4 segments × 3 étapes). Résolution à la lecture : si `email_templates` pour `(segment, step)` n'existe pas ou est vide, fallback sur `(All, step)`.

### `leads.custom_fields`

```sql
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
```

Édité depuis la fiche lead (Leads.tsx / AddLead.tsx) : liste de paires clé/valeur libres, ajoutées/retirées dynamiquement. Utilisées dans un template via `{{custom.<clé>}}`.

### `generated_emails`

```sql
ALTER TABLE public.generated_emails ADD COLUMN IF NOT EXISTS step TEXT NOT NULL DEFAULT 'initial'
  CHECK (step IN ('initial', 'relance_1', 'relance_2'));
```

`scheduled_at` (déjà présent) devient le champ central de la file d'envoi. `statut_envoi` garde ses valeurs existantes (`draft`, `approved`, `sending`, `sent`, `failed`) ; `approved` + `scheduled_at` dans le futur = en file d'attente.

### `app_settings` — nouvelles clés

| key | value | défaut |
|---|---|---|
| `prospection_mode` | `{ mode: 'manual' \| 'auto' }` | `manual` |
| `daily_send_quota` | `{ count: number }` | `100` |
| `followup_1_days` | `{ days: number }` | `5` |
| `followup_2_days` | `{ days: number }` | `10` |
| `archive_after_followups` | `{ count: number }` | `2` |

Gérées dans un nouvel onglet "Prospection" de la page Réglages (même pattern que l'onglet "Règles & SLA" existant).

### Fonctions SQL

**`public.render_template(p_template TEXT, p_lead_id UUID) RETURNS TEXT`**
Remplace `{{contact_name}}`, `{{company_name}}`, `{{poste}}`, `{{segment}}`, `{{custom.<clé>}}` (lookup dans `leads.custom_fields`) par les valeurs réelles du lead. Variable manquante → chaîne vide (pas d'erreur bloquante).

**`public.schedule_send(p_generated_email_id UUID) RETURNS TIMESTAMPTZ`**
Calcule le prochain créneau disponible : compte les emails déjà `sent` aujourd'hui + déjà `approved`/planifiés pour chaque jour à partir d'aujourd'hui, incrémente de jour en jour jusqu'à trouver de la capacité sous `daily_send_quota`, met à jour la ligne (`statut_envoi = 'approved'`, `scheduled_at = <créneau trouvé>`, `approved_at = now()`), retourne le timestamp choisi. Utilisée à la fois par :
- le trigger auto-pipeline (mode automatique),
- l'approbation en masse côté client (mode manuel, bouton "Approuver la sélection").

Centraliser cette logique en SQL évite de la dupliquer en TypeScript.

### Trigger auto-pipeline

```sql
CREATE OR REPLACE FUNCTION public.auto_create_prospection_draft()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_template  RECORD;
  v_mode      TEXT;
  v_new_id    UUID;
BEGIN
  IF NEW.email IS NULL OR NEW.is_archived THEN
    RETURN NEW;
  END IF;

  SELECT subject, body INTO v_template
  FROM public.email_templates
  WHERE segment = NEW.segment AND step = 'initial'
  UNION ALL
  SELECT subject, body FROM public.email_templates
  WHERE segment = 'All' AND step = 'initial'
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO public.generated_emails (lead_id, campaign_id, step, sujet, corps_du_mail, statut_envoi, model_used)
  VALUES (
    NEW.id, NULL, 'initial',
    public.render_template(v_template.subject, NEW.id),
    public.render_template(v_template.body, NEW.id),
    'draft', 'template'
  )
  RETURNING id INTO v_new_id;

  SELECT (value->>'mode') INTO v_mode FROM public.app_settings WHERE key = 'prospection_mode';

  IF v_mode = 'auto' THEN
    PERFORM public.schedule_send(v_new_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_prospection_draft
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_prospection_draft();
```

Même principe pour les relances, déclenché non pas par un trigger (pas d'évènement DB naturel pour "5 jours se sont écoulés") mais par la fonction planifiée serveur décrite plus bas (`flush-send-queue` ou une fonction dédiée `process-followups`), qui tourne périodiquement.

## Flux applicatif

### Mode manuel (par défaut)

1. Lead créé → draft auto-créé (`draft`), visible dans l'onglet "Génération / Validation" (renommage de l'actuel "Génération IA").
2. Utilisateur relit, édite si besoin, clique "Approuver" → email passe en `approved` avec `scheduled_at` calculé par `schedule_send()` (aujourd'hui si quota dispo, sinon jour suivant).
3. Bouton "Envoyer le lot du jour (X/quota)" dans l'onglet Campagnes envoie tous les `approved` dus aujourd'hui, dans la limite du quota restant.
4. Relances : onglet "Relances" liste les leads ayant atteint J+seuil (lu depuis Réglages), avec bouton "Générer la relance" (fusionne le template `relance_1`/`relance_2`) puis même flux d'approbation.

### Mode automatique

1. Lead créé → draft auto-créé **et auto-approuvé** (`schedule_send()` appelé directement par le trigger).
2. Relances : détectées et auto-approuvées par le job serveur périodique, sans validation humaine.
3. Envoi réel : job serveur périodique (`flush-send-queue`, voir plus bas) purge la file sans qu'un humain ouvre l'app.
4. L'onglet "Génération / Validation" devient un journal en lecture seule des emails auto-générés (toujours éditable/annulable avant l'heure d'envoi effective, au cas où).

### Toggle global

Composant en haut de la page Prospection, adapté du composant fourni par l'utilisateur (slider à fond dégradé animé par `motion`) :
- États : "Vérification humaine" (icône `ShieldCheck`) / "Automatique" (icône `Zap`).
- Dégradé `from-[var(--purple)] to-[var(--gold)]` au lieu de violet/indigo.
- Lit/écrit `app_settings.prospection_mode`.

## Envoi & quota

### `flush-send-queue` (nouvelle Edge Function)

Réutilise la logique d'envoi de `send-email` (extraite dans `supabase/functions/_shared/sendViaResend.ts` pour éviter la duplication) :
1. Compte les emails déjà `sent` aujourd'hui.
2. Sélectionne les `generated_emails` avec `statut_envoi = 'approved'` et `scheduled_at::date <= current_date`, triés par `scheduled_at`.
3. Envoie jusqu'à épuisement du quota restant du jour (`daily_send_quota - déjà_envoyés_aujourd'hui`).
4. S'arrête proprement si quota atteint (le reste reste `approved`, sera repris au prochain passage/jour).

### Déclenchement

- **Mode manuel** : bouton "Envoyer le lot du jour" dans l'UI appelle `flush-send-queue` à la demande.
- **Mode automatique** : Cron Supabase (extensions `pg_cron` + `pg_net`, à activer une fois via SQL Editor du projet Supabase) appelle `flush-send-queue` toutes les heures, en permanence (pas besoin d'ajouter/retirer le job à chaque bascule du toggle). La fonction vérifie `prospection_mode` en première ligne et retourne immédiatement sans rien envoyer si le mode est `manual` — ça évite de court-circuiter la validation humaine tout en gardant un seul mécanisme, idempotent, qui ne fait rien si la file est vide ou le quota déjà atteint.

## Relances (follow-up)

- Seuils lus depuis `app_settings` (`followup_1_days`, `followup_2_days`, `archive_after_followups`) au lieu des constantes en dur dans `prospectionService.getFollowUpCandidates`.
- Chaque relance utilise le template `email_templates` de l'étape correspondante (`relance_1`/`relance_2`) au lieu de reformuler à partir de zéro.
- Affichage systématique de la date du dernier envoi + "J+X" (déjà calculé par `daysSinceLastEmail`, conservé).
- En mode automatique, une fonction serveur périodique (même job que `flush-send-queue`, ou fonction sœur `process-followups` appelée juste avant) détecte les candidats et crée+planifie leur relance sans validation humaine.

## UI / Frontend

### Onglets de la page Prospection (renommage/ajout)

1. **Génération / Validation** (ex-"Génération IA") : file de review (mode manuel) ou journal (mode auto) des drafts par lead, avec édition inline conservée.
2. **Templates** (nouveau) : grille segment × étape, éditeur avec barre d'insertion de variables (`{{contact_name}}`, `{{company_name}}`, `{{poste}}`, + liste dynamique des clés `custom_fields` déjà utilisées ailleurs dans la base), aperçu en direct sur un lead choisi.
3. **Campagnes** : conservé pour les pushs ponctuels, + filtre "Sans campagne (flux auto)" pour voir les métriques du pipeline permanent.
4. **Relances** : conservé, seuils désormais lus depuis Réglages.

### Style

- Tailwind ajouté au projet (config + PostCSS), classes utilitaires utilisées uniquement dans les nouveaux composants de cette page (coexiste avec le CSS custom existant ailleurs, pas de migration globale).
- `tailwind.config` mappe des tokens de marque sur les CSS vars existantes (`--purple`, `--gold`, `--green`, `--text-h`, `--text-muted`, `--border`, etc.) pour que les patterns hover.dev (tabs animés, accordion, modal, progress bar de quota, toggle) rendent avec l'identité visuelle actuelle plutôt que leur palette par défaut.
- Composants concernés : toggle mode (fourni par l'utilisateur, adapté), tabs de la page (animation soulignement), modal éditeur de template, accordion des previews d'email (remplace l'actuel expand/collapse maison), progress bar de quota d'envoi.

## Réglages (Settings.tsx)

Nouvel onglet "Prospection" dans Réglages, à côté de "Règles & SLA" : formulaire pour `daily_send_quota`, `followup_1_days`, `followup_2_days`, `archive_after_followups`. Même pattern que `handleSaveGeneralSettings` existant.

## Vérification

- Test manuel bout-en-bout en mode manuel : créer un lead avec segment Media → vérifier draft auto-créé avec variables fusionnées → éditer → approuver → bouton "Envoyer le lot du jour" → vérifier réception + tracking pixel (comme lors du test du 2026-07-06).
- Test manuel du mode automatique : basculer le toggle → créer un lead → vérifier auto-approbation + `scheduled_at` correct → déclencher manuellement `flush-send-queue` (ou attendre le cron) → vérifier envoi sans action humaine.
- Test de dépassement de quota : simuler >100 leads/leads approuvés le même jour → vérifier étalement correct des `scheduled_at` sur les jours suivants.
- Test des relances : abaisser temporairement `followup_1_days` à 0 pour un lead de test → vérifier apparition dans l'onglet Relances avec le bon template.

## Points nécessitant une action manuelle de l'utilisateur

- Activer les extensions `pg_cron` et `pg_net` sur le projet Supabase (SQL Editor, une fois) pour que le mode automatique puisse réellement envoyer sans ouvrir l'app.
- Le point bloquant déjà connu (mémoire `project_prospection_ia_module`) reste valable : `RESEND_FROM_EMAIL` est encore sur le sandbox `onboarding@resend.dev`, qui ne délivre qu'à l'adresse du compte Resend. Il faudra vérifier un domaine réel sur resend.com/domains avant un usage en conditions réelles avec de vrais prospects.

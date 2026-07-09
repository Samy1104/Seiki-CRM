# Prospection — Suppression des campagnes et de la génération manuelle

Date : 2026-07-08
Statut : validé par l'utilisateur, prêt pour plan d'implémentation

## Contexte

La refonte Prospection ([2026-07-08-prospection-refonte-design.md](2026-07-08-prospection-refonte-design.md)) a introduit un concept de "campagnes" (regroupement manuel de pushs ciblés) en plus du flux automatique par lead. Après usage, l'utilisateur n'a besoin ni de gérer des campagnes, ni de génération manuelle par sélection de leads — seulement des templates et des relances, sur un flux unique.

## Objectifs

1. Supprimer entièrement le concept de campagne : UI, service, schéma DB.
2. Simplifier le flux de génération à une seule liste de validation (plus de distinction "Auto"/"Manuelle").
3. Ramener la page Prospection à 3 onglets : Templates, Validation, Relances.
4. Corriger au passage un texte résiduel ("généré par IA") qui n'a plus lieu d'être depuis la refonte template.

## Hors scope

- Le circuit d'envoi/quota/relances lui-même (`schedule_send`, `flush-send-queue`, seuils de relance) : inchangé, fonctionne déjà sans notion de campagne pour le flux auto.
- Toute intégration Resend inbound (réponses des prospects) : question posée séparément par l'utilisateur, non traitée dans cette spec — Resend n'a pas d'API de réception, nécessiterait un service tiers si demandé plus tard.

## Modèle de données

### Suppression réelle (migration destructive, sur projet Supabase partagé réel)

Nouveau fichier `Projet/schema_prospection_v3_cleanup.sql`, dans l'ordre (respecte les dépendances) :

```sql
DROP TRIGGER IF EXISTS trg_sync_campaign_sent ON public.generated_emails;
DROP FUNCTION IF EXISTS public.sync_campaign_counters();
DROP VIEW IF EXISTS public.campaign_metrics;

-- log_generated_email() réécrite : retire campaign_id du jsonb loggé,
-- corrige le texte historique "généré par IA" (obsolète depuis la refonte template)
CREATE OR REPLACE FUNCTION public.log_generated_email()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.history (lead_id, action_type, content, metadata, is_auto)
  VALUES (
    NEW.lead_id,
    'email_sent',
    CASE
      WHEN NEW.statut_envoi = 'sent'
        THEN 'Email de prospection envoyé : ' || COALESCE(NEW.sujet, '(sans sujet)')
      ELSE 'Email de prospection généré depuis template : ' || COALESCE(NEW.sujet, '(sans sujet)')
    END,
    jsonb_build_object(
      'generated_email_id', NEW.id,
      'model', NEW.model_used,
      'statut', NEW.statut_envoi
    ),
    true
  );
  RETURN NEW;
END;
$$;

ALTER TABLE public.generated_emails DROP COLUMN IF EXISTS campaign_id;
DROP TABLE IF EXISTS public.campaigns CASCADE;
```

`auto_create_prospection_draft()` (déclencheur Task 4, dans `schema_prospection_v2_functions.sql`) et `createFollowUpDraft` (`prospectionService.ts`) sont mis à jour pour ne plus insérer `campaign_id` dans `generated_emails` (colonne supprimée).

**Risque assumé par l'utilisateur** : action destructive sur la base réelle. Pas de campagne existante à préserver connue à ce jour — décision de l'utilisateur, pas de sauvegarde préalable prévue dans cette spec.

## Service — renommage et simplification

`src/services/campaignsService.ts` → `src/services/emailsService.ts`. Toutes les références mises à jour (`Prospection.tsx`, tout autre import).

Supprimés : `Campaign`, `CampaignMetrics` (interfaces), `getCampaigns`, `getCampaignById`, `createCampaign`, `updateCampaign`, `deleteCampaign`.

Conservés (avec une simplification) :
- `getGeneratedEmails(statut?)` — remplace `getUnassignedGeneratedEmails`, retire le filtre `.is('campaign_id', null)` (plus de colonne à filtrer).
- `approveAndSchedule`, `flushSendQueue`, `sendEmail`, `updateGeneratedEmail`, `deleteGeneratedEmail`, `getGeneratedEmailById` — inchangés.

`GeneratedEmail` perd le champ `campaign_id: string | null`.

## UI — Prospection.tsx

`Tab` devient `'templates' | 'validation' | 'followup'` (plus de `'campaigns'`, plus de `'generation'` renommé `'validation'`).

Supprimés entièrement : `CampaignsTab`, `CampaignCard`, `CreateCampaignModal`, et tout le code du sous-flux "Manuelle" dans l'ex-`GenerationTab` (sélection de campagne, sélection de leads, génération en masse par bouton).

`GenerationTab` → `ValidationTab` : ne garde que ce qui était le sous-onglet "Auto" — liste unique des drafts (`emailsService.getGeneratedEmails('draft')`), plus le bouton "Envoyer le lot du jour" et l'affichage du quota (déplacés depuis l'ex-`CampaignsTab`).

`EmailPreviewCard` perd le prop `queueMode` et `handleApproveAndQueue` — un seul comportement d'approbation (`handleApproveAndSend`, déjà quota-aware depuis le fix post-merge) pour toutes les cartes.

Onglet "Templates" et "Relances" (`FollowUpTab`) : inchangés, aucune dépendance aux campagnes.

## Nettoyage CSS

`src/index.css` : classes `.campaign-card*`, `.campaign-status-dot`, `.campaign-metrics*`, `.campaign-objective`, `.campaign-tone` (et similaires) deviennent mortes. Retirées si identifiables sans ambiguïté ; sinon laissées (CSS mort = zéro risque d'exécution, pas bloquant).

## Vérification

Pas de framework de test automatisé dans ce repo — méthodologie identique à la refonte précédente :
- `npm run build` doit rester propre à chaque étape.
- Vérification SQL directe (`supabase db query --linked`) après la migration destructive : confirmer `campaigns`/`campaign_metrics` n'existent plus, `generated_emails.campaign_id` n'existe plus, et qu'un lead de test créé génère toujours bien un draft (le trigger Task 4 fonctionne sans la colonne).
- Pas de vérification navigateur cette session (mêmes contraintes que la refonte : pas de credentials de test pour l'Auth Supabase réelle).

-- ============================================================
-- SEIKI CRM — Suppression des campagnes (Prospection simplifiée)
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS avoir vérifié qu'aucun code ne référence plus campaign_id/campaigns
-- (voir Tasks 1-4 du plan docs/superpowers/plans/2026-07-08-prospection-simplify.md)
-- ============================================================

-- 1. Retirer le trigger + fonction qui maintenaient les compteurs de campagne
DROP TRIGGER IF EXISTS trg_sync_campaign_sent ON public.generated_emails;
DROP FUNCTION IF EXISTS public.sync_campaign_counters();

-- 2. Retirer la vue de métriques par campagne (dépend de campaigns + campaign_id)
DROP VIEW IF EXISTS public.campaign_metrics;

-- 3. Réécrire log_generated_email() : retire campaign_id du jsonb loggé,
--    et corrige un texte résiduel de l'ancienne ère "génération IA"
--    (obsolète depuis le passage aux templates)
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

-- 4. Réécrire auto_create_prospection_draft() (déclencheur Task 4 de la refonte
--    précédente) : retire campaign_id de l'INSERT, colonne sur le point d'être supprimée
CREATE OR REPLACE FUNCTION public.auto_create_prospection_draft()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_subject TEXT;
  v_body    TEXT;
  v_mode    TEXT;
  v_new_id  UUID;
BEGIN
  IF NEW.email IS NULL OR NEW.is_archived THEN
    RETURN NEW;
  END IF;

  SELECT subject, body INTO v_subject, v_body
  FROM public.email_templates
  WHERE segment = NEW.segment AND step = 'initial';

  IF NOT FOUND THEN
    SELECT subject, body INTO v_subject, v_body
    FROM public.email_templates
    WHERE segment = 'All' AND step = 'initial';
  END IF;

  IF NOT FOUND OR v_subject IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.generated_emails (lead_id, step, sujet, corps_du_mail, statut_envoi, model_used)
  VALUES (
    NEW.id, 'initial',
    public.render_template(v_subject, NEW.id),
    public.render_template(v_body, NEW.id),
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

-- 5. Retirer la colonne campaign_id de generated_emails (l'index associé part avec)
ALTER TABLE public.generated_emails DROP COLUMN IF EXISTS campaign_id;

-- 6. Supprimer la table campaigns elle-même
DROP TABLE IF EXISTS public.campaigns CASCADE;

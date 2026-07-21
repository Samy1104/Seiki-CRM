-- ============================================================
-- SEIKI CRM — Add-on Fusion de leads transactionnelle
-- À appliquer dans : Supabase > SQL Editor
-- APRÈS le schéma principal (schema_supabase.sql)
--
-- Remplace la logique de resolveMergeProposal (auparavant 4 écritures
-- séquentielles côté client, sans rollback : un échec entre deux étapes
-- pouvait laisser un lead à moitié fusionné) par une seule fonction
-- exécutée dans une unique transaction Postgres — tout ou rien.
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_merge_proposal(
  p_proposal_id UUID,
  p_status TEXT,
  p_resolver_id UUID DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_proposal RECORD;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'p_status invalide : % (attendu approved|rejected)', p_status;
  END IF;

  SELECT * INTO v_proposal
  FROM public.lead_merge_proposals
  WHERE id = p_proposal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposition de fusion introuvable : %', p_proposal_id;
  END IF;

  UPDATE public.lead_merge_proposals
  SET status = p_status,
      resolved_by = p_resolver_id,
      resolved_at = now()
  WHERE id = p_proposal_id;

  IF p_status = 'approved' THEN
    -- 1. Déplace l'historique du lead source vers le lead cible
    UPDATE public.history
    SET lead_id = v_proposal.target_lead_id
    WHERE lead_id = v_proposal.source_lead_id;

    -- 2. Déplace les tâches du lead source vers le lead cible
    UPDATE public.tasks
    SET lead_id = v_proposal.target_lead_id
    WHERE lead_id = v_proposal.source_lead_id;

    -- 3. Marque le lead source comme fusionné et l'archive
    UPDATE public.leads
    SET merged_into_id = v_proposal.target_lead_id,
        is_archived = true
    WHERE id = v_proposal.source_lead_id;

    -- 4. Log l'action de fusion sur le lead cible
    INSERT INTO public.history (lead_id, action_type, content, metadata)
    VALUES (
      v_proposal.target_lead_id,
      'merge',
      'Lead fusionné avec doublon détecté. Historique et tâches importés.',
      jsonb_build_object('merged_lead_id', v_proposal.source_lead_id)
    );
  END IF;
END;
$$;

-- ============================================================
-- SEIKI CRM — Fix render_template PostgreSQL Function
-- À exécuter dans : Supabase > SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.render_template(p_template TEXT, p_lead_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_lead       RECORD;
  v_result     TEXT := p_template;
  v_key        TEXT;
  v_value      TEXT;
  v_full_name  TEXT;
  v_parts      TEXT[];
  v_genre      TEXT := '';
  v_prenom     TEXT := '';
  v_nom        TEXT := '';
  v_first_word TEXT;
  v_idx        INTEGER := 1;
BEGIN
  SELECT contact_name, company_name, poste, segment, custom_fields
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN p_template;
  END IF;

  v_full_name := trim(COALESCE(v_lead.contact_name, ''));
  
  IF v_full_name <> '' AND v_full_name <> '—' THEN
    v_parts := regexp_split_to_array(v_full_name, '\s+');
    IF array_length(v_parts, 1) > 0 THEN
      v_first_word := lower(v_parts[1]);
      IF v_first_word IN ('m.', 'm', 'mr', 'mr.', 'monsieur') THEN
        v_genre := 'Monsieur';
        v_idx := 2;
      ELSIF v_first_word IN ('mme', 'mme.', 'mrs', 'mrs.', 'ms', 'ms.', 'madame') THEN
        v_genre := 'Madame';
        v_idx := 2;
      ELSIF v_first_word IN ('autre', 'mx', 'mx.') THEN
        v_genre := 'Autre';
        v_idx := 2;
      END IF;

      IF array_length(v_parts, 1) >= v_idx THEN
        v_prenom := v_parts[v_idx];
      END IF;

      IF array_length(v_parts, 1) > v_idx THEN
        v_nom := upper(array_to_string(v_parts[v_idx + 1:], ' '));
      END IF;
    END IF;
  END IF;

  v_result := replace(v_result, '{{genre}}',        COALESCE(v_genre, ''));
  v_result := replace(v_result, '{{prenom}}',       COALESCE(v_prenom, ''));
  v_result := replace(v_result, '{{nom}}',          COALESCE(v_nom, ''));
  v_result := replace(v_result, '{{contact_name}}', COALESCE(v_lead.contact_name, ''));
  v_result := replace(v_result, '{{company_name}}', COALESCE(v_lead.company_name, ''));
  v_result := replace(v_result, '{{poste}}',        COALESCE(v_lead.poste, ''));
  v_result := replace(v_result, '{{segment}}',      COALESCE(v_lead.segment, ''));

  FOR v_key, v_value IN
    SELECT key, value FROM jsonb_each_text(COALESCE(v_lead.custom_fields, '{}'::jsonb))
  LOOP
    v_result := replace(v_result, '{{custom.' || v_key || '}}', COALESCE(v_value, ''));
  END LOOP;

  RETURN v_result;
END;
$$;

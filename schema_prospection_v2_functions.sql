-- ============================================================
-- render_template — fusion de variables {{...}} pour un lead donné
-- ============================================================
CREATE OR REPLACE FUNCTION public.render_template(p_template TEXT, p_lead_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_lead   RECORD;
  v_result TEXT := p_template;
  v_key    TEXT;
  v_value  TEXT;
BEGIN
  SELECT contact_name, company_name, poste, segment, custom_fields
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN p_template;
  END IF;

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

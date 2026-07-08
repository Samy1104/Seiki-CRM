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

-- ============================================================
-- schedule_send — trouve le prochain créneau sous quota et
-- passe l'email en 'approved' avec scheduled_at fixé
-- ============================================================
CREATE OR REPLACE FUNCTION public.schedule_send(p_generated_email_id UUID)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql AS $$
DECLARE
  v_quota       INTEGER;
  v_day         DATE := current_date;
  v_used_today  INTEGER;
  v_slot        TIMESTAMPTZ;
BEGIN
  SELECT (value->>'count')::INTEGER INTO v_quota
  FROM public.app_settings WHERE key = 'daily_send_quota';
  v_quota := COALESCE(v_quota, 100);

  LOOP
    SELECT count(*) INTO v_used_today
    FROM public.generated_emails
    WHERE id <> p_generated_email_id
      AND (
        (statut_envoi = 'sent' AND sent_at::date = v_day)
        OR (statut_envoi IN ('approved', 'sending') AND scheduled_at::date = v_day)
      );

    EXIT WHEN v_used_today < v_quota;
    v_day := v_day + 1;
  END LOOP;

  v_slot := v_day::TIMESTAMPTZ;

  UPDATE public.generated_emails
  SET statut_envoi = 'approved',
      scheduled_at = v_slot,
      approved_at  = now()
  WHERE id = p_generated_email_id;

  RETURN v_slot;
END;
$$;

-- ============================================================
-- auto_create_prospection_draft — dès qu'un lead est créé,
-- prépare son email initial (draft, ou approved+planifié si
-- le mode automatique est actif)
-- ============================================================
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

  INSERT INTO public.generated_emails (lead_id, campaign_id, step, sujet, corps_du_mail, statut_envoi, model_used)
  VALUES (
    NEW.id, NULL, 'initial',
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

CREATE TRIGGER trg_auto_create_prospection_draft
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_prospection_draft();

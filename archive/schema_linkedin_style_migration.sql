-- ============================================================
-- One-time migration : linkedin_style_learned_{voice}
-- Converts the legacy { "rules": "<merged text blob>" } shape
-- into the new { "entries": [...] } shape expected by the
-- rebuilt writing-style system. Safe to run even if no row
-- exists yet for a given key (UPDATE affects 0 rows).
-- Run once in the Supabase SQL Editor before deploying the
-- updated generate-linkedin-post / learn-linkedin-style functions.
-- ============================================================

UPDATE app_settings
SET value = jsonb_build_object(
  'entries',
  jsonb_build_array(
    jsonb_build_object(
      'rule', value->>'rules',
      'reason', 'Migré depuis l''ancien format de règles fusionnées',
      'learned_at', now()
    )
  )
),
updated_at = now()
WHERE key IN ('linkedin_style_learned_seiki', 'linkedin_style_learned_jaafar')
  AND value ? 'rules'
  AND value->>'rules' IS NOT NULL
  AND length(trim(value->>'rules')) > 0;

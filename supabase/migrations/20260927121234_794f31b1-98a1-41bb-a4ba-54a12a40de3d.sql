UPDATE public.drive_nodes
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('sample', true, 'source', 'Google Drive Audit Repository Architecture')
WHERE created_at >= timestamptz '2026-09-27 12:10:00+00'
  AND metadata = '{}'::jsonb;
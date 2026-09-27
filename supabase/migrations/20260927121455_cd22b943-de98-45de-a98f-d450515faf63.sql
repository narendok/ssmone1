UPDATE public.drive_nodes
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('sample', true, 'source', 'Google Drive Audit Repository Architecture')
WHERE name='SAMPLE — 00_Automotive_Hardware_Audit_Repository'
  AND metadata->>'source'='Google Drive Audit Repository Architecture';
WITH RECURSIVE seed AS (
  SELECT id FROM public.drive_nodes
  WHERE created_at >= timestamptz '2026-09-27 12:10:00+00'
    AND node_type='FOLDER'
    AND metadata='{}'::jsonb
), subtree AS (
  SELECT id FROM seed
  UNION
  SELECT n.id FROM public.drive_nodes n JOIN subtree s ON n.parent_id=s.id
)
DELETE FROM public.drive_nodes WHERE id IN (SELECT id FROM subtree);
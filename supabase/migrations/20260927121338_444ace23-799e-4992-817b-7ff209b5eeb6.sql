DELETE FROM public.drive_nodes
WHERE created_at >= timestamptz '2026-09-27 12:10:00+00'
  AND node_type = 'FOLDER'
  AND metadata = '{}'::jsonb
  AND NOT EXISTS (SELECT 1 FROM public.drive_nodes child WHERE child.parent_id = drive_nodes.id);
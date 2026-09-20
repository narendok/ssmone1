INSERT INTO public.document_numbering_config (key, label, prefix_template, serial_padding, is_active, metadata, entity_type, include_year, include_department, include_project, separator, starting_number, reset_policy, current_sequence)
VALUES
  ('ppap', 'PPAP package', 'PPAP', 4, true, '{}'::jsonb, 'ppap', true, true, false, '-', 1, 'NEVER', 0),
  ('dispatch', 'Production dispatch', 'DSP', 4, true, '{}'::jsonb, 'dispatch', true, true, false, '-', 1, 'NEVER', 0)
ON CONFLICT (key) DO NOTHING;
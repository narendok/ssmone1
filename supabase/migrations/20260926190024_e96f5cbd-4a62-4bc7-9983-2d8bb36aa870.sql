INSERT INTO public.document_numbering_config (
  key,
  label,
  prefix_template,
  serial_padding,
  is_active,
  metadata,
  entity_type,
  include_year,
  include_department,
  include_project,
  separator,
  starting_number,
  reset_policy,
  current_sequence
)
SELECT
  'adjustment',
  'Stock Adjustment',
  'ADJ',
  5,
  true,
  '{}'::jsonb,
  'stock_adjustment',
  true,
  false,
  false,
  '-',
  1,
  'never',
  0
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_numbering_config WHERE key = 'adjustment'
);
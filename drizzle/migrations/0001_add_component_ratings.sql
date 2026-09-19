ALTER TABLE public.components
  ADD COLUMN IF NOT EXISTS voltage_rating text,
  ADD COLUMN IF NOT EXISTS current_rating text,
  ADD COLUMN IF NOT EXISTS temperature_rating text;
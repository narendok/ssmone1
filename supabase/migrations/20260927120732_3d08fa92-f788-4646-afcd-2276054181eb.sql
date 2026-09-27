ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.qms_audits ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS projects_is_sample_idx ON public.projects (is_sample) WHERE is_sample;
CREATE INDEX IF NOT EXISTS customers_is_sample_idx ON public.customers (is_sample) WHERE is_sample;
CREATE INDEX IF NOT EXISTS qms_audits_is_sample_idx ON public.qms_audits (is_sample) WHERE is_sample;
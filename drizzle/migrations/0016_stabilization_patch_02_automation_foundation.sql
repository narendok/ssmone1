CREATE TABLE public.external_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  purpose text NOT NULL,
  authentication_kind text NOT NULL DEFAULT 'managed' CHECK (authentication_kind IN ('managed','connector','api_key','none')),
  scope_description text,
  is_enabled boolean NOT NULL DEFAULT false,
  health_status text NOT NULL DEFAULT 'not_configured' CHECK (health_status IN ('healthy','degraded','error','not_configured','disabled')),
  last_synced_at timestamptz,
  rate_limit_note text,
  last_error text,
  provenance_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, purpose)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_integrations TO authenticated;
GRANT ALL ON public.external_integrations TO service_role;
ALTER TABLE public.external_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view external integrations" ON public.external_integrations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage external integrations" ON public.external_integrations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER external_integrations_touch_ssm BEFORE UPDATE ON public.external_integrations FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  trigger_key text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  execution_mode text NOT NULL DEFAULT 'automatic' CHECK (execution_mode IN ('automatic','review_required','manual')),
  priority integer NOT NULL DEFAULT 100,
  effective_from timestamptz,
  effective_until timestamptz,
  is_enabled boolean NOT NULL DEFAULT true,
  owner_user_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view automation rules" ON public.automation_rules FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage automation rules" ON public.automation_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER automation_rules_touch_ssm BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  trigger_key text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  affected_entity_type text,
  affected_entity_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','skipped','failed','paused')),
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  initiated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view automation runs" ON public.automation_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service records automation runs" ON public.automation_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX automation_runs_status_created_idx ON public.automation_runs(status, created_at DESC);
CREATE INDEX automation_runs_entity_idx ON public.automation_runs(affected_entity_type, affected_entity_id);

CREATE TABLE public.automation_job_leases (
  job_key text PRIMARY KEY,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','paused','failed')),
  lease_expires_at timestamptz,
  pause_reason text,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_job_leases TO authenticated;
GRANT ALL ON public.automation_job_leases TO service_role;
ALTER TABLE public.automation_job_leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view automation job leases" ON public.automation_job_leases FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage automation job leases" ON public.automation_job_leases FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.data_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_key text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('ssm','derived','external','ai','manual')),
  provider text,
  source_identifier text,
  source_url text,
  value_snapshot jsonb,
  confidence numeric(5,4),
  state text NOT NULL DEFAULT 'suggested' CHECK (state IN ('suggested','needs_review','confirmed','rejected','overridden')),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  confirmed_by uuid,
  confirmed_at timestamptz,
  override_value jsonb,
  override_by uuid,
  override_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT(entity_type, entity_id, field_key, source_kind, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_provenance TO authenticated;
GRANT ALL ON public.data_provenance TO service_role;
ALTER TABLE public.data_provenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view provenance" ON public.data_provenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users record provenance" ON public.data_provenance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users update provenance" ON public.data_provenance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER data_provenance_touch_ssm BEFORE UPDATE ON public.data_provenance FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE INDEX data_provenance_entity_idx ON public.data_provenance(entity_type, entity_id, field_key);

CREATE TABLE public.external_data_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  cache_key text NOT NULL,
  payload jsonb NOT NULL,
  source_identifier text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_verified_at timestamptz,
  status text NOT NULL DEFAULT 'fresh' CHECK (status IN ('fresh','stale','error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, cache_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_data_cache TO authenticated;
GRANT ALL ON public.external_data_cache TO service_role;
ALTER TABLE public.external_data_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view external cache" ON public.external_data_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service manages external cache" ON public.external_data_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX external_data_cache_expiry_idx ON public.external_data_cache(provider, expires_at);

CREATE OR REPLACE FUNCTION public.try_acquire_automation_lease(_job_key text, _lease_seconds integer DEFAULT 300)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE acquired boolean := false;
BEGIN
  INSERT INTO public.automation_job_leases (job_key, status, lease_expires_at, last_started_at, updated_at)
  VALUES (_job_key, 'running', now() + make_interval(secs => GREATEST(_lease_seconds, 30)), now(), now())
  ON CONFLICT (job_key) DO UPDATE
  SET status = 'running',
      lease_expires_at = now() + make_interval(secs => GREATEST(_lease_seconds, 30)),
      last_started_at = now(),
      updated_at = now(),
      last_error = NULL
  WHERE public.automation_job_leases.status <> 'paused'
    AND (public.automation_job_leases.lease_expires_at IS NULL OR public.automation_job_leases.lease_expires_at < now())
  RETURNING true INTO acquired;
  RETURN COALESCE(acquired, false);
END;
$$;
GRANT EXECUTE ON FUNCTION public.try_acquire_automation_lease(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_automation_lease(_job_key text, _error text DEFAULT NULL, _pause boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.automation_job_leases
  SET status = CASE WHEN _pause THEN 'paused' WHEN _error IS NULL THEN 'idle' ELSE 'failed' END,
      pause_reason = CASE WHEN _pause THEN _error ELSE pause_reason END,
      last_error = _error,
      lease_expires_at = NULL,
      last_completed_at = now(),
      updated_at = now()
  WHERE job_key = _job_key;
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_automation_lease(text, text, boolean) TO service_role;
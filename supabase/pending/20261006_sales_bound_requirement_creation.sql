-- SOURCE-ONLY PROPOSAL. Do not apply until isolated caller-authenticated acceptance
-- demonstrates Sales authorization, source binding, exact replay, concurrency, audit
-- rollback, direct-write denial, compatibility preservation, and non-admin RLS. This introduces no automatic
-- feasibility, approval, conversion, publication, or mutation of existing requirements.
--
-- New pending DDL: an internal Sales-only receipt table is necessary because no existing
-- receipt can bind the immutable Master Specification version to this write channel.
CREATE TABLE public.sales_requirement_creation_requests (
  request_key uuid PRIMARY KEY,
  requested_by uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.sales_opportunities(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  master_specification_version_id uuid NOT NULL REFERENCES public.master_specification_versions(id) ON DELETE RESTRICT,
  payload_hash text NOT NULL,
  payload_canonical jsonb NOT NULL,
  requirement_id uuid NOT NULL UNIQUE REFERENCES public.customer_requirements(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(payload_hash)) > 0),
  CHECK (jsonb_typeof(payload_canonical) = 'object')
);
GRANT ALL ON TABLE public.sales_requirement_creation_requests TO service_role;
REVOKE ALL ON TABLE public.sales_requirement_creation_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE public.sales_requirement_creation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct receipt access"
  ON public.sales_requirement_creation_requests
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.sales_requirement_creation_canonical_payload(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_master_specification_version_id uuid,
  p_title text,
  p_customer_reference text,
  p_summary text
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'opportunity_id', p_opportunity_id,
    'customer_id', p_customer_id,
    'master_specification_version_id', p_master_specification_version_id,
    'title', btrim(p_title),
    'customer_reference', nullif(btrim(coalesce(p_customer_reference, '')), ''),
    'summary', nullif(btrim(coalesce(p_summary, '')), '')
  )
$$;

CREATE OR REPLACE FUNCTION public.sales_requirement_creation_payload_hash(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_master_specification_version_id uuid,
  p_title text,
  p_customer_reference text,
  p_summary text
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT md5(public.sales_requirement_creation_canonical_payload(
    p_opportunity_id, p_customer_id, p_master_specification_version_id,
    p_title, p_customer_reference, p_summary
  )::text)
$$;

CREATE OR REPLACE FUNCTION public.create_sales_bound_customer_requirement(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_master_specification_version_id uuid,
  p_title text,
  p_customer_reference text,
  p_summary text,
  p_request_key uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_requirement public.customer_requirements%ROWTYPE;
  v_prior public.sales_requirement_creation_requests%ROWTYPE;
  v_payload_canonical jsonb;
  v_payload_hash text;
  v_source_specification_id uuid;
  v_source_version_number integer;
BEGIN
  IF v_actor_id IS NULL OR NOT public.has_permission(v_actor_id, 'sales.manage') THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;
  IF p_request_key IS NULL
     OR p_opportunity_id IS NULL
     OR p_customer_id IS NULL
     OR p_master_specification_version_id IS NULL
     OR NULLIF(btrim(p_title), '') IS NULL
     OR char_length(btrim(p_title)) > 240
     OR (p_customer_reference IS NOT NULL AND char_length(btrim(p_customer_reference)) > 160)
     OR (p_summary IS NOT NULL AND char_length(btrim(p_summary)) > 8000) THEN
    RAISE EXCEPTION 'A request key, bound sources, and valid requirement fields are required';
  END IF;

  v_payload_canonical := public.sales_requirement_creation_canonical_payload(
    p_opportunity_id, p_customer_id, p_master_specification_version_id,
    p_title, p_customer_reference, p_summary
  );
  v_payload_hash := public.sales_requirement_creation_payload_hash(
    p_opportunity_id, p_customer_id, p_master_specification_version_id,
    p_title, p_customer_reference, p_summary
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  -- Global lock order for every future contract touching these resources:
  -- advisory(request_key) -> receipt row -> sales opportunity -> Master Specification.
  -- The controlled Master Specification save owns the trailing source order.
  SELECT * INTO v_prior
  FROM public.sales_requirement_creation_requests
  WHERE request_key = p_request_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_prior.requested_by = v_actor_id
       AND v_prior.opportunity_id = p_opportunity_id
       AND v_prior.customer_id = p_customer_id
       AND v_prior.master_specification_version_id = p_master_specification_version_id
       AND v_prior.payload_hash = v_payload_hash
       AND v_prior.payload_canonical = v_payload_canonical THEN
      RETURN v_prior.requirement_id;
    END IF;
    RAISE EXCEPTION 'Request key conflicts with a different caller or payload';
  END IF;

  -- First creation takes the same source-lock order as the controlled Master
  -- Specification save: opportunity, then specification. FOR UPDATE blocks a
  -- concurrent customer-pair/current-version mutation until this transaction
  -- commits. A historical exact receipt has already returned above and never
  -- requires its once-current version to remain current.
  PERFORM 1
  FROM public.sales_opportunities
  WHERE id = p_opportunity_id AND customer_id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity/customer source mismatch';
  END IF;

  SELECT specification.id, version.version_number
  INTO v_source_specification_id, v_source_version_number
  FROM public.master_specifications specification
  JOIN public.master_specification_versions version
    ON version.specification_id = specification.id
  WHERE version.id = p_master_specification_version_id
    AND specification.opportunity_id = p_opportunity_id
    AND specification.customer_id = p_customer_id
    AND version.version_number = specification.current_version
  FOR UPDATE OF specification;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Master Specification version is unavailable for this opportunity and customer';
  END IF;

  INSERT INTO public.customer_requirements (
    requirement_number, opportunity_id, customer_id, title, status, current_revision,
    customer_reference, requirement_data, submitted_at, created_by
  ) VALUES (
    -- The established BEFORE INSERT trigger uses this exact entity and NULL scopes.
    -- Calling it here preserves one serialized counter for Sales and client intake,
    -- while the nonblank result prevents the trigger from allocating a second number.
    public.next_business_number('customer_requirement', NULL, NULL),
    p_opportunity_id, p_customer_id, btrim(p_title), 'submitted', 1,
    nullif(btrim(coalesce(p_customer_reference, '')), ''),
    jsonb_build_object(
      'summary', nullif(btrim(coalesce(p_summary, '')), ''),
      'source', jsonb_build_object(
        'opportunity_id', p_opportunity_id,
        'customer_id', p_customer_id,
        'master_specification_id', v_source_specification_id,
        'master_specification_version_id', p_master_specification_version_id,
        'master_specification_version_number', v_source_version_number
      )
    ),
    now(), v_actor_id
  ) RETURNING * INTO v_requirement;

  INSERT INTO public.customer_requirement_revisions (
    requirement_id, revision_number, change_summary, requirement_data, status, created_by
  ) VALUES (
    v_requirement.id, 1, 'Initial source-bound Sales requirement',
    v_requirement.requirement_data, 'submitted', v_actor_id
  );

  INSERT INTO public.activity_log (
    actor_user_id, module_key, entity_type, entity_id, action, summary, after_data
  ) VALUES (
    v_actor_id, 'sales', 'customer_requirement', v_requirement.id, 'source_bound_created',
    'Created source-bound customer requirement.',
    jsonb_build_object(
      'opportunity_id', p_opportunity_id,
      'customer_id', p_customer_id,
      'master_specification_id', v_source_specification_id,
      'master_specification_version_id', p_master_specification_version_id,
      'master_specification_version_number', v_source_version_number,
      'request_key', p_request_key,
      'revision_number', 1
    )
  );

  INSERT INTO public.sales_requirement_creation_requests (
    request_key, requested_by, opportunity_id, customer_id, master_specification_version_id,
    payload_hash, payload_canonical, requirement_id
  ) VALUES (
    p_request_key, v_actor_id, p_opportunity_id, p_customer_id,
    p_master_specification_version_id, v_payload_hash, v_payload_canonical, v_requirement.id
  );
  RETURN v_requirement.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sales_bound_customer_requirement(uuid, uuid, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sales_bound_customer_requirement(uuid, uuid, uuid, text, text, text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sales_requirement_creation_canonical_payload(uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_requirement_creation_payload_hash(uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- COMPATIBILITY GROUP — apply only with 20261005_client_requirement_intake.sql and only
-- after isolated caller-authenticated acceptance. The controlled routines above and the
-- external intake routine remain SECURITY DEFINER entry points after authenticated table
-- writes are removed. The baseline workflow below preserves the one live Sales approval
-- operation that otherwise updates a requirement header.

CREATE OR REPLACE FUNCTION public.approve_requirement_baseline(
  p_requirement_id uuid,
  p_baseline_number text DEFAULT NULL
) RETURNS TABLE(baseline_id uuid, baseline_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_requirement public.customer_requirements%ROWTYPE;
  v_commercial public.sales_commercial_records%ROWTYPE;
  v_baseline public.requirement_baselines%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL OR NOT public.has_permission(v_actor_id, 'sales.manage') THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;
  IF p_requirement_id IS NULL OR (p_baseline_number IS NOT NULL AND char_length(btrim(p_baseline_number)) > 64) THEN
    RAISE EXCEPTION 'A requirement and valid optional baseline number are required';
  END IF;

  SELECT * INTO v_requirement
  FROM public.customer_requirements
  WHERE id = p_requirement_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requirement not found'; END IF;
  IF v_requirement.status IN ('baselined', 'archived') THEN
    RAISE EXCEPTION 'Requirement is already baselined or archived';
  END IF;

  SELECT * INTO v_commercial
  FROM public.sales_commercial_records
  WHERE requirement_id = v_requirement.id AND status = 'customer_authorized'
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer commercial authorization is required before creating a baseline';
  END IF;

  INSERT INTO public.requirement_baselines (
    requirement_id, baseline_number, revision_number, requirement_snapshot,
    commercial_snapshot, approved_by
  ) VALUES (
    v_requirement.id, nullif(btrim(coalesce(p_baseline_number, '')), ''),
    v_requirement.current_revision, v_requirement.requirement_data,
    to_jsonb(v_commercial), v_actor_id
  ) RETURNING * INTO v_baseline;

  UPDATE public.customer_requirements
  SET status = 'baselined', approved_at = now()
  WHERE id = v_requirement.id;
  UPDATE public.sales_opportunities
  SET stage = 'approved', status = 'won'
  WHERE id = v_requirement.opportunity_id;
  INSERT INTO public.activity_log (
    actor_user_id, module_key, entity_type, entity_id, action, summary, after_data
  ) VALUES (
    v_actor_id, 'sales', 'requirement_baseline', v_baseline.id, 'created',
    'Created approved requirement baseline.',
    jsonb_build_object('requirement_id', v_requirement.id, 'revision_number', v_requirement.current_revision)
  );
  RETURN QUERY SELECT v_baseline.id, v_baseline.baseline_number;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_requirement_baseline(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_requirement_baseline(uuid, text) TO authenticated, service_role;

-- No direct authenticated header or revision mutations remain after the three protected
-- creation paths and baseline approval routine above are accepted. Existing manual and
-- approved rows are retained unchanged; this adds no source backfill for the 24v tracker.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_requirements FROM PUBLIC, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_requirement_revisions FROM PUBLIC, authenticated;
DROP POLICY IF EXISTS "Sales users manage requirements" ON public.customer_requirements;
DROP POLICY IF EXISTS "Sales users manage requirement revisions" ON public.customer_requirement_revisions;

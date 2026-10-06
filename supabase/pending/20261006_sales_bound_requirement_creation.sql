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

-- BASELINE APPROVAL COMPATIBILITY GROUP — SOURCE-ONLY. This requires the pending
-- revision-bound feasibility proposal in 20261005_client_requirement_intake.sql.
-- No legacy row is backfilled: a review with NULL provenance remains unavailable.
-- Lock order: advisory(request_key) -> receipt -> requirement -> current revision
-- -> feasibility reviews -> Master version -> commercial record.

CREATE TABLE public.sales_baseline_approval_requests (
  request_key uuid PRIMARY KEY,
  requested_by uuid NOT NULL,
  requirement_id uuid NOT NULL REFERENCES public.customer_requirements(id) ON DELETE RESTRICT,
  source_revision_id uuid NOT NULL REFERENCES public.customer_requirement_revisions(id) ON DELETE RESTRICT,
  master_specification_version_id uuid NOT NULL REFERENCES public.master_specification_versions(id) ON DELETE RESTRICT,
  payload_hash text NOT NULL,
  payload_canonical jsonb NOT NULL,
  baseline_id uuid NOT NULL UNIQUE REFERENCES public.requirement_baselines(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(payload_hash)) > 0),
  CHECK (jsonb_typeof(payload_canonical) = 'object')
);
GRANT ALL ON TABLE public.sales_baseline_approval_requests TO service_role;
REVOKE ALL ON TABLE public.sales_baseline_approval_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE public.sales_baseline_approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct baseline receipt access" ON public.sales_baseline_approval_requests
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.sales_baseline_approval_canonical_payload(p_requirement_id uuid, p_expected_revision_number integer)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('requirement_id', p_requirement_id, 'expected_revision_number', p_expected_revision_number)
$$;
CREATE OR REPLACE FUNCTION public.sales_baseline_approval_payload_hash(p_requirement_id uuid, p_expected_revision_number integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT md5(public.sales_baseline_approval_canonical_payload(p_requirement_id, p_expected_revision_number)::text)
$$;

CREATE OR REPLACE FUNCTION public.approve_sales_requirement_baseline(
  p_requirement_id uuid, p_expected_revision_number integer, p_request_key uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor_id uuid := auth.uid(); v_requirement public.customer_requirements%ROWTYPE;
  v_revision public.customer_requirement_revisions%ROWTYPE; v_master_version public.master_specification_versions%ROWTYPE;
  v_commercial public.sales_commercial_records%ROWTYPE; v_prior public.sales_baseline_approval_requests%ROWTYPE;
  v_baseline public.requirement_baselines%ROWTYPE; v_payload_canonical jsonb; v_payload_hash text;
  v_master_version_id uuid; v_source_opportunity_id uuid; v_source_customer_id uuid; v_source_version_number integer;
  v_workstreams jsonb; v_required_department_ids uuid[]; v_review_count integer; v_unresolved_conditions integer;
BEGIN
  IF v_actor_id IS NULL OR NOT public.has_permission(v_actor_id, 'sales.manage') THEN RAISE EXCEPTION 'Sales management permission is required'; END IF;
  IF p_requirement_id IS NULL OR p_request_key IS NULL OR p_expected_revision_number IS NULL OR p_expected_revision_number < 1 THEN RAISE EXCEPTION 'A requirement, expected revision, and request key are required'; END IF;
  v_payload_canonical := public.sales_baseline_approval_canonical_payload(p_requirement_id, p_expected_revision_number);
  v_payload_hash := public.sales_baseline_approval_payload_hash(p_requirement_id, p_expected_revision_number);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  SELECT * INTO v_prior FROM public.sales_baseline_approval_requests WHERE request_key = p_request_key FOR UPDATE;
  IF FOUND THEN
    IF v_prior.requested_by = v_actor_id AND v_prior.requirement_id = p_requirement_id AND v_prior.payload_hash = v_payload_hash AND v_prior.payload_canonical = v_payload_canonical THEN RETURN v_prior.baseline_id; END IF;
    RAISE EXCEPTION 'Request key conflicts with a different caller or payload';
  END IF;
  SELECT * INTO v_requirement FROM public.customer_requirements WHERE id = p_requirement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baseline source requirement is unavailable'; END IF;
  IF v_requirement.current_revision IS DISTINCT FROM p_expected_revision_number THEN RAISE EXCEPTION 'Requirement revision is stale; reload the current immutable revision before approval'; END IF;
  SELECT * INTO v_revision FROM public.customer_requirement_revisions WHERE requirement_id = v_requirement.id AND revision_number = p_expected_revision_number FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expected immutable customer requirement revision is unavailable'; END IF;
  IF jsonb_typeof(v_revision.requirement_data) IS DISTINCT FROM 'object' OR NULLIF(v_revision.requirement_data #>> '{source,master_specification_version_id}', '') IS NULL THEN RAISE EXCEPTION 'Expected immutable requirement revision lacks Master Specification provenance; legacy provenance is unavailable'; END IF;
  BEGIN
    v_master_version_id := (v_revision.requirement_data #>> '{source,master_specification_version_id}')::uuid;
    v_source_opportunity_id := (v_revision.requirement_data #>> '{source,opportunity_id}')::uuid;
    v_source_customer_id := (v_revision.requirement_data #>> '{source,customer_id}')::uuid;
    v_source_version_number := (v_revision.requirement_data #>> '{source,master_specification_version_number}')::integer;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Expected immutable requirement revision has an invalid Master Specification source tuple'; END;
  IF v_source_opportunity_id IS NULL OR v_source_customer_id IS NULL OR v_source_version_number IS NULL OR v_source_opportunity_id IS DISTINCT FROM v_requirement.opportunity_id OR v_source_customer_id IS DISTINCT FROM v_requirement.customer_id THEN RAISE EXCEPTION 'Expected immutable requirement revision source does not match its requirement opportunity and customer'; END IF;
  PERFORM 1 FROM public.requirement_feasibility_reviews review WHERE review.source_revision_id = v_revision.id FOR UPDATE;
  SELECT version.* INTO v_master_version FROM public.master_specification_versions version JOIN public.master_specifications specification ON specification.id = version.specification_id WHERE version.id = v_master_version_id AND version.version_number = v_source_version_number AND specification.opportunity_id = v_requirement.opportunity_id AND specification.customer_id = v_requirement.customer_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pinned Master Specification version is unavailable for the immutable requirement revision'; END IF;
  v_workstreams := v_master_version.specification_data->'workstreams';
  IF jsonb_typeof(v_workstreams) IS DISTINCT FROM 'array' OR jsonb_array_length(v_workstreams) = 0 OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_workstreams) AS workstream(value) WHERE jsonb_typeof(workstream.value) <> 'string' OR trim(both '"' FROM workstream.value::text) NOT IN ('HARDWARE', 'FIRMWARE', 'MECHANICAL', 'TEST', 'MANUFACTURING')) THEN RAISE EXCEPTION 'Master Specification workstreams are missing, null, non-string, unknown, or incomplete; applicability is TBC'; END IF;
  SELECT array_agg(department.id ORDER BY department.id) INTO v_required_department_ids FROM public.departments department WHERE department.code = ANY(ARRAY(SELECT jsonb_array_elements_text(v_workstreams)));
  IF v_required_department_ids IS NULL OR cardinality(v_required_department_ids) <> jsonb_array_length(v_workstreams) THEN RAISE EXCEPTION 'Master Specification workstreams do not map to verified departments; applicability is TBC'; END IF;
  SELECT count(*) INTO v_review_count FROM public.requirement_feasibility_reviews review WHERE review.source_revision_id = v_revision.id AND review.requirement_id = v_requirement.id AND review.source_revision_number = v_revision.revision_number AND review.master_specification_version_id = v_master_version.id AND review.master_specification_version_number = v_master_version.version_number AND review.applicable_workstreams = v_workstreams AND review.department_id = ANY(v_required_department_ids) AND review.status IN ('feasible', 'feasible_with_conditions');
  IF v_review_count <> cardinality(v_required_department_ids) THEN RAISE EXCEPTION 'Every applicable department requires a pinned terminal feasible review before baseline approval'; END IF;
  SELECT count(*) INTO v_unresolved_conditions FROM public.requirement_feasibility_reviews review WHERE review.source_revision_id = v_revision.id AND review.department_id = ANY(v_required_department_ids) AND review.status = 'feasible_with_conditions' AND (NULLIF(btrim(coalesce(review.assumptions, '')), '') IS NOT NULL OR NULLIF(btrim(coalesce(review.risks, '')), '') IS NOT NULL);
  IF v_unresolved_conditions > 0 THEN RAISE EXCEPTION 'Pinned feasibility reviews contain unresolved conditions or risks'; END IF;
  SELECT * INTO v_commercial FROM public.sales_commercial_records WHERE requirement_id = v_requirement.id FOR UPDATE;
  IF NOT FOUND OR v_commercial.status IS DISTINCT FROM 'customer_authorized' OR v_commercial.customer_authorized_at IS NULL OR NULLIF(btrim(coalesce(v_commercial.authorization_reference, '')), '') IS NULL THEN RAISE EXCEPTION 'Verified customer commercial authorization is required before baseline approval'; END IF;
  INSERT INTO public.requirement_baselines (requirement_id, baseline_number, revision_number, requirement_snapshot, commercial_snapshot, status, approved_by) VALUES (
    v_requirement.id, NULL, v_revision.revision_number,
    jsonb_build_object('requirement_id', v_requirement.id, 'requirement_number', v_requirement.requirement_number, 'title', v_requirement.title, 'source_revision_id', v_revision.id, 'source_revision_number', v_revision.revision_number, 'requirement_data', v_revision.requirement_data, 'master_specification_version_id', v_master_version.id, 'master_specification_version_number', v_master_version.version_number, 'applicable_workstreams', v_workstreams, 'feasibility_reviews', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', review.id, 'department_id', review.department_id, 'reviewer_user_id', review.reviewer_user_id, 'status', review.status, 'findings', review.findings, 'assumptions', review.assumptions, 'risks', review.risks, 'reviewed_at', review.reviewed_at, 'source_revision_id', review.source_revision_id, 'master_specification_version_id', review.master_specification_version_id) ORDER BY review.department_id), '[]'::jsonb) FROM public.requirement_feasibility_reviews review WHERE review.source_revision_id = v_revision.id AND review.department_id = ANY(v_required_department_ids))),
    jsonb_build_object('id', v_commercial.id, 'requirement_id', v_commercial.requirement_id, 'quotation_reference', v_commercial.quotation_reference, 'currency', v_commercial.currency, 'quoted_amount', v_commercial.quoted_amount, 'status', v_commercial.status, 'customer_authorized_at', v_commercial.customer_authorized_at, 'authorization_reference', v_commercial.authorization_reference, 'notes', v_commercial.notes), 'active', v_actor_id
  ) RETURNING * INTO v_baseline;
  INSERT INTO public.activity_log (actor_user_id, module_key, entity_type, entity_id, action, summary, after_data) VALUES (v_actor_id, 'sales', 'requirement_baseline', v_baseline.id, 'approved', 'Approved immutable requirement baseline.', jsonb_build_object('requirement_id', v_requirement.id, 'source_revision_id', v_revision.id, 'source_revision_number', v_revision.revision_number, 'master_specification_version_id', v_master_version.id, 'master_specification_version_number', v_master_version.version_number, 'commercial_record_id', v_commercial.id, 'request_key', p_request_key, 'baseline_number', v_baseline.baseline_number));
  INSERT INTO public.sales_baseline_approval_requests (request_key, requested_by, requirement_id, source_revision_id, master_specification_version_id, payload_hash, payload_canonical, baseline_id) VALUES (p_request_key, v_actor_id, v_requirement.id, v_revision.id, v_master_version.id, v_payload_hash, v_payload_canonical, v_baseline.id);
  RETURN v_baseline.id;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_sales_requirement_baseline(uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_sales_requirement_baseline(uuid, integer, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sales_baseline_approval_canonical_payload(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_baseline_approval_payload_hash(uuid, integer) FROM PUBLIC, anon, authenticated;

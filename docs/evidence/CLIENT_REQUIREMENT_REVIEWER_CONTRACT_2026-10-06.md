# Client Requirement & Reviewer Contract — Exact Review Export (2026-10-06 UTC)

Status: **pending source only**. Nothing in this document has been run against a database. It is a verbatim source export for independent review and must not be applied independently.

## Exact pending reviewer SQL

```sql
-- SOURCE-ONLY PROPOSAL. Do not apply before scoped client isolation, reviewer authorization,
-- response immutability, expiry/revocation, denial, rollback, optimistic-conflict, concurrency,
-- direct-table denial, and non-admin caller-RLS acceptance pass in an isolated backend.
-- Reuses the existing revisioned customer_requirements and requirement_feasibility_reviews tables.
-- No automatic approval, project conversion, quotation, or release is created by this contract.
-- This intentionally leaves direct external table RLS unchanged. The only proposed external
-- write entry point is the narrowly scoped SECURITY DEFINER routine below.

CREATE TABLE IF NOT EXISTS public.external_requirement_submission_requests (
  request_key uuid PRIMARY KEY,
  external_contact_id uuid NOT NULL REFERENCES public.external_contacts(id) ON DELETE RESTRICT,
  opportunity_id uuid NOT NULL REFERENCES public.sales_opportunities(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL,
  payload_hash text NOT NULL,
  payload_canonical jsonb NOT NULL,
  requirement_id uuid NOT NULL UNIQUE REFERENCES public.customer_requirements(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(payload_hash)) > 0),
  CHECK (jsonb_typeof(payload_canonical) = 'object')
);

-- Compatible with a previously applied draft receipt table. Existing rows without an exact
-- canonical payload are deliberately not replayable: submit them under a new request key.
ALTER TABLE public.external_requirement_submission_requests
  ADD COLUMN IF NOT EXISTS payload_canonical jsonb;

-- Match the clean-install receipt invariant on upgrades without invalidating legacy rows.
-- Existing NULL payloads remain deliberately non-replayable; new receipts are object-shaped.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint
    WHERE constraint.conrelid = 'public.external_requirement_submission_requests'::regclass
      AND constraint.conname = 'external_requirement_submission_requests_payload_canonical_check'
  ) THEN
    ALTER TABLE public.external_requirement_submission_requests
      ADD CONSTRAINT external_requirement_submission_requests_payload_canonical_check
      CHECK (payload_canonical IS NULL OR jsonb_typeof(payload_canonical) = 'object');
  END IF;
END;
$$;

REVOKE ALL ON TABLE public.external_requirement_submission_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.external_requirement_submission_requests TO service_role;
ALTER TABLE public.external_requirement_submission_requests ENABLE ROW LEVEL SECURITY;

-- This receipt follows the established `inventory_transaction_requests` shape: a caller-provided
-- UUID, an immutable normalized payload, a collision-detection hash, and the persisted result. This smaller receipt is
-- deliberately contact/opportunity/customer-bound so an external retry cannot replay across scope.

CREATE OR REPLACE FUNCTION public.external_requirement_submission_canonical_payload(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_title text,
  p_customer_reference text,
  p_requirement_data jsonb
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'opportunity_id', p_opportunity_id,
    'customer_id', p_customer_id,
    'title', btrim(p_title),
    'customer_reference', nullif(btrim(coalesce(p_customer_reference, '')), ''),
    'requirement_data', p_requirement_data
  )
$$;

CREATE OR REPLACE FUNCTION public.external_requirement_submission_payload_hash(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_title text,
  p_customer_reference text,
  p_requirement_data jsonb
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT md5(public.external_requirement_submission_canonical_payload(
    p_opportunity_id, p_customer_id, p_title, p_customer_reference, p_requirement_data
  )::text)
$$;

CREATE OR REPLACE FUNCTION public.external_requirement_scope_allows(
  p_opportunity_id uuid,
  p_customer_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.external_portal_access access
    WHERE access.external_contact_id = public.external_current_contact_id(auth.uid())
      AND access.is_active
      AND access.deactivated_at IS NULL
      AND access.invitation_revoked_at IS NULL
      AND (access.expires_at IS NULL OR access.expires_at > now())
      AND access.portal_type = 'CLIENT_REQUIREMENTS'
      AND jsonb_typeof(access.access_scope) = 'object'
      AND COALESCE(access.access_scope->'opportunityIds', '[]'::jsonb) @> jsonb_build_array(p_opportunity_id::text)
      AND COALESCE(access.access_scope->'customerIds', '[]'::jsonb) @> jsonb_build_array(p_customer_id::text)
  )
$$;

-- PostgreSQL overloads are distinct callable functions. Retire the pre-request-key prototype
-- explicitly rather than relying on CREATE OR REPLACE for the six-argument signature.
DO $$
BEGIN
  IF to_regprocedure('public.submit_external_customer_requirement(uuid,uuid,text,text,jsonb)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.submit_external_customer_requirement(uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role';
    EXECUTE 'DROP FUNCTION public.submit_external_customer_requirement(uuid,uuid,text,text,jsonb)';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_external_customer_requirement(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_title text,
  p_customer_reference text,
  p_requirement_data jsonb,
  p_request_key uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_requirement public.customer_requirements%ROWTYPE;
  v_contact_id uuid := public.external_current_contact_id(v_actor_id);
  v_party_id uuid := public.external_current_party_id();
  v_payload_canonical jsonb;
  v_payload_hash text;
  v_prior public.external_requirement_submission_requests%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL OR v_contact_id IS NULL OR v_party_id IS NULL THEN
    RAISE EXCEPTION 'An active external contact is required';
  END IF;
  IF p_request_key IS NULL THEN
    RAISE EXCEPTION 'A request key is required';
  END IF;
  IF jsonb_typeof(p_requirement_data) <> 'object'
    OR NULLIF(btrim(p_title), '') IS NULL
    OR NULLIF(btrim(p_requirement_data->>'description'), '') IS NULL THEN
    RAISE EXCEPTION 'Requirement title and description are required';
  END IF;
  -- The caller identity comes only from auth.uid(). Contact, party, expiry, revocation,
  -- and explicit opportunity/customer grants are all re-derived under the function owner.
  IF NOT public.external_requirement_scope_allows(p_opportunity_id, p_customer_id) THEN
    RAISE EXCEPTION 'Client requirement access is inactive, expired, revoked, or outside its granted scope';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.external_parties party
    WHERE party.id = v_party_id AND party.customer_id = p_customer_id
  ) THEN RAISE EXCEPTION 'Customer is outside the current external party scope'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_opportunities opportunity
    WHERE opportunity.id = p_opportunity_id AND opportunity.customer_id = p_customer_id
  ) THEN RAISE EXCEPTION 'Opportunity/customer source mismatch'; END IF;
  v_payload_canonical := public.external_requirement_submission_canonical_payload(
    p_opportunity_id, p_customer_id, p_title, p_customer_reference, p_requirement_data
  );
  v_payload_hash := public.external_requirement_submission_payload_hash(
    p_opportunity_id, p_customer_id, p_title, p_customer_reference, p_requirement_data
  );
  -- Mirror the established request-key receipt convention. The advisory lock covers the
  -- absent-receipt race; the locked receipt row handles every later replay.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  SELECT * INTO v_prior
  FROM public.external_requirement_submission_requests
  WHERE request_key = p_request_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_prior.requested_by = v_actor_id
       AND v_prior.external_contact_id = v_contact_id
       AND v_prior.opportunity_id = p_opportunity_id
       AND v_prior.customer_id = p_customer_id
       AND v_prior.payload_hash = v_payload_hash
       AND v_prior.payload_canonical IS NOT NULL
       AND v_prior.payload_canonical = v_payload_canonical THEN
      RETURN v_prior.requirement_id;
    END IF;
    RAISE EXCEPTION 'Request key conflicts with a different caller or payload';
  END IF;
  INSERT INTO public.customer_requirements (
    opportunity_id, customer_id, title, status, current_revision, customer_reference,
    requirement_data, submitted_at, created_by
  ) VALUES (
    p_opportunity_id, p_customer_id, p_title, 'submitted', 1, p_customer_reference,
    p_requirement_data, now(), v_actor_id
  ) RETURNING * INTO v_requirement;
  INSERT INTO public.customer_requirement_revisions (
    requirement_id, revision_number, change_summary, requirement_data, status, created_by
  ) VALUES (
    v_requirement.id, 1, 'Client-submitted requirement', p_requirement_data, 'submitted', v_actor_id
  );
  INSERT INTO public.activity_log (
    actor_user_id, module_key, entity_type, entity_id, action, summary, after_data
  ) VALUES (
    v_actor_id, 'sales', 'customer_requirement', v_requirement.id, 'external_submitted',
    'Client submitted a requirement.',
    jsonb_build_object(
      'opportunity_id', p_opportunity_id,
      'customer_id', p_customer_id,
      'external_contact_id', v_contact_id,
      'external_party_id', v_party_id,
      'request_key', p_request_key,
      'revision_number', 1
    )
  );
  INSERT INTO public.external_requirement_submission_requests (
    request_key, external_contact_id, opportunity_id, customer_id, requested_by, payload_hash, payload_canonical, requirement_id
  ) VALUES (
    p_request_key, v_contact_id, p_opportunity_id, p_customer_id, v_actor_id, v_payload_hash, v_payload_canonical, v_requirement.id
  );
  RETURN v_requirement.id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb, uuid) TO authenticated, service_role;
-- A clean installation has no former three-argument scope helper. Check the exact overload
-- before either privilege change or dependency-safe removal; never use CASCADE here.
DO $$
BEGIN
  IF to_regprocedure('public.external_requirement_scope_allows(uuid,uuid,uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.external_requirement_scope_allows(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role';
    EXECUTE 'DROP FUNCTION public.external_requirement_scope_allows(uuid,uuid,uuid)';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.external_requirement_scope_allows(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.external_requirement_submission_payload_hash(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.external_requirement_submission_canonical_payload(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- The applied Sales-all policy and table UPDATE grant permit direct feasibility writes. Replace
-- that one broad write path with two narrowly scoped protected routines: assignment can only
-- create/reassign an open review; a terminal response can only be appended by its assigned,
-- active engineering reviewer. Source requirement linkage is never mutable after creation.
--
-- Immutable provenance is added without backfilling legacy rows. A review made before this
-- proposal remains readable but is unsupported/unverified for planning. Each new assignment
-- pins the exact customer requirement revision and the Master Specification version that the
-- revision itself names in requirement_data.source. Header current_version is never consulted
-- for this source binding. Missing/invalid legacy source provenance remains unavailable.
ALTER TABLE public.requirement_feasibility_reviews
  ADD COLUMN IF NOT EXISTS source_revision_id uuid REFERENCES public.customer_requirement_revisions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_revision_number integer,
  ADD COLUMN IF NOT EXISTS master_specification_version_id uuid REFERENCES public.master_specification_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS master_specification_version_number integer,
  ADD COLUMN IF NOT EXISTS applicable_workstreams jsonb;

DO $$
DECLARE
  v_constraint record;
BEGIN
  -- Historical uniqueness is requirement/department scoped. Replace it only when it is exactly
  -- that shape, so a new revision receives a separate review without rewriting historic verdicts.
  FOR v_constraint IN
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'requirement_feasibility_reviews'
      AND constraint_type = 'UNIQUE'
      AND constraint_name <> 'requirement_feasibility_reviews_revision_department_key'
      AND (SELECT array_agg(key_column.column_name ORDER BY key_column.ordinal_position)
           FROM information_schema.key_column_usage key_column
           WHERE key_column.constraint_schema = 'public'
             AND key_column.constraint_name = table_constraints.constraint_name)
          = ARRAY['requirement_id', 'department_id']
  LOOP
    EXECUTE format('ALTER TABLE public.requirement_feasibility_reviews DROP CONSTRAINT %I', v_constraint.constraint_name);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.requirement_feasibility_reviews'::regclass
      AND conname = 'requirement_feasibility_reviews_revision_department_key'
  ) THEN
    ALTER TABLE public.requirement_feasibility_reviews
      ADD CONSTRAINT requirement_feasibility_reviews_revision_department_key
      UNIQUE (source_revision_id, department_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.customer_requirement_revisions'::regclass
      AND conname = 'customer_requirement_revisions_requirement_revision_key'
  ) THEN
    ALTER TABLE public.customer_requirement_revisions
      ADD CONSTRAINT customer_requirement_revisions_requirement_revision_key
      UNIQUE (requirement_id, revision_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.requirement_feasibility_reviews'::regclass
      AND conname = 'requirement_feasibility_reviews_pinned_source_check'
  ) THEN
    ALTER TABLE public.requirement_feasibility_reviews
      ADD CONSTRAINT requirement_feasibility_reviews_pinned_source_check CHECK (
        (source_revision_id IS NULL AND source_revision_number IS NULL
          AND master_specification_version_id IS NULL AND master_specification_version_number IS NULL
          AND applicable_workstreams IS NULL)
        OR
        (source_revision_id IS NOT NULL AND source_revision_number IS NOT NULL
          AND master_specification_version_id IS NOT NULL AND master_specification_version_number IS NOT NULL
          AND applicable_workstreams IS NOT NULL
          AND jsonb_typeof(applicable_workstreams) = 'array')
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS requirement_feasibility_reviews_source_revision_idx
  ON public.requirement_feasibility_reviews(source_revision_id);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.requirement_feasibility_reviews FROM authenticated;
DROP POLICY IF EXISTS "Sales users manage feasibility reviews" ON public.requirement_feasibility_reviews;

CREATE OR REPLACE FUNCTION public.assign_requirement_feasibility_review(
  p_requirement_id uuid,
  p_department_id uuid,
  p_reviewer_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_review public.requirement_feasibility_reviews%ROWTYPE;
  v_requirement public.customer_requirements%ROWTYPE;
  v_revision public.customer_requirement_revisions%ROWTYPE;
  v_master_version public.master_specification_versions%ROWTYPE;
  v_master_version_id uuid;
  v_source_opportunity_id uuid;
  v_source_customer_id uuid;
  v_source_version_number integer;
  v_workstreams jsonb;
  v_review_found boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'sales.manage') THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;
  IF p_requirement_id IS NULL OR p_department_id IS NULL OR p_reviewer_user_id IS NULL THEN
    RAISE EXCEPTION 'Requirement, department, and reviewer are required';
  END IF;

  -- All protected routines lock source rows in this order: requirement, revision, review, version.
  SELECT * INTO v_requirement
  FROM public.customer_requirements
  WHERE id = p_requirement_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Feasibility source requirement is unavailable'; END IF;

  SELECT * INTO v_revision
  FROM public.customer_requirement_revisions
  WHERE requirement_id = v_requirement.id
    AND revision_number = v_requirement.current_revision
  FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current immutable customer requirement revision is unavailable'; END IF;

  IF jsonb_typeof(v_revision.requirement_data) IS DISTINCT FROM 'object'
     OR NULLIF(v_revision.requirement_data #>> '{source,master_specification_version_id}', '') IS NULL THEN
    RAISE EXCEPTION 'Current immutable customer requirement revision lacks a Master Specification version source; legacy provenance is unavailable';
  END IF;
  BEGIN
    v_master_version_id := (v_revision.requirement_data #>> '{source,master_specification_version_id}')::uuid;
    v_source_opportunity_id := (v_revision.requirement_data #>> '{source,opportunity_id}')::uuid;
    v_source_customer_id := (v_revision.requirement_data #>> '{source,customer_id}')::uuid;
    v_source_version_number := (v_revision.requirement_data #>> '{source,master_specification_version_number}')::integer;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Current immutable customer requirement revision has an invalid Master Specification source tuple';
  END;
  IF v_source_opportunity_id IS NULL OR v_source_customer_id IS NULL OR v_source_version_number IS NULL THEN
    RAISE EXCEPTION 'Current immutable customer requirement revision lacks a complete Master Specification source tuple; legacy provenance is unavailable';
  END IF;
  IF v_source_opportunity_id IS DISTINCT FROM v_requirement.opportunity_id
     OR v_source_customer_id IS DISTINCT FROM v_requirement.customer_id THEN
    RAISE EXCEPTION 'Current immutable customer requirement revision source does not match its requirement opportunity and customer';
  END IF;

  SELECT * INTO v_review
  FROM public.requirement_feasibility_reviews
  WHERE source_revision_id = v_revision.id
    AND department_id = p_department_id
  FOR UPDATE;
  v_review_found := FOUND;

  SELECT version.* INTO v_master_version
  FROM public.master_specification_versions version
  JOIN public.master_specifications specification ON specification.id = version.master_specification_id
  WHERE version.id = v_master_version_id
    AND version.version_number = v_source_version_number
    AND specification.opportunity_id = v_requirement.opportunity_id
    AND specification.customer_id = v_requirement.customer_id
  FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pinned Master Specification version is unavailable for the immutable requirement revision'; END IF;

  v_workstreams := v_master_version.specification_data->'workstreams';
  IF jsonb_typeof(v_workstreams) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Master Specification workstreams are missing, null, non-string, unknown, or incomplete; applicability is TBC';
  END IF;
  IF jsonb_array_length(v_workstreams) = 0
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_workstreams) AS workstream(value)
       WHERE jsonb_typeof(workstream.value) <> 'string'
          OR trim(both '"' FROM workstream.value::text) NOT IN ('HARDWARE', 'FIRMWARE', 'MECHANICAL', 'TEST', 'MANUFACTURING')
     ) THEN
    RAISE EXCEPTION 'Master Specification workstreams are missing, null, non-string, unknown, or incomplete; applicability is TBC';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees employee
    JOIN public.employee_departments membership ON membership.employee_id = employee.id
    WHERE employee.user_id = p_reviewer_user_id
      AND employee.employment_status = 'ACTIVE'
      AND membership.department_id = p_department_id
  ) THEN RAISE EXCEPTION 'Assigned reviewer is not an active member of the selected department'; END IF;

  IF v_review_found THEN
    IF v_review.status NOT IN ('pending', 'in_review') THEN
      RAISE EXCEPTION 'A terminal review is immutable history; a new requirement revision is required for another feasibility review';
    END IF;
    IF v_review.source_revision_number IS DISTINCT FROM v_revision.revision_number
       OR v_review.master_specification_version_id IS DISTINCT FROM v_master_version.id
       OR v_review.master_specification_version_number IS DISTINCT FROM v_master_version.version_number
       OR v_review.applicable_workstreams IS DISTINCT FROM v_workstreams THEN
      RAISE EXCEPTION 'Open feasibility review is pinned to different immutable provenance';
    END IF;
    UPDATE public.requirement_feasibility_reviews
    SET reviewer_user_id = p_reviewer_user_id, status = 'pending', findings = NULL,
        assumptions = NULL, risks = NULL, reviewed_at = NULL
    WHERE id = v_review.id;
  ELSE
    INSERT INTO public.requirement_feasibility_reviews (
      requirement_id, department_id, reviewer_user_id, status, created_by,
      source_revision_id, source_revision_number,
      master_specification_version_id, master_specification_version_number, applicable_workstreams
    ) VALUES (
      p_requirement_id, p_department_id, p_reviewer_user_id, 'pending', auth.uid(),
      v_revision.id, v_revision.revision_number,
      v_master_version.id, v_master_version.version_number, v_workstreams
    ) RETURNING id INTO v_review.id;
  END IF;

  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary, after_data)
  VALUES (
    auth.uid(), 'sales', 'requirement_feasibility', v_review.id, 'assigned',
    'Engineering feasibility review assigned.',
    jsonb_build_object(
      'requirement_id', p_requirement_id, 'source_revision_id', v_revision.id,
      'source_revision_number', v_revision.revision_number,
      'master_specification_version_id', v_master_version.id,
      'master_specification_version_number', v_master_version.version_number,
      'applicable_workstreams', v_workstreams, 'department_id', p_department_id,
      'reviewer_user_id', p_reviewer_user_id, 'status', 'pending'
    )
  );
  RETURN v_review.id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_requirement_feasibility_review(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_requirement_feasibility_review(uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_requirement_feasibility_response(
  p_review_id uuid,
  p_status text,
  p_findings text,
  p_assumptions text,
  p_risks text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_review public.requirement_feasibility_reviews%ROWTYPE;
  v_requirement public.customer_requirements%ROWTYPE;
  v_revision public.customer_requirement_revisions%ROWTYPE;
  v_master_version public.master_specification_versions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'engineering.manage') THEN
    RAISE EXCEPTION 'Engineering management permission is required';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('feasible', 'feasible_with_conditions', 'not_feasible')
     OR NULLIF(btrim(p_findings), '') IS NULL THEN
    RAISE EXCEPTION 'A terminal feasibility verdict and findings are required';
  END IF;

  -- Match assignment's order: requirement, revision, review, version. The review ID is resolved
  -- without a row lock first so the requirement can be the first locked mutable source row.
  SELECT * INTO v_review FROM public.requirement_feasibility_reviews WHERE id = p_review_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Feasibility review is unavailable'; END IF;
  SELECT * INTO v_requirement FROM public.customer_requirements
  WHERE id = v_review.requirement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Feasibility review source requirement is unavailable'; END IF;
  SELECT * INTO v_revision FROM public.customer_requirement_revisions
  WHERE id = v_review.source_revision_id AND requirement_id = v_requirement.id
    AND revision_number = v_review.source_revision_number FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pinned customer requirement revision is unavailable'; END IF;
  SELECT * INTO v_review FROM public.requirement_feasibility_reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Feasibility review is unavailable'; END IF;

  IF v_review.source_revision_id IS NULL OR v_review.source_revision_number IS NULL
     OR v_review.master_specification_version_id IS NULL OR v_review.master_specification_version_number IS NULL
     OR jsonb_typeof(v_review.applicable_workstreams) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Feasibility review lacks immutable provenance and cannot receive a protected response';
  END IF;
  SELECT version.* INTO v_master_version FROM public.master_specification_versions version
  JOIN public.master_specifications specification ON specification.id = version.master_specification_id
  WHERE version.id = v_review.master_specification_version_id
    AND version.version_number = v_review.master_specification_version_number
    AND specification.opportunity_id = v_requirement.opportunity_id
    AND specification.customer_id = v_requirement.customer_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pinned Master Specification version is unavailable'; END IF;
  IF v_review.reviewer_user_id IS NULL OR v_review.department_id IS NULL THEN
    RAISE EXCEPTION 'Feasibility review requires an assigned reviewer and department';
  END IF;
  IF v_review.reviewer_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the assigned reviewer may submit this feasibility response';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employees employee
    JOIN public.employee_departments membership ON membership.employee_id = employee.id
    WHERE employee.user_id = auth.uid() AND employee.employment_status = 'ACTIVE'
      AND membership.department_id = v_review.department_id
  ) THEN RAISE EXCEPTION 'The assigned reviewer is not an active member of this review department'; END IF;
  IF v_review.status NOT IN ('pending', 'in_review') THEN
    RAISE EXCEPTION 'Feasibility review is not open for a response';
  END IF;

  UPDATE public.requirement_feasibility_reviews
  SET status = p_status, findings = p_findings, assumptions = p_assumptions,
      risks = p_risks, reviewed_at = now()
  WHERE id = v_review.id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary, after_data)
  VALUES (
    auth.uid(), 'engineering', 'requirement_feasibility', v_review.id, 'responded',
    'Engineering feasibility response recorded.',
    jsonb_build_object(
      'requirement_id', v_review.requirement_id, 'source_revision_id', v_review.source_revision_id,
      'source_revision_number', v_review.source_revision_number,
      'master_specification_version_id', v_review.master_specification_version_id,
      'master_specification_version_number', v_review.master_specification_version_number,
      'applicable_workstreams', v_review.applicable_workstreams,
      'opportunity_id', v_requirement.opportunity_id, 'customer_id', v_requirement.customer_id,
      'department_id', v_review.department_id, 'reviewer_user_id', v_review.reviewer_user_id,
      'status', p_status
    )
  );
  RETURN v_review.id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) TO authenticated, service_role;

-- Direct external table RLS is deliberately unchanged: this routine is the only proposed
-- external write path. It derives the authenticated actor, contact, party, active/revoked/
-- expired grant and opportunity/customer scope before its atomic requirement, revision, and
-- audit inserts. The acceptance runner must prove direct reads/writes remain denied.
```

## Exact façade source

### Engineering response façade — `src/lib/client-requirement-intake.functions.ts`

```ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientRequirementIntakeSchema, feasibilityResponseSchema } from "./client-requirement-intake";

async function requireEngineeringManage(sb: any, userId: string) {
  const { data, error } = await sb.rpc("has_permission", { _user_id: userId, _permission_key: "engineering.manage" });
  if (error || !data) throw new Error("You do not have permission to manage engineering feasibility.");
}

export const submitClientRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => clientRequirementIntakeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: requirementId, error } = await (context.supabase as any).rpc("submit_external_customer_requirement", {
      p_opportunity_id: data.opportunityId,
      p_customer_id: data.customerId,
      p_title: data.title,
      p_customer_reference: data.customerReference,
      p_requirement_data: { description: data.description },
      p_request_key: data.requestKey,
    });
    if (error || typeof requirementId !== "string") throw new Error(error?.message ?? "Could not submit the requirement.");
    return { requirementId };
  });

export const recordAssignedFeasibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => feasibilityResponseSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireEngineeringManage(sb, context.userId);
    const { data: review, error } = await sb.rpc("record_requirement_feasibility_response", {
      p_review_id: data.reviewId,
      p_status: data.verdict,
      p_findings: data.findings,
      p_assumptions: data.assumptions,
      p_risks: data.risks,
    });
    if (error || typeof review !== "string") throw new Error(error?.message ?? "Could not record the feasibility response.");
    return { reviewId: review };
  });
```

### Sales assignment façade — extract from `src/lib/sales.functions.ts`

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const nullable = (max: number) => z.string().trim().max(max).nullable();
const customerSchema = z.object({ legalName: z.string().trim().min(2).max(240), displayName: nullable(240), customerType: z.enum(["prospect", "customer", "partner", "other"]), industry: nullable(160), primaryEmail: z.string().trim().email().max(254).nullable(), primaryPhone: nullable(64), accountOwnerUserId: z.string().uuid().nullable(), createAnywayReason: nullable(500) });
const contactSchema = z.object({ customerId: z.string().uuid(), fullName: z.string().trim().min(2).max(160), jobTitle: nullable(160), email: z.string().trim().email().max(254).nullable(), phone: nullable(64), mobile: nullable(64), isPrimary: z.boolean() });
const enquirySchema = z.object({ enquiryNumber: z.string().trim().max(64).nullable(), customerId: z.string().uuid().nullable(), contactId: z.string().uuid().nullable(), source: z.enum(["manual", "website", "email", "gmail", "referral", "existing_customer", "marketing", "other"]), enquiryDate: z.string().min(10), requirementSummary: z.string().trim().min(3).max(4000), application: nullable(240), productType: nullable(240), estimatedVolume: nullable(240), expectedTimeline: nullable(240), priority: z.enum(["low", "medium", "high", "urgent"]), salesOwnerUserId: z.string().uuid().nullable(), nextAction: nullable(1000), nextActionDate: z.string().min(10).nullable() });
const opportunitySchema = z.object({ opportunityNumber: z.string().trim().max(64).nullable(), customerId: z.string().uuid(), contactId: z.string().uuid().nullable(), enquiryId: z.string().uuid().nullable(), name: z.string().trim().min(3).max(240), application: nullable(240), productType: nullable(240), primarySalesOwnerUserId: z.string().uuid().nullable(), ndaRequired: z.boolean(), estimatedVolume: nullable(240), targetTimeline: nullable(240), priority: z.enum(["low", "medium", "high", "urgent"]), nextAction: nullable(1000), nextActionDate: z.string().min(10).nullable() });
const ndaSchema = z.object({ opportunityId: z.string().uuid(), status: z.enum(["not_required", "draft", "sent", "signed", "expired", "declined"]), signedByName: nullable(160), signedByEmail: z.string().trim().email().max(254).nullable(), expiryDate: z.string().min(10).nullable(), notes: nullable(4000) });
const feasibilityAssignmentSchema = z.object({ requirementId: z.string().uuid(), departmentId: z.string().uuid(), reviewerUserId: z.string().uuid() });
const commercialSchema = z.object({ requirementId: z.string().uuid(), quotationReference: nullable(160), currency: z.string().trim().min(3).max(8), quotedAmount: z.number().nonnegative().nullable(), status: z.enum(["draft", "internal_review", "sent", "customer_authorized", "declined", "expired"]), authorizationReference: nullable(240), notes: nullable(4000) });
const baselineSchema = z.object({ requirementId: z.string().uuid() });
const portalSchema = z.object({ customerId: z.string().uuid(), contactId: z.string().uuid().nullable(), label: z.string().trim().min(2).max(160), expiresAt: z.string().min(10).nullable() });
const handoverSchema = z.object({ baselineId: z.string().uuid(), handoverNotes: nullable(4000) });

async function requireSales(sb: any, userId: string) { const { data, error } = await sb.rpc("has_permission", { _user_id: userId, _permission_key: "sales.manage" }); if (error || !data) throw new Error("You do not have permission to manage sales records."); }
async function logSalesActivity(sb: any, userId: string, entityType: string, entityId: string, action: string, summary: string) { const { error } = await sb.from("activity_log").insert({ actor_user_id: userId, module_key: "sales", entity_type: entityType, entity_id: entityId, action, summary }); if (error) throw new Error(error.message); }

export const createCustomer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => customerSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const normalizedName = data.legalName.replace(/\s+/g, " ").trim(); const { data: nameMatches, error: nameError } = await sb.from("customers").select("id,customer_code,legal_name,primary_email,primary_phone").neq("status", "archived").ilike("legal_name", normalizedName).limit(5); const { data: emailMatches, error: emailError } = data.primaryEmail ? await sb.from("customers").select("id,customer_code,legal_name,primary_email,primary_phone").neq("status", "archived").eq("primary_email", data.primaryEmail).limit(5) : { data: [], error: null }; const { data: phoneMatches, error: phoneError } = data.primaryPhone ? await sb.from("customers").select("id,customer_code,legal_name,primary_email,primary_phone").neq("status", "archived").eq("primary_phone", data.primaryPhone).limit(5) : { data: [], error: null }; if (nameError || emailError || phoneError) throw new Error("Could not check existing customers."); const matches = [...new Map([...(nameMatches ?? []), ...(emailMatches ?? []), ...(phoneMatches ?? [])].map((item: any) => [item.id, item])).values()]; if (matches.length && !data.createAnywayReason) throw new Error(`Possible existing customer: ${(matches ?? []).map((item: any) => `${item.customer_code} — ${item.legal_name}`).join("; ")}. Use the existing customer or confirm why a new record is needed.`); const { data: customer, error } = await sb.from("customers").insert({ legal_name: normalizedName, display_name: data.displayName, customer_type: data.customerType, industry: data.industry, primary_email: data.primaryEmail, primary_phone: data.primaryPhone, account_owner_user_id: data.accountOwnerUserId, created_by: context.userId }).select("id,customer_code").single(); if (error || !customer) throw new Error(error?.message ?? "Could not create customer."); await logSalesActivity(sb, context.userId, "customer", customer.id, "created", `Created customer: ${customer.customer_code} — ${normalizedName}`); if (data.createAnywayReason) await logSalesActivity(sb, context.userId, "customer", customer.id, "duplicate_override", data.createAnywayReason); return { id: customer.id, customerCode: customer.customer_code }; });
export const createCustomerContact = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => contactSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: contact, error } = await sb.from("customer_contacts").insert({ customer_id: data.customerId, full_name: data.fullName, job_title: data.jobTitle, email: data.email, phone: data.phone, mobile: data.mobile, is_primary: data.isPrimary, created_by: context.userId }).select("id").single(); if (error || !contact) throw new Error(error?.message ?? "Could not create customer contact."); await logSalesActivity(sb, context.userId, "customer_contact", contact.id, "created", `Created customer contact: ${data.fullName}`); return { id: contact.id }; });
export const createSalesEnquiry = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => enquirySchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: enquiry, error } = await sb.from("sales_enquiries").insert({ enquiry_number: data.enquiryNumber, customer_id: data.customerId, contact_id: data.contactId, source: data.source, enquiry_date: data.enquiryDate, requirement_summary: data.requirementSummary, application: data.application, product_type: data.productType, estimated_volume: data.estimatedVolume, expected_timeline: data.expectedTimeline, priority: data.priority, sales_owner_user_id: data.salesOwnerUserId, next_action: data.nextAction, next_action_date: data.nextActionDate, created_by: context.userId }).select("id,enquiry_number").single(); if (error || !enquiry) throw new Error(error?.message ?? "Could not create enquiry."); await logSalesActivity(sb, context.userId, "sales_enquiry", enquiry.id, "created", `Created enquiry: ${enquiry.enquiry_number ?? "auto-numbered"}`); return { id: enquiry.id, enquiryNumber: enquiry.enquiry_number }; });
export const createSalesOpportunity = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => opportunitySchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: opportunity, error } = await sb.from("sales_opportunities").insert({ opportunity_number: data.opportunityNumber, customer_id: data.customerId, primary_contact_id: data.contactId, enquiry_id: data.enquiryId, name: data.name, application: data.application, product_type: data.productType, primary_sales_owner_user_id: data.primarySalesOwnerUserId, nda_required: data.ndaRequired, estimated_volume: data.estimatedVolume, target_timeline: data.targetTimeline, priority: data.priority, next_action: data.nextAction, next_action_date: data.nextActionDate, created_by: context.userId }).select("id,opportunity_number").single(); if (error || !opportunity) throw new Error(error?.message ?? "Could not create opportunity."); await logSalesActivity(sb, context.userId, "sales_opportunity", opportunity.id, "created", `Created opportunity: ${data.name}`); return { id: opportunity.id, opportunityNumber: opportunity.opportunity_number }; });
export const saveNdaRecord = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => ndaSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const signedAt = data.status === "signed" ? new Date().toISOString() : null; const { data: record, error } = await sb.from("sales_nda_records").upsert({ opportunity_id: data.opportunityId, status: data.status, signed_by_name: data.signedByName, signed_by_email: data.signedByEmail, signed_at: signedAt, expiry_date: data.expiryDate, notes: data.notes, created_by: context.userId }, { onConflict: "opportunity_id" }).select("id").single(); if (error || !record) throw new Error(error?.message ?? "Could not save the NDA record."); await sb.from("sales_opportunities").update({ stage: data.status === "signed" || data.status === "not_required" ? "requirement_pending" : "nda_pending" }).eq("id", data.opportunityId); await logSalesActivity(sb, context.userId, "sales_nda_record", record.id, "saved", `Updated NDA status: ${data.status}`); return { id: record.id }; });
/**
 * Intentionally unavailable: the accepted compatibility migration removes this
 * legacy multi-call path instead of redirecting it to an unaccepted RPC. New
 * requirement creation stays exclusively behind createSalesBoundCustomerRequirement.
 */
export const createCustomerRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(() => {
    throw new Error("Legacy customer requirement creation is retired. Use the protected source-bound requirement flow after database acceptance.");
  });
export const assignFeasibilityReview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => feasibilityAssignmentSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: reviewId, error } = await sb.rpc("assign_requirement_feasibility_review", { p_requirement_id: data.requirementId, p_department_id: data.departmentId, p_reviewer_user_id: data.reviewerUserId }); if (error || typeof reviewId !== "string") throw new Error(error?.message ?? "Could not assign feasibility review."); return { id: reviewId }; });
export const saveCommercialRecord = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => commercialSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: record, error } = await sb.from("sales_commercial_records").upsert({ requirement_id: data.requirementId, quotation_reference: data.quotationReference, currency: data.currency, quoted_amount: data.quotedAmount, status: data.status, authorization_reference: data.authorizationReference, customer_authorized_at: data.status === "customer_authorized" ? new Date().toISOString() : null, notes: data.notes, created_by: context.userId }, { onConflict: "requirement_id" }).select("id").single(); if (error || !record) throw new Error(error?.message ?? "Could not save commercial record."); await logSalesActivity(sb, context.userId, "sales_commercial_record", record.id, "saved", `Commercial status: ${data.status}`); return { id: record.id }; });
/**
 * Deliberately fail-closed: the applied feasibility table cannot bind a terminal
 * verdict to an immutable requirement revision, and no replay-safe baseline
 * receipt exists. A baseline must not be created until that separate contract
 * is accepted through real caller-authenticated isolated evidence.
 */
export const createRequirementBaseline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => baselineSchema.parse(data))
  .handler(async ({ data, context }) => {
    void data;
    void context;
    throw new Error("Baseline approval is unavailable until revision-bound feasibility and replay-safe baseline contracts pass isolated caller-authenticated acceptance.");
  });
export const createCustomerPortalAccess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => portalSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: portal, error } = await sb.from("customer_portal_access").insert({ customer_id: data.customerId, contact_id: data.contactId, label: data.label, expires_at: data.expiresAt, created_by: context.userId }).select("id,access_token").single(); if (error || !portal) throw new Error(error?.message ?? "Could not create portal access."); await logSalesActivity(sb, context.userId, "customer_portal_access", portal.id, "created", `Created customer portal access: ${data.label}`); return { id: portal.id, token: portal.access_token }; });
export const initiateSalesHandover = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => handoverSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: handover, error } = await sb.from("sales_project_handovers").upsert({ baseline_id: data.baselineId, status: "initiated", handover_notes: data.handoverNotes, initiated_by: context.userId, initiated_at: new Date().toISOString() }, { onConflict: "baseline_id" }).select("id").single(); if (error || !handover) throw new Error(error?.message ?? "Could not initiate handover."); await sb.from("requirement_baselines").update({ status: "project_initiated" }).eq("id", data.baselineId); await logSalesActivity(sb, context.userId, "sales_project_handover", handover.id, "initiated", "Initiated approved-baseline project handover"); return { id: handover.id }; });
```

## Exact structural acceptance source

```sql
-- ISOLATED MANAGED BACKEND ONLY. SOURCE-ONLY acceptance contract for
-- 20261005_client_requirement_intake.sql. It does not create identities or modify production data.
-- Required psql variables: scoped_external_jwt, expired_external_jwt, revoked_external_jwt,
-- outsider_jwt, reviewer_jwt, opportunity_id, customer_id, wrong_customer_id,
-- requirement_review_id. Run every mutation case in a separate transaction and ROLLBACK.
--
-- Cases to execute with separate authenticated sessions:
-- 0. clean install: run the proposal where neither legacy overload exists; it completes without
--    attempting REVOKE on either absent signature. Upgrade: install the former 3-argument scope
--    helper and former 5-argument submit helper with no dependents, then run the proposal and
--    prove both exact signatures no longer exist or have EXECUTE for any role.
--    Receipt upgrade: start with a former receipt table lacking payload_canonical and one legacy
--    receipt. The proposal adds the nullable object-shape constraint; legacy replay fails closed,
--    while a fresh request key persists a non-null object-shaped canonical payload.
-- 1. outsider: RPC fails before a row/audit record is visible; direct requirement/revision/audit reads and writes fail.
-- 2. expired, revoked, and unscoped contact: each RPC call fails and creates no requirement/revision/audit.
-- 3. wrong opportunity/customer pairing: fails before a row/audit record is visible.
-- 4. correctly scoped caller: exactly one requirement + revision 1 + audit record commits with actor/contact/party provenance.
-- 5. same scoped caller + same request key + identical payload replays the original requirement ID without a second header, revision, or audit.
-- 6. same request key with a changed title, reference, description, opportunity, customer, or caller fails without a new row.
-- 7. two scoped sessions using the same caller, request key, and payload concurrently converge to one receipt and one requirement.
-- 8. forced audit failure: requirement and revision roll back together (no partial submission).
-- 9. reviewer: protected assignment locks the requirement, pins its exact current immutable
--    revision plus the current Master Specification version and verified workstreams. A repeated
--    assignment with the same reviewer/source is an exact retry and returns the existing review;
--    reassignment and response must not mutate the pinned provenance.
--    record_requirement_feasibility_response succeeds exactly once; retry fails as immutable.
-- 10. concurrency: two reviewer sessions race the same review; one commits and the other receives the immutable
--    conflict, leaving exactly one terminal response and one response audit event.
-- 11. direct review UPDATE: no authenticated caller has INSERT/UPDATE/DELETE table privilege,
--    and the former Sales-all policy is absent. A marker-set direct UPDATE attempt (including
--    set_config('app.requirement_feasibility_response_rpc', '1', true)) fails. Direct terminal
--    reassignment, source requirement replacement, reviewer replacement, and deletion fail.
--    Direct source_revision_id, Master-version, or applicability mutation also fails.
--    assign_requirement_feasibility_review remains the only compatible pending assignment path.
-- 12. successful protected response writes exactly one activity_log row whose after_data binds the
--    review's requirement_id, requirement opportunity/customer, department, assigned reviewer, and terminal status.
--    Force that audit insert to fail in the isolated backend and prove the response update rolls back.
--
-- Preflight in the scoped external session (must be false; no direct table access is introduced):
-- SELECT has_table_privilege('authenticated', 'public.customer_requirements', 'INSERT') AS direct_requirement_insert;
-- SELECT has_table_privilege('authenticated', 'public.customer_requirement_revisions', 'INSERT') AS direct_revision_insert;
-- SELECT has_table_privilege('authenticated', 'public.activity_log', 'INSERT') AS direct_audit_insert;
-- SELECT has_function_privilege('authenticated',
--   'public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb, uuid)', 'EXECUTE') AS scoped_rpc_execute;
-- Feasibility privilege/policy preflight after the proposal:
-- SELECT NOT has_table_privilege('authenticated', 'public.requirement_feasibility_reviews', 'INSERT') AS no_direct_review_insert;
-- SELECT NOT has_table_privilege('authenticated', 'public.requirement_feasibility_reviews', 'UPDATE') AS no_direct_review_update;
-- SELECT NOT has_table_privilege('authenticated', 'public.requirement_feasibility_reviews', 'DELETE') AS no_direct_review_delete;
-- SELECT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
--   AND tablename = 'requirement_feasibility_reviews' AND policyname = 'Sales users manage feasibility reviews') AS sales_write_policy_removed;
-- No five-argument overload may remain callable after this proposal:
-- SELECT count(*) = 0 AS no_legacy_five_argument_overload
-- FROM pg_proc procedure
-- JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
-- WHERE namespace.nspname = 'public'
--   AND procedure.proname = 'submit_external_customer_requirement'
--   AND pg_get_function_identity_arguments(procedure.oid) = 'p_opportunity_id uuid, p_customer_id uuid, p_title text, p_customer_reference text, p_requirement_data jsonb';
-- SELECT has_function_privilege('authenticated',
--   'public.external_requirement_scope_allows(uuid, uuid)', 'EXECUTE') = false AS no_external_scope_oracle;
-- SELECT to_regprocedure('public.external_requirement_scope_allows(uuid,uuid,uuid)') IS NULL AS no_legacy_scope_helper;
--
-- Example caller-authenticated session setup (supply a JWT through a secure runner; never commit a token):
-- BEGIN;
-- SELECT set_config('request.jwt.claim.sub', :'scoped_external_user_id', true);
-- SELECT set_config('role', 'authenticated', true);
-- SELECT public.submit_external_customer_requirement(
--   :'opportunity_id'::uuid, :'customer_id'::uuid, 'Acceptance-only external requirement',
--   'EXT-ACCEPTANCE', jsonb_build_object('description', 'Acceptance-only submission; transaction will roll back.'),
--   :'request_key'::uuid
-- );
-- ROLLBACK;
--
-- Required assertions after the successful scoped call, before ROLLBACK:
-- * header has submitted status, current_revision = 1, and created_by = scoped authenticated actor.
-- * revision has revision_number = 1, submitted status, same created_by, and exact immutable payload.
-- * audit after_data has the verified opportunity/customer/contact/party identifiers and revision_number = 1.
-- * audit after_data has the request_key, matching the stored receipt.
-- * scoped external caller still cannot SELECT the new header/revision/audit directly through RLS.

-- Retry/replay assertion: repeat the same authenticated call with the same request_key and byte-equivalent
-- request payload. It must return the same requirement ID. The receipt table must contain exactly one row
-- for request_key, and the header/revision/audit counts for that ID must each remain one.
--
-- Key-reuse conflict assertion: using the same request_key with a changed title, customer reference,
-- description, opportunity, customer, or authenticated caller must raise
-- "Request key conflicts with a different caller or payload" and create no rows.
--
-- Same-key concurrency assertion: execute two authenticated sessions concurrently with the same caller,
-- request_key, and exact payload. Both must return the same requirement ID; after commit, exactly one
-- external_requirement_submission_requests row, one customer_requirements row, one revision 1 row,
-- and one external_submitted audit row may exist for that receipt.
-- The receipt's persisted canonical payload must exactly equal
-- public.external_requirement_submission_canonical_payload(opportunity, customer, title, reference, data).
-- Reuse of the key with a changed canonical payload must fail even if an MD5 collision were supplied.
--
-- Forced audit rollback case: run against a disposable acceptance configuration that rejects
-- only this function's `external_submitted` audit insert, then prove no header or revision
-- persists. Do not simulate this with a service-role or bypass-RLS executor.
--
-- Reviewer rollback and provenance case: run record_requirement_feasibility_response in a
-- disposable configuration that rejects its `responded` audit insert. The review must remain
-- pending/in_review with its original fields. On a successful call, compare activity_log.after_data
-- to the locked review and source requirement; direct terminal field UPDATE must fail even when the
-- caller's existing RLS policy otherwise permits UPDATE.
--
-- Reviewer assignment/terminal invariants: prove assignment routine rejects a non-member reviewer;
-- prove it creates only pending reviews and may reset/reassign only pending/in_review reviews,
-- including a repeat assignment to the same reviewer. Prove the exact retry returns the existing review;
-- reassignment and response must not mutate the pinned provenance. A requirement revision or Master
-- Specification version advance must not alter historic reviews; pinned terminal decisions then read
-- as stale and cannot satisfy planning. Missing or unknown workstreams fail closed as TBC. Prove each assignment creates exactly one
-- `assigned` activity entry with its locked requirement/department/reviewer identifiers. After a
-- terminal response, attempts to change requirement_id, department_id, reviewer_user_id, status,
-- findings, assumptions, risks, or reviewed_at must all fail, including when a caller manually
-- sets the former app.requirement_feasibility_response_rpc GUC. Audit failure must roll back the
-- terminal update and preserve the original requirement_id and department/reviewer assignment.
```

## Acceptance boundary

- The SQL and harness remain source-only. The structural SQL uses no service-role credential as proof and cannot establish caller-authenticated RLS behavior.
- Real caller-transport acceptance remains blocked on the approved isolated target, scoped Sales/reviewer identities, and an authenticated application-RPC runner.
- Legacy feasibility rows receive no inferred or backfilled provenance. They remain readable but resolve to **unsupported/unverified** in planning.
- Protected assignment pins the current requirement revision, Master Specification version, and validated workstreams. A source advance leaves historic decisions unchanged; read-only planning reports them **stale**.
- Unknown or malformed workstreams remain **TBC** and block planning.

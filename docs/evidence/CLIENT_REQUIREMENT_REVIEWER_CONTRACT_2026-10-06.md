# Client Requirement & Reviewer Contract — Exact Review Export (2026-10-06 UTC)

Status: **pending source only**. Nothing in this document has been run against a database. It is a verbatim source export for independent review and must not be applied independently.

## Observed authoritative schema evidence (read-only query, 2026-10-06 UTC)

Observed through a read-only backend catalog query; no pending source was applied:

```text
public.master_specification_versions
  id                 uuid, NOT NULL
  specification_id   uuid, NOT NULL
  version_number     integer, NOT NULL
  change_summary     text, NOT NULL
  specification_data jsonb, NOT NULL
  status             text, NOT NULL
  created_by         uuid, NOT NULL
  created_at         timestamptz, NOT NULL

Foreign key: master_specification_versions_specification_id_fkey
  FOREIGN KEY (specification_id) REFERENCES master_specifications(id) ON DELETE RESTRICT
```

The original authoritative migration and deployed `save_master_specification_version` both insert through `specification_id`. The feasibility joins in the pending reviewer SQL were reconciled to `version.specification_id`; no `version.master_specification_id` reference remains. The Sales-bound protected requirement-create contract already used the same column.

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
  JOIN public.master_specifications specification ON specification.id = version.specification_id
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
  JOIN public.master_specifications specification ON specification.id = version.specification_id
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

```ts
import { z } from "zod";

const boundedText = (max: number) => z.string().trim().min(1).max(max);

export const clientRequirementIntakeSchema = z.object({
  opportunityId: z.string().uuid(),
  customerId: z.string().uuid(),
  requestKey: z.string().uuid(),
  title: boundedText(240),
  description: boundedText(12_000),
  customerReference: z.string().trim().max(240).nullable(),
});

export const feasibilityAssignmentSchema = z.object({
  requirementId: z.string().uuid(),
  reviewerUserId: z.string().uuid(),
  departmentId: z.string().uuid(),
});

export const feasibilityResponseSchema = z.object({
  reviewId: z.string().uuid(),
  verdict: z.enum(["feasible", "feasible_with_conditions", "not_feasible"]),
  findings: boundedText(12_000),
  assumptions: z.string().trim().max(12_000).nullable(),
  risks: z.string().trim().max(12_000).nullable(),
});

export type ClientRequirementIntake = z.infer<typeof clientRequirementIntakeSchema>;
export type FeasibilityResponse = z.infer<typeof feasibilityResponseSchema>;

export function clientRequirementRequestKey(current: string | null): string {
  return current ?? crypto.randomUUID();
}

export const protectedIntakeAvailability = {
  available: false,
  reason: "Client requirement submission and feasibility responses stay unavailable until the protected database contract passes isolated acceptance.",
} as const;

export const controlledRequirementAvailability = {
  available: false,
  reason: "Creating a requirement bound to an immutable Master Specification version stays unavailable until the protected database contract passes isolated acceptance.",
  dependency: "A protected atomic requirement-creation routine must verify the opportunity/customer pair, pin the selected Master Specification version, create revision 1 and its audit receipt together, and reject replay or mismatched sources.",
} as const;

export function clientRequirementState(input: { expiresAt: string | null; isActive: boolean; revokedAt: string | null }, now = new Date()): "ACTIVE" | "EXPIRED" | "REVOKED" {
  if (!input.isActive || input.revokedAt) return "REVOKED";
  if (input.expiresAt && new Date(input.expiresAt) <= now) return "EXPIRED";
  return "ACTIVE";
}

export function mayRecordFeasibility(input: { assignedTo: string | null; actorId: string; isEngineeringManager: boolean; isActiveDepartmentMember: boolean; status: string | null }): boolean {
  return input.assignedTo !== null
    && input.status !== null
    && ["pending", "in_review"].includes(input.status)
    && input.assignedTo === input.actorId
    && input.isEngineeringManager
    && input.isActiveDepartmentMember;
}

export function mayExposeClientRequirement(input: { isActive: boolean; revokedAt: string | null; expiresAt: string | null; accessScope: unknown; opportunityId: string; customerId: string }, now = new Date()): boolean {
  if (clientRequirementState(input, now) !== "ACTIVE" || !input.accessScope || typeof input.accessScope !== "object") return false;
  const scope = input.accessScope as { opportunityIds?: unknown; customerIds?: unknown };
  return Array.isArray(scope.opportunityIds) && Array.isArray(scope.customerIds)
    && scope.opportunityIds.includes(input.opportunityId)
    && scope.customerIds.includes(input.customerId);
}
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
-- 9. reviewer: protected assignment locks requirement, source revision, review, then pinned
--    Master version. It derives that version only from revision.requirement_data.source.
--    It must reject absent/invalid legacy source IDs plus missing/null/non-string/unknown
--    workstreams. Execute and assert: (a) first assignment creates one pending review, (b) a
--    same-revision reassignment returns that same review ID and updates only its open reviewer
--    state, and (c) after a terminal response plus a new immutable requirement revision, an
--    assignment for that new revision creates a distinct review while retaining the historical
--    terminal row unchanged. These are database assertions, not SQL-text checks.
--    A terminal review remains immutable history; after a new requirement revision, the same
--    department receives a new revision-scoped review without modifying the historic verdict.
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
-- Schema contract preflight (read-only; run against the explicitly approved isolated backend only).
-- This is executable catalog validation, not a regex/source assertion. It must return TRUE
-- for the deployed authoritative column and false for the retired/invented spelling:
-- SELECT EXISTS (
--   SELECT 1 FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'master_specification_versions'
--     AND column_name = 'specification_id' AND data_type = 'uuid' AND is_nullable = 'NO'
-- ) AS master_version_uses_specification_id;
-- SELECT NOT EXISTS (
--   SELECT 1 FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'master_specification_versions'
--     AND column_name = 'master_specification_id'
-- ) AS no_invented_master_specification_id;
-- SELECT EXISTS (
--   SELECT 1 FROM pg_constraint constraint
--   WHERE constraint.conrelid = 'public.master_specification_versions'::regclass
--     AND pg_get_constraintdef(constraint.oid) =
--       'FOREIGN KEY (specification_id) REFERENCES master_specifications(id) ON DELETE RESTRICT'
-- ) AS master_version_specification_fk_matches_authoritative_schema;

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
-- prove it derives the Master version from source_revision.requirement_data.source rather than
-- master_specifications.current_version; header advancement must not change a revision-bound
-- source. Prove the immutable source tuple includes exact opportunity_id, customer_id, Master
-- version UUID, and version number, and rejects a UUID from another opportunity/customer even
-- when it exists. Prove absent/invalid legacy source IDs and missing/null/non-string/unknown workstreams
-- fail closed. Prove revision-scoped uniqueness permits a new department review for a new
-- requirement revision while preserving the old terminal row unchanged.
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

- The schema evidence above came from read-only catalog queries only; it did not execute any pending SQL.
- The catalog-validation queries in the acceptance source are executable only on an explicitly approved isolated backend. They were not run because no approved isolated caller-authenticated target or identities are available.
- All test evidence remains source-level until that caller-authenticated isolated acceptance runs.

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
-- pins the exact customer requirement revision and its authoritative Master Specification
-- version. The version's verified workstreams determine department applicability; absent,
-- malformed, or unknown workstreams fail closed as TBC rather than becoming implicit scope.
ALTER TABLE public.requirement_feasibility_reviews
  ADD COLUMN IF NOT EXISTS source_revision_id uuid REFERENCES public.customer_requirement_revisions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_revision_number integer,
  ADD COLUMN IF NOT EXISTS master_specification_version_id uuid REFERENCES public.master_specification_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS master_specification_version_number integer,
  ADD COLUMN IF NOT EXISTS applicable_workstreams jsonb;

DO $$
BEGIN
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
  v_master_specification public.master_specifications%ROWTYPE;
  v_master_version public.master_specification_versions%ROWTYPE;
  v_workstreams jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'sales.manage') THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;
  IF p_requirement_id IS NULL OR p_department_id IS NULL OR p_reviewer_user_id IS NULL THEN
    RAISE EXCEPTION 'Requirement, department, and reviewer are required';
  END IF;
  SELECT * INTO v_requirement
  FROM public.customer_requirements
  WHERE id = p_requirement_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feasibility source requirement is unavailable';
  END IF;
  SELECT * INTO v_revision
  FROM public.customer_requirement_revisions
  WHERE requirement_id = v_requirement.id
    AND revision_number = v_requirement.current_revision
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current immutable customer requirement revision is unavailable';
  END IF;
  SELECT * INTO v_master_specification
  FROM public.master_specifications
  WHERE opportunity_id = v_requirement.opportunity_id
    AND customer_id = v_requirement.customer_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authoritative Master Specification is unavailable for the feasibility source';
  END IF;
  SELECT * INTO v_master_version
  FROM public.master_specification_versions
  WHERE specification_id = v_master_specification.id
    AND version_number = v_master_specification.current_version
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current immutable Master Specification version is unavailable';
  END IF;
  v_workstreams := v_master_version.specification_data->'workstreams';
  IF jsonb_typeof(v_workstreams) <> 'array'
     OR jsonb_array_length(v_workstreams) = 0
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(v_workstreams) AS workstream(value)
       WHERE workstream.value NOT IN ('HARDWARE', 'FIRMWARE', 'MECHANICAL', 'TEST', 'MANUFACTURING')
     ) THEN
    RAISE EXCEPTION 'Master Specification workstreams are missing, unknown, or incomplete; applicability is TBC';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees employee
    JOIN public.employee_departments membership ON membership.employee_id = employee.id
    WHERE employee.user_id = p_reviewer_user_id
      AND employee.employment_status = 'ACTIVE'
      AND membership.department_id = p_department_id
  ) THEN
    RAISE EXCEPTION 'Assigned reviewer is not an active member of the selected department';
  END IF;
  SELECT * INTO v_review
  FROM public.requirement_feasibility_reviews
  WHERE requirement_id = p_requirement_id AND department_id = p_department_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_review.status NOT IN ('pending', 'in_review') THEN
      RAISE EXCEPTION 'Terminal feasibility reviews cannot be reassigned';
    END IF;
    IF v_review.source_revision_id IS DISTINCT FROM v_revision.id
       OR v_review.source_revision_number IS DISTINCT FROM v_revision.revision_number
       OR v_review.master_specification_version_id IS DISTINCT FROM v_master_version.id
       OR v_review.master_specification_version_number IS DISTINCT FROM v_master_version.version_number
       OR v_review.applicable_workstreams IS DISTINCT FROM v_workstreams THEN
      RAISE EXCEPTION 'Open feasibility review is pinned to different immutable provenance; create a new revision-bound assignment after source change';
    END IF;
    UPDATE public.requirement_feasibility_reviews
    SET reviewer_user_id = p_reviewer_user_id,
        status = 'pending',
        findings = NULL,
        assumptions = NULL,
        risks = NULL,
        reviewed_at = NULL
    WHERE id = v_review.id;
    INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary, after_data)
    VALUES (
      auth.uid(), 'sales', 'requirement_feasibility', v_review.id, 'assigned',
      'Engineering feasibility review assigned.',
      jsonb_build_object(
        'requirement_id', p_requirement_id,
        'source_revision_id', v_revision.id,
        'source_revision_number', v_revision.revision_number,
        'master_specification_version_id', v_master_version.id,
        'master_specification_version_number', v_master_version.version_number,
        'applicable_workstreams', v_workstreams,
        'department_id', p_department_id,
        'reviewer_user_id', p_reviewer_user_id,
        'status', 'pending'
      )
    );
    RETURN v_review.id;
  END IF;
  INSERT INTO public.requirement_feasibility_reviews (
    requirement_id, department_id, reviewer_user_id, status, created_by,
    source_revision_id, source_revision_number,
    master_specification_version_id, master_specification_version_number, applicable_workstreams
  ) VALUES (
    p_requirement_id, p_department_id, p_reviewer_user_id, 'pending', auth.uid(),
    v_revision.id, v_revision.revision_number,
    v_master_version.id, v_master_version.version_number, v_workstreams
  )
  RETURNING id INTO v_review.id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary, after_data)
  VALUES (
    auth.uid(), 'sales', 'requirement_feasibility', v_review.id, 'assigned',
    'Engineering feasibility review assigned.',
    jsonb_build_object(
      'requirement_id', p_requirement_id,
        'source_revision_id', v_revision.id,
        'source_revision_number', v_revision.revision_number,
        'master_specification_version_id', v_master_version.id,
        'master_specification_version_number', v_master_version.version_number,
        'applicable_workstreams', v_workstreams,
      'department_id', p_department_id,
      'reviewer_user_id', p_reviewer_user_id,
      'status', 'pending'
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
  IF p_status IS NULL
     OR p_status NOT IN ('feasible', 'feasible_with_conditions', 'not_feasible')
     OR NULLIF(btrim(p_findings), '') IS NULL THEN
    RAISE EXCEPTION 'A terminal feasibility verdict and findings are required';
  END IF;
  SELECT * INTO v_review
  FROM public.requirement_feasibility_reviews
  WHERE id = p_review_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Feasibility review is unavailable'; END IF;
  SELECT * INTO v_requirement
  FROM public.customer_requirements
  WHERE id = v_review.requirement_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Feasibility review source requirement is unavailable'; END IF;
  IF v_review.source_revision_id IS NULL
     OR v_review.source_revision_number IS NULL
     OR v_review.master_specification_version_id IS NULL
     OR v_review.master_specification_version_number IS NULL
     OR jsonb_typeof(v_review.applicable_workstreams) <> 'array' THEN
    RAISE EXCEPTION 'Feasibility review lacks immutable provenance and cannot receive a protected response';
  END IF;
  SELECT * INTO v_revision
  FROM public.customer_requirement_revisions
  WHERE id = v_review.source_revision_id
    AND requirement_id = v_requirement.id
    AND revision_number = v_review.source_revision_number
  FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pinned customer requirement revision is unavailable'; END IF;
  SELECT * INTO v_master_version
  FROM public.master_specification_versions
  WHERE id = v_review.master_specification_version_id
    AND version_number = v_review.master_specification_version_number
  FOR KEY SHARE;
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
    WHERE employee.user_id = auth.uid()
      AND employee.employment_status = 'ACTIVE'
      AND membership.department_id = v_review.department_id
  ) THEN
    RAISE EXCEPTION 'The assigned reviewer is not an active member of this review department';
  END IF;
  IF v_review.status NOT IN ('pending', 'in_review') THEN
    RAISE EXCEPTION 'Feasibility review is not open for a response';
  END IF;
  IF v_review.status IN ('feasible', 'feasible_with_conditions', 'not_feasible') THEN
    RAISE EXCEPTION 'Feasibility responses are immutable after submission';
  END IF;
  UPDATE public.requirement_feasibility_reviews
  SET status = p_status,
      findings = p_findings,
      assumptions = p_assumptions,
      risks = p_risks,
      reviewed_at = now()
  WHERE id = v_review.id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary, after_data)
  VALUES (
    auth.uid(), 'engineering', 'requirement_feasibility', v_review.id, 'responded',
    'Engineering feasibility response recorded.',
    jsonb_build_object(
      'requirement_id', v_review.requirement_id,
      'source_revision_id', v_review.source_revision_id,
      'source_revision_number', v_review.source_revision_number,
      'master_specification_version_id', v_review.master_specification_version_id,
      'master_specification_version_number', v_review.master_specification_version_number,
      'applicable_workstreams', v_review.applicable_workstreams,
      'opportunity_id', v_requirement.opportunity_id,
      'customer_id', v_requirement.customer_id,
      'department_id', v_review.department_id,
      'reviewer_user_id', v_review.reviewer_user_id,
      'status', p_status
    )
  );
  RETURN v_review.id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.requirement_feasibility_response_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Table grants and the former Sales-all write policy are removed above, so a caller cannot
  -- authorize a response by setting a session variable. This guard validates allowed protected
  -- transitions as defense in depth and rejects terminal/provenance mutations before any return.
  IF OLD.status IN ('feasible', 'feasible_with_conditions', 'not_feasible') THEN
    RAISE EXCEPTION 'Feasibility responses are immutable after submission';
  END IF;
  IF NEW.requirement_id IS DISTINCT FROM OLD.requirement_id THEN
    RAISE EXCEPTION 'Feasibility source requirement is immutable after assignment';
  END IF;
  IF NEW.source_revision_id IS DISTINCT FROM OLD.source_revision_id
     OR NEW.source_revision_number IS DISTINCT FROM OLD.source_revision_number
     OR NEW.master_specification_version_id IS DISTINCT FROM OLD.master_specification_version_id
     OR NEW.master_specification_version_number IS DISTINCT FROM OLD.master_specification_version_number
     OR NEW.applicable_workstreams IS DISTINCT FROM OLD.applicable_workstreams THEN
    RAISE EXCEPTION 'Feasibility provenance is immutable after assignment';
  END IF;
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    RAISE EXCEPTION 'Feasibility department is immutable after assignment';
  END IF;
  IF NEW.reviewer_user_id IS DISTINCT FROM OLD.reviewer_user_id THEN
    IF NEW.status <> 'pending'
       OR NEW.findings IS NOT NULL
       OR NEW.assumptions IS NOT NULL
       OR NEW.risks IS NOT NULL
       OR NEW.reviewed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Feasibility reviewer changes require an unresponded assignment';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status = 'pending'
     AND NEW.findings IS NULL
     AND NEW.assumptions IS NULL
     AND NEW.risks IS NULL
     AND NEW.reviewed_at IS NULL
     AND OLD.status IN ('pending', 'in_review') THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('feasible', 'feasible_with_conditions', 'not_feasible')
     OR NULLIF(btrim(NEW.findings), '') IS NULL
     OR OLD.reviewer_user_id IS NULL
     OR OLD.department_id IS NULL
     OR OLD.reviewer_user_id IS DISTINCT FROM auth.uid()
     OR NOT EXISTS (
       SELECT 1
       FROM public.employees employee
       JOIN public.employee_departments membership ON membership.employee_id = employee.id
       WHERE employee.user_id = auth.uid()
         AND employee.employment_status = 'ACTIVE'
         AND membership.department_id = OLD.department_id
     ) THEN
    RAISE EXCEPTION 'Feasibility responses require the assigned active engineering reviewer';
  END IF;
  NEW.reviewed_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requirement_feasibility_response_guard_trigger ON public.requirement_feasibility_reviews;
CREATE TRIGGER requirement_feasibility_response_guard_trigger
BEFORE UPDATE ON public.requirement_feasibility_reviews
FOR EACH ROW EXECUTE FUNCTION public.requirement_feasibility_response_guard();

CREATE OR REPLACE FUNCTION public.requirement_feasibility_response_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'pending'
     OR NEW.findings IS NOT NULL
     OR NEW.assumptions IS NOT NULL
     OR NEW.risks IS NOT NULL
     OR NEW.reviewed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Feasibility reviews must be created as unresponded assignments';
  END IF;
  IF NEW.source_revision_id IS NULL
     OR NEW.source_revision_number IS NULL
     OR NEW.master_specification_version_id IS NULL
     OR NEW.master_specification_version_number IS NULL
     OR jsonb_typeof(NEW.applicable_workstreams) <> 'array' THEN
    RAISE EXCEPTION 'Feasibility reviews must be created with immutable source provenance';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requirement_feasibility_response_insert_guard_trigger ON public.requirement_feasibility_reviews;
CREATE TRIGGER requirement_feasibility_response_insert_guard_trigger
BEFORE INSERT ON public.requirement_feasibility_reviews
FOR EACH ROW EXECUTE FUNCTION public.requirement_feasibility_response_insert_guard();

CREATE OR REPLACE FUNCTION public.requirement_feasibility_response_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status NOT IN ('pending', 'in_review') THEN
    RAISE EXCEPTION 'Terminal feasibility reviews cannot be deleted';
  END IF;
  RAISE EXCEPTION 'Feasibility review deletion is not a supported workflow';
END;
$$;

DROP TRIGGER IF EXISTS requirement_feasibility_response_delete_guard_trigger ON public.requirement_feasibility_reviews;
CREATE TRIGGER requirement_feasibility_response_delete_guard_trigger
BEFORE DELETE ON public.requirement_feasibility_reviews
FOR EACH ROW EXECUTE FUNCTION public.requirement_feasibility_response_delete_guard();

-- Direct external table RLS is deliberately unchanged: this routine is the only proposed
-- external write path. It derives the authenticated actor, contact, party, active/revoked/
-- expired grant and opportunity/customer scope before its atomic requirement, revision, and
-- audit inserts. The acceptance runner must prove direct reads/writes remain denied.
-- SOURCE-ONLY PROPOSAL. Do not apply before scoped client isolation, reviewer authorization,
-- response immutability, expiry/revocation, denial, rollback, optimistic-conflict, concurrency,
-- direct-table denial, and non-admin caller-RLS acceptance pass in an isolated backend.
-- Reuses the existing revisioned customer_requirements and requirement_feasibility_reviews tables.
-- No automatic approval, project conversion, quotation, or release is created by this contract.
-- This intentionally leaves direct external table RLS unchanged. The only proposed external
-- write entry point is the narrowly scoped SECURITY DEFINER routine below.

CREATE OR REPLACE FUNCTION public.external_requirement_scope_allows(
  p_contact_id uuid,
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
    WHERE access.external_contact_id = p_contact_id
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

CREATE OR REPLACE FUNCTION public.submit_external_customer_requirement(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_title text,
  p_customer_reference text,
  p_requirement_data jsonb
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
BEGIN
  IF v_actor_id IS NULL OR v_contact_id IS NULL OR v_party_id IS NULL THEN
    RAISE EXCEPTION 'An active external contact is required';
  END IF;
  IF jsonb_typeof(p_requirement_data) <> 'object'
    OR NULLIF(btrim(p_title), '') IS NULL
    OR NULLIF(btrim(p_requirement_data->>'description'), '') IS NULL THEN
    RAISE EXCEPTION 'Requirement title and description are required';
  END IF;
  -- The caller identity comes only from auth.uid(). Contact, party, expiry, revocation,
  -- and explicit opportunity/customer grants are all re-derived under the function owner.
  IF NOT public.external_requirement_scope_allows(v_contact_id, p_opportunity_id, p_customer_id) THEN
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
      'revision_number', 1
    )
  );
  RETURN v_requirement.id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.external_requirement_scope_allows(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.external_requirement_scope_allows(uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_requirement_feasibility_response(
  p_review_id uuid,
  p_status text,
  p_findings text,
  p_assumptions text,
  p_risks text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_review public.requirement_feasibility_reviews%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'engineering.manage') THEN
    RAISE EXCEPTION 'Engineering management permission is required';
  END IF;
  IF p_status NOT IN ('feasible', 'feasible_with_conditions', 'not_feasible')
     OR NULLIF(btrim(p_findings), '') IS NULL THEN
    RAISE EXCEPTION 'A terminal feasibility verdict and findings are required';
  END IF;
  SELECT * INTO v_review
  FROM public.requirement_feasibility_reviews
  WHERE id = p_review_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Feasibility review is unavailable'; END IF;
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
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary)
  VALUES (auth.uid(), 'engineering', 'requirement_feasibility', v_review.id, 'responded', 'Engineering feasibility response recorded.');
  RETURN v_review.id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.requirement_feasibility_response_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('feasible', 'feasible_with_conditions', 'not_feasible') THEN
    RAISE EXCEPTION 'Feasibility responses are immutable after submission';
  END IF;
  IF NEW.department_id IS DISTINCT FROM OLD.department_id
    OR NEW.reviewer_user_id IS DISTINCT FROM OLD.reviewer_user_id THEN
    RAISE EXCEPTION 'Assignments are immutable after creation; create a new review assignment instead';
  END IF;
  IF OLD.reviewer_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_permission(auth.uid(), 'engineering.manage') THEN
    RAISE EXCEPTION 'Only the assigned reviewer may respond';
  END IF;
  IF NEW.status IN ('feasible', 'feasible_with_conditions', 'not_feasible') THEN
    IF NULLIF(btrim(NEW.findings), '') IS NULL THEN
      RAISE EXCEPTION 'Findings are required when responding to a feasibility review';
    END IF;
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requirement_feasibility_response_guard_trigger ON public.requirement_feasibility_reviews;
CREATE TRIGGER requirement_feasibility_response_guard_trigger
BEFORE UPDATE ON public.requirement_feasibility_reviews
FOR EACH ROW EXECUTE FUNCTION public.requirement_feasibility_response_guard();

-- Direct external table RLS is deliberately unchanged: this routine is the only proposed
-- external write path. It derives the authenticated actor, contact, party, active/revoked/
-- expired grant and opportunity/customer scope before its atomic requirement, revision, and
-- audit inserts. The acceptance runner must prove direct reads/writes remain denied.
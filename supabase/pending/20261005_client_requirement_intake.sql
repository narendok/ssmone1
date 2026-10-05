-- SOURCE-ONLY PROPOSAL. Do not apply before scoped client isolation, reviewer authorization,
-- response immutability, expiry/revocation, and rollback acceptance pass in an isolated backend.
-- Reuses the existing revisioned customer_requirements and requirement_feasibility_reviews tables.
-- No automatic approval, project conversion, quotation, or release is created by this contract.

CREATE OR REPLACE FUNCTION public.submit_external_customer_requirement(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_title text,
  p_customer_reference text,
  p_requirement_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_requirement public.customer_requirements%ROWTYPE;
  v_contact_id uuid := public.external_current_contact_id(auth.uid());
  v_party_id uuid := public.external_current_party_id();
BEGIN
  IF auth.uid() IS NULL OR v_contact_id IS NULL OR v_party_id IS NULL THEN
    RAISE EXCEPTION 'An active external contact is required';
  END IF;
  IF jsonb_typeof(p_requirement_data) <> 'object'
    OR NULLIF(btrim(p_title), '') IS NULL
    OR NULLIF(btrim(p_requirement_data->>'description'), '') IS NULL THEN
    RAISE EXCEPTION 'Requirement title and description are required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.external_portal_access access
    WHERE access.external_contact_id = v_contact_id
      AND access.is_active AND access.deactivated_at IS NULL
      AND (access.expires_at IS NULL OR access.expires_at > now())
      AND access.portal_type = 'CLIENT_REQUIREMENTS'
  ) THEN RAISE EXCEPTION 'Client requirement access is inactive, expired, or revoked'; END IF;
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
    p_requirement_data, now(), auth.uid()
  ) RETURNING * INTO v_requirement;
  INSERT INTO public.customer_requirement_revisions (
    requirement_id, revision_number, change_summary, requirement_data, status, created_by
  ) VALUES (
    v_requirement.id, 1, 'Client-submitted requirement', p_requirement_data, 'submitted', auth.uid()
  );
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary)
  VALUES (auth.uid(), 'sales', 'customer_requirement', v_requirement.id, 'external_submitted', 'Client submitted a requirement.');
  RETURN v_requirement.id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.requirement_feasibility_response_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('feasible', 'feasible_with_conditions', 'not_feasible') THEN
    RAISE EXCEPTION 'Feasibility responses are immutable after submission';
  END IF;
  IF NOT public.has_permission(auth.uid(), 'engineering.manage') THEN
    IF OLD.reviewer_user_id IS DISTINCT FROM auth.uid()
      OR NEW.department_id IS DISTINCT FROM OLD.department_id
      OR NEW.reviewer_user_id IS DISTINCT FROM OLD.reviewer_user_id THEN
      RAISE EXCEPTION 'Only Engineering management may assign or reassign feasibility reviews';
    END IF;
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

-- Policies must be reviewed alongside the existing external contact identity helpers.
-- The current live tables expose staff-only policies; this proposal intentionally does not widen
-- direct external SELECT/INSERT until isolated caller-RLS acceptance proves exact party scoping.
# Client Requirement & Reviewer Contract — Exact Review Export (2026-10-06 UTC)

Status: **pending source only**. The SQL below is an exact extracted copy of the reviewer hardening portion of `supabase/pending/20261005_client_requirement_intake.sql`; it is not a migration and must not be applied independently.

## Exact pending reviewer SQL

```sql
-- create/reassign an open review; a terminal response can only be appended by its assigned,
-- active engineering reviewer. Source requirement linkage is never mutable after creation.
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
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'sales.manage') THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;
  IF p_requirement_id IS NULL OR p_department_id IS NULL OR p_reviewer_user_id IS NULL THEN
    RAISE EXCEPTION 'Requirement, department, and reviewer are required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer_requirements WHERE id = p_requirement_id) THEN
    RAISE EXCEPTION 'Feasibility source requirement is unavailable';
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
        'department_id', p_department_id,
        'reviewer_user_id', p_reviewer_user_id,
        'status', 'pending'
      )
    );
    RETURN v_review.id;
  END IF;
  INSERT INTO public.requirement_feasibility_reviews (
    requirement_id, department_id, reviewer_user_id, status, created_by
  ) VALUES (p_requirement_id, p_department_id, p_reviewer_user_id, 'pending', auth.uid())
  RETURNING id INTO v_review.id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary, after_data)
  VALUES (
    auth.uid(), 'sales', 'requirement_feasibility', v_review.id, 'assigned',
    'Engineering feasibility review assigned.',
    jsonb_build_object(
      'requirement_id', p_requirement_id,
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
  FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Feasibility review source requirement is unavailable'; END IF;
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

```

## Exact façade contracts

### Sales assignment façade

`assignFeasibilityReview = createServerFn({ method: "POST" })`

- Requires the normal authenticated caller middleware.
- Validates `{ requirementId: uuid, departmentId: uuid, reviewerUserId: uuid }`.
- Re-checks `sales.manage` through the caller-RLS client.
- Calls only `assign_requirement_feasibility_review(p_requirement_id, p_department_id, p_reviewer_user_id)`.
- No direct `requirement_feasibility_reviews` insert, update, or upsert remains in this façade.

### Engineering response façade

`recordAssignedFeasibility = createServerFn({ method: "POST" })`

- Requires the normal authenticated caller middleware.
- Validates `{ reviewId: uuid, verdict: feasible|feasible_with_conditions|not_feasible, findings, assumptions, risks }`.
- Re-checks `engineering.manage` through the caller-RLS client.
- Calls only `record_requirement_feasibility_response(p_review_id, p_status, p_findings, p_assumptions, p_risks)`.
- The UI remains explicitly disabled pending isolated caller-authenticated acceptance.

## Exact effective permissions and runner boundary

### Pending effective permissions

- `public.requirement_feasibility_reviews`: `authenticated` has no direct create, change, or delete privilege after the proposal; the broad `Sales users manage feasibility reviews` policy is removed. Read access remains governed by the existing `Authenticated users view feasibility reviews` policy.
- `public.assign_requirement_feasibility_review(uuid, uuid, uuid)`: all execution is removed from `PUBLIC` and `anon`; execution is granted to `authenticated` and `service_role`. The routine itself requires `auth.uid()` plus `sales.manage`.
- `public.record_requirement_feasibility_response(uuid, text, text, text, text)`: all execution is removed from `PUBLIC` and `anon`; execution is granted to `authenticated` and `service_role`. The routine itself requires `auth.uid()`, `engineering.manage`, exact assigned reviewer identity, active department membership, a terminal non-null verdict, and nonblank findings.
- `service_role` retains execution only as a backend maintenance capability; it is not accepted as caller-RLS evidence and is never used by the acceptance harness.

### Harness and normal signed-in transport

- Shell environment-gate runner: `supabase/pending/tests/run_client_requirement_intake_isolated_acceptance.sh`. It accepts only an `ISOLATED_DATABASE_URL` whose target contains the allowlisted isolated backend identifier, refuses the original backend before doing work, and never queries or mutates a database.
- Normal signed-in read-only façade: `src/lib/isolated-sales-acceptance.functions.ts`, export `getIsolatedSalesAcceptancePreflight`. It is a `POST` `createServerFn`, protected by `requireSupabaseAuth`, and uses the existing browser bearer transport registered by `src/start.ts` (`attachSupabaseAuth`). Its handler confirms a verified caller identity but performs no database read, RPC invocation, or write.
- The normal façade currently uses the project’s caller-RLS backend binding. It proves the signed-in transport, but cannot connect that caller to the separate isolated backend. The isolated backend must expose the pending objects and have approved scoped callers before caller-RLS acceptance can execute there.

### Read-only preflight executed 2026-10-06 UTC

- **Transport:** authenticated server-function call succeeded with the existing signed-in session; verified caller identity was present. No token value was read or exported.
- **Allowlist:** isolated target accepted; original target rejection is expected by design.
- **Original backend object inspection:** existing base tables and RLS are present: `customer_requirements`, `customer_requirement_revisions`, `requirement_feasibility_reviews`, `external_contacts`, `external_portal_access`, `employees`, `employee_departments`, and `activity_log`.
- **Original backend missing pending dependencies:** `external_requirement_submission_requests`; `submit_external_customer_requirement(uuid,uuid,text,text,jsonb,uuid)`; `assign_requirement_feasibility_review(uuid,uuid,uuid)`; `record_requirement_feasibility_response(uuid,text,text,text,text)`; and their pending grants/triggers. The current direct Sales feasibility-management policy remains active until the proposal is applied.
- **Missing approved identities:** an active scoped external contact for one verified opportunity/customer pair; an active assigned engineering reviewer with department membership; and two separate approved authenticated sessions for concurrency. These are identity/fixture approvals, not schema dependencies.
- **Still blocked:** audit-failure rollback boundary and caller-authenticated replay/concurrency execution. No mutation was attempted.

## No-GUC boundary

The extracted SQL contains no `current_setting('app.requirement_feasibility_response_rpc')` or `set_config('app.requirement_feasibility_response_rpc', ...)` authorization branch. Actor identity is derived by each protected routine from `auth.uid()`; direct authenticated review mutation is revoked in the same pending proposal.

## Acceptance status

Static source checks pass. No database mutation, caller-RLS proof, or production deployment is represented by this export.

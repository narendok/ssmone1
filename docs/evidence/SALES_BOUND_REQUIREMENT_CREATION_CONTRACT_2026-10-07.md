# Sales-bound requirement, baseline, and commercial contract — source-only review export

**Status:** Pending only. Nothing in this document was applied to the live backend. It requires an approved isolated environment and real authenticated caller-transport acceptance before any deployment or UI enablement.

## Observed deployed schema evidence

- `drizzle/migrations/0009_complete_phase4_customer_lifecycle.sql` defines `sales_commercial_records` with one record per requirement, the six deployed statuses, customer authorization fields, authenticated direct write grants, a Sales-manage RLS write policy, and only an `updated_at` touch trigger.
- `drizzle/migrations/0014_stabilization_sales_project_numbers.sql` keeps baseline numbering server-owned through `requirement_baselines_assign_business_code`; the baseline contract passes `NULL` for `baseline_number`.
- No deployed commercial revision/history or request-receipt table exists. The pending SQL below adds them without changing existing records.

## Pending design and lock order

The protected commercial save uses `advisory(request key) → commercial receipt → requirement → commercial record`. The baseline transaction takes the same shared prefix before continuing to revision-scoped reviews and the Master version. Locking the requirement before probing the unique child serializes a missing-record insert race. Direct commercial writes are revoked only inside this same pending compatibility group.

The Sales UI and server facade are deliberately unavailable now: there is no direct-write fallback. Existing commercial rows, manual edits, baselines, the 24v tracker, and history are neither changed nor backfilled.

## Full pending SQL

```sql
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

-- BASELINE APPROVAL AND COMMERCIAL COORDINATION GROUP — SOURCE-ONLY. This requires the pending
-- revision-bound feasibility proposal in 20261005_client_requirement_intake.sql.
-- No legacy row is backfilled: a review with NULL provenance remains unavailable.
-- Shared protected lock order: advisory(request_key) -> receipt -> requirement -> current
-- revision -> feasibility reviews -> Master version -> commercial record. Commercial saves
-- use the applicable subset: advisory(request_key) -> commercial receipt -> requirement ->
-- commercial record. The requirement row serializes a missing-commercial insertion race:
-- a baseline gate and a first commercial create cannot both observe a phantom row.
-- Master Specification save and requirement creation separately serialize opportunity ->
-- specification. This group intentionally does not claim that commercial mutation itself
-- authorizes a customer decision beyond recording the explicitly supplied status and
-- authorization reference.
-- The deployed requirement_baselines_assign_business_code trigger remains the sole
-- baseline-number issuer; this contract supplies a NULL baseline_number.

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

CREATE TABLE public.sales_commercial_save_requests (
  request_key uuid PRIMARY KEY,
  requested_by uuid NOT NULL,
  requirement_id uuid NOT NULL REFERENCES public.customer_requirements(id) ON DELETE RESTRICT,
  expected_revision_number integer NOT NULL CHECK (expected_revision_number >= 0),
  payload_hash text NOT NULL,
  payload_canonical jsonb NOT NULL,
  commercial_record_id uuid NOT NULL REFERENCES public.sales_commercial_records(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(payload_hash)) > 0),
  CHECK (jsonb_typeof(payload_canonical) = 'object')
);
GRANT ALL ON TABLE public.sales_commercial_save_requests TO service_role;
REVOKE ALL ON TABLE public.sales_commercial_save_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE public.sales_commercial_save_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct commercial receipt access" ON public.sales_commercial_save_requests
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.sales_commercial_records
  ADD COLUMN revision_number integer NOT NULL DEFAULT 1 CHECK (revision_number >= 1);
CREATE TABLE public.sales_commercial_record_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_record_id uuid NOT NULL REFERENCES public.sales_commercial_records(id) ON DELETE RESTRICT,
  requirement_id uuid NOT NULL REFERENCES public.customer_requirements(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commercial_record_id, revision_number)
);
GRANT ALL ON TABLE public.sales_commercial_record_revisions TO service_role;
REVOKE ALL ON TABLE public.sales_commercial_record_revisions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.sales_commercial_record_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct commercial revision access" ON public.sales_commercial_record_revisions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE OR REPLACE FUNCTION public.reject_sales_commercial_revision_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Commercial revision history is immutable';
END;
$$;
CREATE TRIGGER sales_commercial_record_revisions_immutable
  BEFORE UPDATE OR DELETE ON public.sales_commercial_record_revisions
  FOR EACH ROW EXECUTE FUNCTION public.reject_sales_commercial_revision_mutation();
REVOKE ALL ON FUNCTION public.reject_sales_commercial_revision_mutation() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sales_commercial_save_canonical_payload(
  p_requirement_id uuid, p_expected_revision_number integer, p_quotation_reference text,
  p_currency text, p_quoted_amount numeric, p_status text, p_authorization_reference text,
  p_notes text
) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'requirement_id', p_requirement_id,
    'expected_revision_number', p_expected_revision_number,
    'quotation_reference', nullif(btrim(coalesce(p_quotation_reference, '')), ''),
    'currency', upper(btrim(p_currency)),
    'quoted_amount', p_quoted_amount,
    'status', p_status,
    'authorization_reference', nullif(btrim(coalesce(p_authorization_reference, '')), ''),
    'notes', nullif(btrim(coalesce(p_notes, '')), '')
  )
$$;
CREATE OR REPLACE FUNCTION public.sales_commercial_save_payload_hash(
  p_requirement_id uuid, p_expected_revision_number integer, p_quotation_reference text,
  p_currency text, p_quoted_amount numeric, p_status text, p_authorization_reference text,
  p_notes text
) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT md5(public.sales_commercial_save_canonical_payload(
    p_requirement_id, p_expected_revision_number, p_quotation_reference, p_currency,
    p_quoted_amount, p_status, p_authorization_reference, p_notes
  )::text)
$$;

CREATE OR REPLACE FUNCTION public.save_sales_commercial_record(
  p_requirement_id uuid, p_expected_revision_number integer, p_quotation_reference text,
  p_currency text, p_quoted_amount numeric, p_status text, p_authorization_reference text,
  p_notes text, p_request_key uuid
) RETURNS TABLE(id uuid, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor_id uuid := auth.uid(); v_requirement public.customer_requirements%ROWTYPE;
  v_commercial public.sales_commercial_records%ROWTYPE;
  v_prior public.sales_commercial_save_requests%ROWTYPE;
  v_payload_canonical jsonb; v_payload_hash text; v_authorized_at timestamptz;
BEGIN
  IF v_actor_id IS NULL OR NOT public.has_permission(v_actor_id, 'sales.manage') THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;
  IF p_requirement_id IS NULL OR p_request_key IS NULL OR coalesce(p_expected_revision_number, -1) < 0 OR NULLIF(btrim(p_currency), '') IS NULL
     OR char_length(btrim(p_currency)) NOT BETWEEN 3 AND 8
     OR p_quoted_amount IS NOT NULL AND p_quoted_amount < 0
     OR p_status NOT IN ('draft', 'internal_review', 'sent', 'customer_authorized', 'declined', 'expired')
     OR char_length(coalesce(p_quotation_reference, '')) > 160
     OR char_length(coalesce(p_authorization_reference, '')) > 240
     OR char_length(coalesce(p_notes, '')) > 4000 THEN
    RAISE EXCEPTION 'Commercial payload is incomplete or invalid';
  END IF;
  IF p_status = 'customer_authorized' AND NULLIF(btrim(coalesce(p_authorization_reference, '')), '') IS NULL THEN
    RAISE EXCEPTION 'An explicit customer authorization reference is required';
  END IF;
  v_payload_canonical := public.sales_commercial_save_canonical_payload(
    p_requirement_id, p_expected_revision_number, p_quotation_reference, p_currency,
    p_quoted_amount, p_status, p_authorization_reference, p_notes
  );
  v_payload_hash := public.sales_commercial_save_payload_hash(
    p_requirement_id, p_expected_revision_number, p_quotation_reference, p_currency,
    p_quoted_amount, p_status, p_authorization_reference, p_notes
  );
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  SELECT * INTO v_prior FROM public.sales_commercial_save_requests
  WHERE request_key = p_request_key FOR UPDATE;
  IF FOUND THEN
    IF v_prior.requested_by = v_actor_id AND v_prior.requirement_id = p_requirement_id
       AND v_prior.expected_revision_number = p_expected_revision_number
       AND v_prior.payload_hash = v_payload_hash AND v_prior.payload_canonical = v_payload_canonical THEN
      RETURN QUERY SELECT v_prior.commercial_record_id, commercial.updated_at
      FROM public.sales_commercial_records commercial WHERE commercial.id = v_prior.commercial_record_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Request key conflicts with a different caller or payload';
  END IF;
  -- Locking this parent row before probing the unique child is required: FOR UPDATE of a
  -- missing child cannot protect against an insert phantom from another first-save call.
  SELECT * INTO v_requirement FROM public.customer_requirements
  WHERE id = p_requirement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commercial source requirement is unavailable'; END IF;
  SELECT * INTO v_commercial FROM public.sales_commercial_records
  WHERE requirement_id = v_requirement.id FOR UPDATE;
  IF FOUND THEN
    IF v_commercial.revision_number <> p_expected_revision_number THEN
      RAISE EXCEPTION 'Commercial record changed by another user; reopen before saving';
    END IF;
    v_authorized_at := CASE
      WHEN p_status = 'customer_authorized' AND v_commercial.status = 'customer_authorized'
        THEN v_commercial.customer_authorized_at
      WHEN p_status = 'customer_authorized' THEN now()
      ELSE NULL
    END;
    UPDATE public.sales_commercial_records SET
      quotation_reference = nullif(btrim(coalesce(p_quotation_reference, '')), ''),
      currency = upper(btrim(p_currency)), quoted_amount = p_quoted_amount, status = p_status,
      customer_authorized_at = v_authorized_at,
      authorization_reference = nullif(btrim(coalesce(p_authorization_reference, '')), ''),
      notes = nullif(btrim(coalesce(p_notes, '')), ''),
      revision_number = v_commercial.revision_number + 1
    WHERE id = v_commercial.id RETURNING * INTO v_commercial;
  ELSE
    IF p_expected_revision_number <> 0 THEN
      RAISE EXCEPTION 'No commercial record exists at the expected revision';
    END IF;
    v_authorized_at := CASE WHEN p_status = 'customer_authorized' THEN now() ELSE NULL END;
    INSERT INTO public.sales_commercial_records (
      requirement_id, quotation_reference, currency, quoted_amount, status,
      customer_authorized_at, authorization_reference, notes, created_by, revision_number
    ) VALUES (
      v_requirement.id, nullif(btrim(coalesce(p_quotation_reference, '')), ''),
      upper(btrim(p_currency)), p_quoted_amount, p_status, v_authorized_at,
      nullif(btrim(coalesce(p_authorization_reference, '')), ''),
      nullif(btrim(coalesce(p_notes, '')), ''), v_actor_id, 1
    ) RETURNING * INTO v_commercial;
  END IF;
  INSERT INTO public.sales_commercial_record_revisions (
    commercial_record_id, requirement_id, revision_number, snapshot, created_by
  ) VALUES (
    v_commercial.id, v_requirement.id, v_commercial.revision_number,
    jsonb_build_object('commercial_record_id', v_commercial.id, 'requirement_id', v_requirement.id,
      'revision_number', v_commercial.revision_number, 'quotation_reference', v_commercial.quotation_reference,
      'currency', v_commercial.currency, 'quoted_amount', v_commercial.quoted_amount,
      'status', v_commercial.status, 'customer_authorized_at', v_commercial.customer_authorized_at,
      'authorization_reference', v_commercial.authorization_reference, 'notes', v_commercial.notes),
    v_actor_id
  );
  INSERT INTO public.activity_log (actor_user_id, module_key, entity_type, entity_id, action, summary, after_data)
  VALUES (v_actor_id, 'sales', 'sales_commercial_record', v_commercial.id, 'saved',
    'Commercial record saved through the protected contract.',
    jsonb_build_object('requirement_id', v_requirement.id, 'status', v_commercial.status,
      'customer_authorized_at', v_commercial.customer_authorized_at,
      'authorization_reference', v_commercial.authorization_reference,
      'request_key', p_request_key));
  INSERT INTO public.sales_commercial_save_requests (
    request_key, requested_by, requirement_id, expected_revision_number, payload_hash,
    payload_canonical, commercial_record_id
  ) VALUES (p_request_key, v_actor_id, v_requirement.id, p_expected_revision_number,
    v_payload_hash, v_payload_canonical, v_commercial.id);
  RETURN QUERY SELECT v_commercial.id, v_commercial.updated_at;
END;
$$;
REVOKE ALL ON FUNCTION public.save_sales_commercial_record(uuid, integer, text, text, numeric, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_sales_commercial_record(uuid, integer, text, text, numeric, text, text, text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sales_commercial_save_canonical_payload(uuid, integer, text, text, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_commercial_save_payload_hash(uuid, integer, text, text, numeric, text, text, text) FROM PUBLIC, anon, authenticated;

-- The protected save above is the sole pending commercial mutation path. It preserves
-- existing rows and their history; it does not backfill, infer, or approve customer intent.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.sales_commercial_records FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.sales_commercial_records FROM PUBLIC;
DROP POLICY IF EXISTS "Sales users manage commercial records" ON public.sales_commercial_records;

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
  -- Lock every review for this immutable revision before evaluating it. Assignment and
  -- response routines lock requirement -> revision -> review -> version as well, so a
  -- concurrent reassignment or response either completes before this snapshot or waits.
  PERFORM 1 FROM public.requirement_feasibility_reviews review
  WHERE review.source_revision_id = v_revision.id
  ORDER BY review.id
  FOR UPDATE;
  SELECT version.* INTO v_master_version FROM public.master_specification_versions version JOIN public.master_specifications specification ON specification.id = version.specification_id WHERE version.id = v_master_version_id AND version.version_number = v_source_version_number AND specification.opportunity_id = v_requirement.opportunity_id AND specification.customer_id = v_requirement.customer_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pinned Master Specification version is unavailable for the immutable requirement revision'; END IF;
  v_workstreams := v_revision.requirement_data #> '{source,applicable_workstreams}';
  IF jsonb_typeof(v_workstreams) IS DISTINCT FROM 'array' OR jsonb_array_length(v_workstreams) = 0 OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_workstreams) AS workstream(value) WHERE jsonb_typeof(workstream.value) <> 'string' OR trim(both '"' FROM workstream.value::text) NOT IN ('HARDWARE', 'FIRMWARE', 'MECHANICAL', 'TEST', 'MANUFACTURING')) THEN RAISE EXCEPTION 'Master Specification workstreams are missing, null, non-string, unknown, or incomplete; applicability is TBC'; END IF;
  SELECT array_agg(department.id ORDER BY department.id) INTO v_required_department_ids FROM public.departments department WHERE department.code = ANY(ARRAY(SELECT jsonb_array_elements_text(v_workstreams)));
  IF v_required_department_ids IS NULL OR cardinality(v_required_department_ids) <> jsonb_array_length(v_workstreams) THEN RAISE EXCEPTION 'Master Specification workstreams do not map to verified departments; applicability is TBC'; END IF;
  SELECT count(*) INTO v_review_count FROM public.requirement_feasibility_reviews review WHERE review.source_revision_id = v_revision.id AND review.requirement_id = v_requirement.id AND review.source_revision_number = v_revision.revision_number AND review.master_specification_version_id = v_master_version.id AND review.master_specification_version_number = v_master_version.version_number AND review.applicable_workstreams = v_workstreams AND review.department_id = ANY(v_required_department_ids) AND review.status IN ('feasible', 'feasible_with_conditions');
  IF v_review_count <> cardinality(v_required_department_ids) THEN RAISE EXCEPTION 'Every applicable department requires a pinned terminal feasible review before baseline approval'; END IF;
  SELECT count(*) INTO v_unresolved_conditions FROM public.requirement_feasibility_reviews review WHERE review.source_revision_id = v_revision.id AND review.department_id = ANY(v_required_department_ids) AND review.status = 'feasible_with_conditions' AND (NULLIF(btrim(coalesce(review.assumptions, '')), '') IS NOT NULL OR NULLIF(btrim(coalesce(review.risks, '')), '') IS NOT NULL);
  IF v_unresolved_conditions > 0 THEN RAISE EXCEPTION 'Pinned feasibility reviews contain unresolved conditions or risks'; END IF;
  -- The preceding requirement lock also serializes the no-row state against a protected
  -- first commercial save. Direct writes are revoked in this same pending group.
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

```

## Full server facade

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
const baselineSchema = z.object({ requirementId: z.string().uuid(), expectedRevisionNumber: z.number().int().positive(), requestKey: z.string().uuid() });
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
/**
 * Intentionally unavailable: the deployed commercial writer is a non-atomic upsert
 * without source locks, expected-version checks, immutable audit, or replay receipts.
 * The pending protected contract replaces it after isolated caller-authenticated
 * acceptance; this facade must never silently fall back to direct table writes.
 */
export const saveCommercialRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => commercialSchema.parse(data))
  .handler(({ data, context }) => {
    void data;
    void context;
    throw new Error("Commercial authorization save is unavailable until the pending protected, replay-safe commercial contract passes real isolated caller-authenticated acceptance.");
  });
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
    throw new Error("Baseline approval is unavailable until the pending revision-bound, replay-safe approval contract passes real isolated caller-authenticated acceptance.");
  });
export const createCustomerPortalAccess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => portalSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: portal, error } = await sb.from("customer_portal_access").insert({ customer_id: data.customerId, contact_id: data.contactId, label: data.label, expires_at: data.expiresAt, created_by: context.userId }).select("id,access_token").single(); if (error || !portal) throw new Error(error?.message ?? "Could not create portal access."); await logSalesActivity(sb, context.userId, "customer_portal_access", portal.id, "created", `Created customer portal access: ${data.label}`); return { id: portal.id, token: portal.access_token }; });
export const initiateSalesHandover = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => handoverSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: handover, error } = await sb.from("sales_project_handovers").upsert({ baseline_id: data.baselineId, status: "initiated", handover_notes: data.handoverNotes, initiated_by: context.userId, initiated_at: new Date().toISOString() }, { onConflict: "baseline_id" }).select("id").single(); if (error || !handover) throw new Error(error?.message ?? "Could not initiate handover."); await sb.from("requirement_baselines").update({ status: "project_initiated" }).eq("id", data.baselineId); await logSalesActivity(sb, context.userId, "sales_project_handover", handover.id, "initiated", "Initiated approved-baseline project handover"); return { id: handover.id }; });
```

## Full structural acceptance file

```sql
-- STRUCTURAL-ONLY SOURCE CHECK. This file is not caller-authenticated database
-- acceptance. SET LOCAL request.jwt.claim.sub can only model function branch shape
-- from a privileged psql connection; it cannot prove JWT verification, transport,
-- RLS, grants, or non-admin caller behavior. Do not run it as evidence of acceptance.
--
-- Real caller transport acceptance is specified in
-- sales_bound_requirement_creation_caller_transport_acceptance.sh and must use two
-- independently authenticated non-service callers against an explicitly approved
-- isolated target. No target is selected by this source file.
\set ON_ERROR_STOP on

-- This preflight is structural only: all values must be false except the protected
-- function execute privilege. A real caller transport runner repeats these checks
-- through authenticated application transport and asserts the returned booleans.
SELECT NOT has_table_privilege('PUBLIC', 'public.sales_requirement_creation_requests', 'SELECT') AS no_public_receipt_read;
SELECT NOT has_table_privilege('PUBLIC', 'public.sales_requirement_creation_requests', 'INSERT') AS no_public_receipt_insert;
SELECT NOT has_table_privilege('anon', 'public.sales_requirement_creation_requests', 'SELECT') AS no_anon_receipt_read;
SELECT NOT has_table_privilege('anon', 'public.sales_requirement_creation_requests', 'INSERT') AS no_anon_receipt_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_requirement_creation_requests', 'SELECT') AS no_authenticated_receipt_read;
SELECT NOT has_table_privilege('authenticated', 'public.sales_requirement_creation_requests', 'INSERT') AS no_authenticated_receipt_insert;
SELECT has_function_privilege('authenticated', 'public.create_sales_bound_customer_requirement(uuid, uuid, uuid, text, text, text, uuid)', 'EXECUTE') AS protected_create_callable;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirements', 'INSERT') AS no_authenticated_requirement_insert;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirements', 'UPDATE') AS no_authenticated_requirement_update;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirement_revisions', 'INSERT') AS no_authenticated_revision_insert;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirement_revisions', 'UPDATE') AS no_authenticated_revision_update;

-- Pending baseline-approval structural preflight. This is not database acceptance.
SELECT NOT has_table_privilege('PUBLIC', 'public.sales_baseline_approval_requests', 'SELECT') AS no_public_baseline_receipt_read;
SELECT NOT has_table_privilege('anon', 'public.sales_baseline_approval_requests', 'INSERT') AS no_anon_baseline_receipt_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_baseline_approval_requests', 'SELECT') AS no_authenticated_baseline_receipt_read;
SELECT NOT has_table_privilege('authenticated', 'public.sales_baseline_approval_requests', 'INSERT') AS no_authenticated_baseline_receipt_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_baseline_approval_requests', 'UPDATE') AS no_authenticated_baseline_receipt_update;
SELECT has_function_privilege('authenticated', 'public.approve_sales_requirement_baseline(uuid, integer, uuid)', 'EXECUTE') AS protected_baseline_callable;
SELECT NOT has_table_privilege('authenticated', 'public.requirement_baselines', 'INSERT') AS no_authenticated_baseline_insert;

-- Pending protected commercial-save structural preflight. This remains structural-only
-- until a real caller transport executes the function against an approved isolated target.
SELECT NOT has_table_privilege('PUBLIC', 'public.sales_commercial_save_requests', 'SELECT') AS no_public_commercial_receipt_read;
SELECT NOT has_table_privilege('anon', 'public.sales_commercial_save_requests', 'INSERT') AS no_anon_commercial_receipt_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_save_requests', 'SELECT') AS no_authenticated_commercial_receipt_read;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_save_requests', 'INSERT') AS no_authenticated_commercial_receipt_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_record_revisions', 'SELECT') AS no_authenticated_commercial_history_read;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_records', 'INSERT') AS no_authenticated_commercial_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_records', 'UPDATE') AS no_authenticated_commercial_update;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_records', 'DELETE') AS no_authenticated_commercial_delete;
SELECT has_function_privilege('authenticated', 'public.save_sales_commercial_record(uuid, integer, text, text, numeric, text, text, text, uuid)', 'EXECUTE') AS protected_commercial_callable;
DO $$
DECLARE
  v_revision_column boolean;
  v_unique_history boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_commercial_records'
      AND column_name = 'revision_number' AND data_type = 'integer' AND is_nullable = 'NO'
  ) INTO v_revision_column;
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public' AND relation.relname = 'sales_commercial_record_revisions'
      AND constraint_row.contype = 'u' AND pg_get_constraintdef(constraint_row.oid) LIKE '%commercial_record_id, revision_number%'
  ) INTO v_unique_history;
  IF NOT v_revision_column OR NOT v_unique_history THEN
    RAISE EXCEPTION 'Commercial revision/history schema contract is incomplete';
  END IF;
END;
$$;

-- Required caller-authenticated isolated assertions, each transactionally isolated:
-- 1. exact expected current revision and pinned provenance are mandatory; legacy NULL
--    provenance, stale revisions, mismatched source pairs, or TBC workstreams fail.
-- 2. every applicable department has one matching terminal feasible verdict; a verdict
--    pinned to a historic revision never satisfies a newer revision.
-- 3. unresolved conditions/risks and missing verified customer authorization fail.
-- 4. the existing trigger assigns the baseline number; callers have no number parameter.
-- 5. identical actor/key/payload replays after later source changes; changed payload rejects.
-- 6. concurrent same-key approvals converge to one baseline/receipt/audit; forced audit
--    failure rolls all three back; direct receipt/baseline writes remain denied.
-- 7. while approval holds the revision-scoped review locks, an assigned-reviewer response
--    and a Sales reassignment wait and then re-evaluate against the post-approval source;
--    no baseline may snapshot a review mid-transition.
-- 8. while approval holds its commercial row lock, a protected commercial authorization
--    update waits and no baseline may snapshot a partly changed authorization.
-- 9. two new commercial saves for the same requirement serialize through the requirement
--    lock: exactly one revision-one row/history/receipt/audit survives; the other stale
--    expected-revision request fails rather than silently overwriting it.
-- 10. an exact same-actor/key/payload replay returns the stored commercial record without
--    appending history/audit; changed actor or payload rejects. A forced activity-log
--    failure leaves no commercial row, history row, or receipt.

-- Required executable assertions in the real caller transport runner:
-- 1. approved isolated target refusal before any request is sent;
-- 2. real authenticated Sales creation produces exactly one requirement, revision 1,
--    source_bound_created audit, and receipt; all are rolled back in an audit-failure case;
-- 3. identical retry returns the same ID and exact counts stay one;
-- 4. changed title, summary, customer, version, or caller under the same key rejects;
-- 5. an exact replay after controlled Master-version advance returns the historical ID,
--    while a fresh key using the now-stale Master version rejects;
-- 6. two real authenticated sessions with one key converge to one persisted result;
-- 7. a protected create holds its source locks while a protected controlled source update
--    blocks, then resolves without changing the first create's persisted provenance;
-- 8. direct receipt/requirement/revision writes are denied to each real caller.
-- 9. real authenticated Sales baseline approval creates exactly one trigger-numbered
--    baseline, audit, and receipt; an exact replay after an allowed source advance returns
--    the original baseline only after re-checking the caller capability; changed actor or
--    payload rejects before any new write.
-- 10. forced audit failure rolls baseline, receipt, and number allocation transaction back;
--    concurrent same-key baseline calls converge to one returned ID and exact counts one.
```

## Full real caller-transport harness

```bash
#!/usr/bin/env bash
# REAL CALLER-TRANSPORT ACCEPTANCE HARNESS — intentionally refuses execution until an
# approved isolated target, authenticated non-service wrappers, and read-only assertion
# transport are supplied. It never sets request.jwt.claim.* and never connects with a
# service-role credential. It never connects with a service-role credential. Each wrapper must expose one protected operation over its own
# authenticated application/session transport and return JSON on stdout.
set -euo pipefail

: "${ISOLATED_TARGET_NAME:?Name the approved isolated target}"
: "${APPROVED_ISOLATED_TARGET_NAME:?Expected approved isolated target name}"
: "${SALES_CALLER_TRANSPORT:?Executable that sends one authenticated Sales RPC call}"
: "${SOURCE_EDITOR_TRANSPORT:?Executable that sends one authenticated controlled source-save call}"
: "${BASELINE_CALLER_TRANSPORT:?Executable that sends one authenticated baseline RPC call}"
: "${COMMERCIAL_EDITOR_TRANSPORT:?Executable that sends one authenticated protected commercial-save call}"
: "${REVIEW_TRANSITION_TRANSPORT:?Executable that sends one authenticated protected review transition}"
: "${READ_ASSERT_TRANSPORT:?Executable that performs approved read-only persisted-state assertions}"
: "${SALES_SECOND_CALLER_TRANSPORT:?Executable that sends one authenticated Sales call as a second approved caller}"
: "${REVIEWER_CALLER_TRANSPORT:?Executable that sends one authenticated reviewer decision as the assigned reviewer}"
: "${OPPORTUNITY_ID:?}" "${CUSTOMER_ID:?}" "${MASTER_VERSION_ID:?}" "${SPECIFICATION_ID:?}"
: "${REQUEST_KEY:?}" "${REQUEST_KEY_B:?}" "${EXPECTED_VERSION:?}"

if [[ "$ISOLATED_TARGET_NAME" != "$APPROVED_ISOLATED_TARGET_NAME" ]]; then
  echo "Refusing unapproved isolated target" >&2
  exit 64
fi
if [[ "${ORIGINAL_TARGET_NAME:-}" == "$ISOLATED_TARGET_NAME" ]]; then
  echo "Refusing original target" >&2
  exit 64
fi

# Transport wrappers must take JSON on stdin, return JSON on stdout, and use their
# caller's own authenticated application/session transport. They must not interpolate
# SQL, set JWT GUCs, use database superuser credentials, or use service_role.
call_sales() { "$SALES_CALLER_TRANSPORT"; }
call_editor() { "$SOURCE_EDITOR_TRANSPORT"; }
call_baseline() { "$BASELINE_CALLER_TRANSPORT"; }
call_commercial() { "$COMMERCIAL_EDITOR_TRANSPORT"; }
call_review_transition() { "$REVIEW_TRANSITION_TRANSPORT"; }
read_assert() { "$READ_ASSERT_TRANSPORT"; }
call_sales_second() { "$SALES_SECOND_CALLER_TRANSPORT"; }
call_reviewer() { "$REVIEWER_CALLER_TRANSPORT"; }

assert_count() {
  local entity="$1" expected="$2" where="$3"
  local actual
  actual="$(jq -cn --arg entity "$entity" --arg where "$where" '{kind:"count",entity:$entity,where:$where}' | read_assert | jq -er '.count')"
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected $entity count $expected, got $actual for $where" >&2
    exit 1
  fi
}

assert_id() {
  local entity="$1" expected="$2" where="$3"
  local actual
  actual="$(jq -cn --arg entity "$entity" --arg where "$where" '{kind:"id",entity:$entity,where:$where}' | read_assert | jq -er '.id')"
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected $entity ID $expected, got $actual for $where" >&2
    exit 1
  fi
}

create_payload() {
  local key="$1" version="$2" title="$3"
  jq -cn --arg opportunityId "$OPPORTUNITY_ID" --arg customerId "$CUSTOMER_ID" \
    --arg masterSpecificationVersionId "$version" --arg requestKey "$key" --arg title "$title" \
    '{opportunityId:$opportunityId,customerId:$customerId,masterSpecificationVersionId:$masterSpecificationVersionId,requestKey:$requestKey,title:$title,customerReference:"TRANSPORT-ACCEPT",summary:"Isolated acceptance only."}'
}

first="$(create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Transport acceptance requirement" | call_sales)"
first_id="$(jq -er '.id' <<<"$first")"
retry="$(create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Transport acceptance requirement" | call_sales)"
test "$first_id" = "$(jq -er '.id' <<<"$retry")"
assert_id "sales_requirement_creation_requests" "$first_id" "request_key=$REQUEST_KEY"
assert_count "customer_requirements" 1 "request_key=$REQUEST_KEY"
assert_count "customer_requirement_revisions" 1 "requirement_id=$first_id;revision_number=1"
assert_count "activity_log" 1 "entity_id=$first_id;action=source_bound_created"
assert_count "sales_requirement_creation_requests" 1 "request_key=$REQUEST_KEY"

# Changed payload must fail; the wrapper's nonzero status is asserted without SQL text.
if create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Changed title" | call_sales >/dev/null 2>&1; then
  echo "Changed-payload replay unexpectedly succeeded" >&2; exit 1
fi
if create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Wrong customer" | call_sales_second >/dev/null 2>&1; then
  echo "Wrong actor/customer replay unexpectedly succeeded" >&2; exit 1
fi

# The protected-create/source-update overlap is exercised through the real caller wrappers.
# The controlled editor advances the source with the current expected version.
# A fresh key intentionally reuses the historical MASTER_VERSION_ID and must fail.
jq -cn --arg specificationId "$SPECIFICATION_ID" --arg opportunityId "$OPPORTUNITY_ID" \
  --arg customerId "$CUSTOMER_ID" --argjson expectedVersion "$EXPECTED_VERSION" \
  '{specificationId:$specificationId,opportunityId:$opportunityId,customerId:$customerId,expectedVersion:$expectedVersion}' | call_editor >/dev/null
replay="$(create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Transport acceptance requirement" | call_sales)"
test "$first_id" = "$(jq -er '.id' <<<"$replay")"
if create_payload "$REQUEST_KEY_B" "$MASTER_VERSION_ID" "Fresh stale version" | call_sales >/dev/null 2>&1; then
  echo "Fresh stale-version creation unexpectedly succeeded" >&2; exit 1
fi

# The runner supplies a deliberately rejected operation with an approved isolated
# failure-injection key. Every mutation must roll back, including its receipt/audit.
: "${ROLLBACK_REQUEST_KEY:?}" "${FAILURE_INJECTION_TOKEN:?}"
rollback_payload="$(create_payload "$ROLLBACK_REQUEST_KEY" "$MASTER_VERSION_ID" "Forced rollback")"
if jq --arg failureInjection "$FAILURE_INJECTION_TOKEN" '. + {failureInjection:$failureInjection}' <<<"$rollback_payload" | call_sales >/dev/null 2>&1; then
  echo "Forced requirement audit rollback unexpectedly succeeded" >&2; exit 1
fi
assert_count "customer_requirements" 0 "request_key=$ROLLBACK_REQUEST_KEY"
assert_count "customer_requirement_revisions" 0 "request_key=$ROLLBACK_REQUEST_KEY"
assert_count "activity_log" 0 "request_key=$ROLLBACK_REQUEST_KEY"
assert_count "sales_requirement_creation_requests" 0 "request_key=$ROLLBACK_REQUEST_KEY"

# Commercial contract assertions are deliberately executable only through the supplied
# authenticated wrapper. The wrapper must return a JSON object containing `id` and
# `revisionNumber`; it must not use SQL transport or service credentials.
commercial_payload() {
  local key="$1" expected_revision="$2" amount="$3"
  jq -cn --arg requirementId "$REQUIREMENT_ID" --arg requestKey "$key" \
    --argjson expectedRevisionNumber "$expected_revision" --argjson quotedAmount "$amount" \
    '{requirementId:$requirementId,requestKey:$requestKey,expectedRevisionNumber:$expectedRevisionNumber,quotationReference:"TRANSPORT-COMMERCIAL",currency:"INR",quotedAmount:$quotedAmount,status:"sent",authorizationReference:null,notes:"Isolated acceptance only."}'
}

: "${REQUEST_KEY_COMMERCIAL:?}" "${REQUEST_KEY_COMMERCIAL_B:?}" "${REQUIREMENT_ID:?}" "${COMMERCIAL_EXPECTED_REVISION:?}"
commercial_first="$(commercial_payload "$REQUEST_KEY_COMMERCIAL" "$COMMERCIAL_EXPECTED_REVISION" 100 | call_commercial)"
commercial_id="$(jq -er '.id' <<<"$commercial_first")"
commercial_revision="$(jq -er '.revisionNumber' <<<"$commercial_first")"
commercial_retry="$(commercial_payload "$REQUEST_KEY_COMMERCIAL" "$COMMERCIAL_EXPECTED_REVISION" 100 | call_commercial)"
test "$commercial_id" = "$(jq -er '.id' <<<"$commercial_retry")"
test "$commercial_revision" = "$(jq -er '.revisionNumber' <<<"$commercial_retry")"
assert_count "sales_commercial_records" 1 "requirement_id=$REQUIREMENT_ID"
assert_count "sales_commercial_record_revisions" 1 "commercial_record_id=$commercial_id;revision_number=$commercial_revision"
assert_count "sales_commercial_save_requests" 1 "request_key=$REQUEST_KEY_COMMERCIAL"
assert_count "activity_log" 1 "entity_id=$commercial_id;action=saved"
if commercial_payload "$REQUEST_KEY_COMMERCIAL" "$COMMERCIAL_EXPECTED_REVISION" 101 | call_commercial >/dev/null 2>&1; then
  echo "Changed commercial replay unexpectedly succeeded" >&2; exit 1
fi
if commercial_payload "$REQUEST_KEY_COMMERCIAL_B" "$COMMERCIAL_EXPECTED_REVISION" 102 | call_commercial >/dev/null 2>&1; then
  echo "Stale commercial revision unexpectedly succeeded" >&2; exit 1
fi

# Prerequisite feasibility decision is exercised as the assigned reviewer, never the
# Sales caller. Wrong reviewer/version/requirement-customer pairing must be rejected.
: "${REVIEW_ID:?}" "${REVIEWER_REQUEST_KEY:?}" "${BASELINE_REQUEST_KEY:?}"
review_payload="$(jq -cn --arg reviewId "$REVIEW_ID" --arg requestKey "$REVIEWER_REQUEST_KEY" '{reviewId:$reviewId,requestKey:$requestKey,status:"feasible",findings:"Isolated acceptance decision",assumptions:null,risks:null}')"
review_result="$(printf '%s' "$review_payload" | call_reviewer)"
test "$REVIEW_ID" = "$(jq -er '.id' <<<"$review_result")"
assert_count "activity_log" 1 "entity_id=$REVIEW_ID;action=responded"
if jq '.reviewId = "00000000-0000-0000-0000-000000000000"' <<<"$review_payload" | call_reviewer >/dev/null 2>&1; then
  echo "Wrong review/version decision unexpectedly succeeded" >&2; exit 1
fi

baseline_payload="$(jq -cn --arg requirementId "$REQUIREMENT_ID" --arg requestKey "$BASELINE_REQUEST_KEY" --argjson expectedRevisionNumber 1 '{requirementId:$requirementId,requestKey:$requestKey,expectedRevisionNumber:$expectedRevisionNumber}')"
baseline_first="$(printf '%s' "$baseline_payload" | call_baseline)"
baseline_id="$(jq -er '.id' <<<"$baseline_first")"
baseline_retry="$(printf '%s' "$baseline_payload" | call_baseline)"
test "$baseline_id" = "$(jq -er '.id' <<<"$baseline_retry")"
assert_count "requirement_baselines" 1 "id=$baseline_id"
assert_count "sales_baseline_approval_requests" 1 "request_key=$BASELINE_REQUEST_KEY"
assert_count "activity_log" 1 "entity_id=$baseline_id;action=approved"

# A real two-session barrier is mandatory: wrappers must accept the test barrier field,
# wait until both requests are present, and return only after the protected transaction.
: "${CONCURRENCY_BARRIER_ID:?}" "${CONCURRENT_REQUEST_KEY:?}" "${CONCURRENT_REQUEST_KEY_B:?}"
concurrent_payload="$(create_payload "$CONCURRENT_REQUEST_KEY" "$MASTER_VERSION_ID" "Two-session concurrency" | jq --arg barrier "$CONCURRENCY_BARRIER_ID" '. + {barrier:$barrier}')"
concurrent_payload_b="$(create_payload "$CONCURRENT_REQUEST_KEY_B" "$MASTER_VERSION_ID" "Two-session concurrency B" | jq --arg barrier "$CONCURRENCY_BARRIER_ID" '. + {barrier:$barrier}')"
printf '%s' "$concurrent_payload" | call_sales >"${TMPDIR:-/tmp}/sales-create-a.json" & pid_a=$!
printf '%s' "$concurrent_payload_b" | call_sales_second >"${TMPDIR:-/tmp}/sales-create-b.json" & pid_b=$!
wait "$pid_a"; wait "$pid_b"
concurrent_a="$(jq -er '.id' "${TMPDIR:-/tmp}/sales-create-a.json")"
concurrent_b="$(jq -er '.id' "${TMPDIR:-/tmp}/sales-create-b.json")"
if [[ "$concurrent_a" == "$concurrent_b" ]]; then
  echo "Distinct concurrent request keys unexpectedly returned one requirement" >&2; exit 1
fi
assert_count "customer_requirements" 2 "barrier=$CONCURRENCY_BARRIER_ID"
assert_count "sales_requirement_creation_requests" 2 "barrier=$CONCURRENCY_BARRIER_ID"
```

## Execution status

- **Ran:** source-level contract assertions, focused tests, typecheck, production build, harness shell syntax, and export synchronization.
- **Prepared but not run:** structural SQL assertions and real caller-transport cases for direct-write denial, exact replay, stale revision, phantom insertion, baseline/commercial overlap, audit rollback, and authorization. They require a separately approved isolated target, authenticated non-service callers, and controlled failure injection.
- **Not changed:** live database schema/data/grants/users/fixtures, source records, generation, or publishing.

## Isolated caller-transport acceptance status

**Read-only isolated preflight performed:** the allowlisted isolated backend `egjotuxqguifnvdnflan` was inspected without mutation. `sales_commercial_records` exists; `requirement_feasibility_reviews.source_revision_id` and the pending `save_sales_commercial_record` routine do not.

**Not executed:** the caller-transport harness is intentionally blocked. It now asserts persisted IDs, counts, revision history, receipts, audit rows, rollback cleanup, stale-source refusal, wrong-actor refusal, protected reviewer decisions, baseline replay, and two-session concurrency once all approved inputs are present.

**Exact missing approved prerequisites:** a non-admin Sales caller with `sales.manage`; an assigned active reviewer; a separate wrong-actor/customer caller; the pending protected RPCs; authenticated application-RPC wrappers; read-only persistence assertion transport; an isolated failure-injection boundary; and two independent caller sessions plus an overlap barrier. The original backend is refused by the preflight and must not be used.


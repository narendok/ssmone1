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

-- PENDING POSITIVE-ONLY READBACK CONTRACT — SOURCE-ONLY. This deliberately exposes no
-- receipt table, payload, number, title, count, or arbitrary filter API. It is limited to
-- one exact, actor-bound *positive* receipt graph during isolated acceptance. Absence is not
-- evidence: rollback absence and source-version history require separately reviewed scoped
-- contracts and remain BLOCKED.
--
-- The current source-table RLS policies allow every sales.manage actor to read Sales
-- opportunities, Master Specifications/versions, and customer requirements/revisions. This
-- function checks the same permission before its SECURITY DEFINER access. activity_log has no
-- equivalent Sales caller SELECT policy, so only this fixed audit predicate may expose its ID.
-- Deploy only after separate caller-RLS acceptance verifies every denial and linkage case.
CREATE OR REPLACE FUNCTION public.read_sales_bound_requirement_creation_receipt(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_master_specification_version_id uuid,
  p_request_key uuid
) RETURNS TABLE(
  request_key uuid,
  requirement_id uuid,
  revision_id uuid,
  revision_number integer,
  audit_id uuid,
  opportunity_id uuid,
  customer_id uuid,
  master_specification_version_id uuid,
  master_specification_version_number integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_receipt public.sales_requirement_creation_requests%ROWTYPE;
  v_requirement public.customer_requirements%ROWTYPE;
  v_revision public.customer_requirement_revisions%ROWTYPE;
  v_audit_id uuid;
  v_audit_count integer;
  v_source_version_number integer;
BEGIN
  -- Authorize before receipt lookup so a wrong actor or scope cannot learn whether it exists.
  IF v_actor_id IS NULL OR NOT public.has_permission(v_actor_id, 'sales.manage') THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;
  IF p_opportunity_id IS NULL OR p_customer_id IS NULL
     OR p_master_specification_version_id IS NULL OR p_request_key IS NULL THEN
    RAISE EXCEPTION 'Immutable receipt-readback scope is required';
  END IF;
  -- This is the same global Sales scope enforced by the current RLS policies for the
  -- source records; never infer access from a nullable department or ownership field.
  SELECT version.version_number INTO v_source_version_number
  FROM public.sales_opportunities opportunity
  JOIN public.master_specifications specification
    ON specification.opportunity_id = opportunity.id
   AND specification.customer_id = opportunity.customer_id
  JOIN public.master_specification_versions version
    ON version.specification_id = specification.id
  WHERE opportunity.id = p_opportunity_id
    AND opportunity.customer_id = p_customer_id
    AND version.id = p_master_specification_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scoped Sales source is unavailable';
  END IF;

  SELECT * INTO v_receipt
  FROM public.sales_requirement_creation_requests receipt
  WHERE receipt.request_key = p_request_key
    AND receipt.requested_by = v_actor_id
    AND receipt.opportunity_id = p_opportunity_id
    AND receipt.customer_id = p_customer_id
    AND receipt.master_specification_version_id = p_master_specification_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Positive scoped receipt graph is unavailable or incomplete';
  END IF;

  SELECT * INTO v_requirement
  FROM public.customer_requirements requirement
  WHERE requirement.id = v_receipt.requirement_id
    AND requirement.opportunity_id = v_receipt.opportunity_id
    AND requirement.customer_id = v_receipt.customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Positive scoped receipt graph is unavailable or incomplete';
  END IF;

  SELECT * INTO v_revision
  FROM public.customer_requirement_revisions revision
  WHERE revision.requirement_id = v_requirement.id
    AND revision.revision_number = 1
    AND revision.requirement_data #>> '{source,opportunity_id}' = v_receipt.opportunity_id::text
    AND revision.requirement_data #>> '{source,customer_id}' = v_receipt.customer_id::text
    AND revision.requirement_data #>> '{source,master_specification_version_id}' = v_receipt.master_specification_version_id::text
    AND revision.requirement_data #>> '{source,master_specification_version_number}' = v_source_version_number::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Positive scoped receipt graph is unavailable or incomplete';
  END IF;

  SELECT count(*), min(audit.id::text)::uuid
  INTO v_audit_count, v_audit_id
  FROM public.activity_log audit
  WHERE audit.entity_id = v_requirement.id
    AND audit.module_key = 'sales'
    AND audit.entity_type = 'customer_requirement'
    AND audit.action = 'source_bound_created'
    AND audit.actor_user_id = v_receipt.requested_by
    AND audit.after_data #>> '{request_key}' = v_receipt.request_key::text
    AND audit.after_data #>> '{opportunity_id}' = v_receipt.opportunity_id::text
    AND audit.after_data #>> '{customer_id}' = v_receipt.customer_id::text
    AND audit.after_data #>> '{master_specification_version_id}' = v_receipt.master_specification_version_id::text
    AND audit.after_data #>> '{master_specification_version_number}' = v_source_version_number::text
    AND audit.after_data #>> '{revision_number}' = '1';
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Positive scoped receipt graph is unavailable or incomplete';
  END IF;

  RETURN QUERY SELECT
    v_receipt.request_key,
    v_receipt.requirement_id,
    v_revision.id,
    v_revision.revision_number,
    v_audit_id,
    v_receipt.opportunity_id,
    v_receipt.customer_id,
    v_receipt.master_specification_version_id,
    v_source_version_number;
END;
$$;
REVOKE ALL ON FUNCTION public.read_sales_bound_requirement_creation_receipt(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_sales_bound_requirement_creation_receipt(uuid, uuid, uuid, uuid) TO authenticated, service_role;

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

-- PENDING POSITIVE-ONLY COMMERCIAL READBACK CONTRACT — SOURCE-ONLY. This exposes no
-- receipt payload, commercial snapshot, count, or arbitrary filter API. It validates one
-- exact actor-bound saved graph only. Empty results cannot prove rollback absence, history,
-- or concurrency, so those assertions remain BLOCKED pending separate scoped contracts.
-- The requirement/source lookup intentionally mirrors the deployed global sales.manage
-- caller-RLS read scope; no nullable department or ownership field is inferred here.
CREATE OR REPLACE FUNCTION public.read_sales_commercial_save_receipt(
  p_requirement_id uuid,
  p_expected_revision_number integer,
  p_request_key uuid
) RETURNS TABLE(
  request_key uuid,
  requirement_id uuid,
  expected_revision_number integer,
  commercial_record_id uuid,
  commercial_revision_id uuid,
  commercial_revision_number integer,
  audit_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_receipt public.sales_commercial_save_requests%ROWTYPE;
  v_requirement public.customer_requirements%ROWTYPE;
  v_commercial public.sales_commercial_records%ROWTYPE;
  v_revision public.sales_commercial_record_revisions%ROWTYPE;
  v_audit_id uuid;
  v_audit_count integer;
  v_revision_payload_canonical jsonb;
  v_revision_payload_hash text;
BEGIN
  -- Authorize before every receipt lookup so a wrong actor or scope cannot learn existence.
  IF v_actor_id IS NULL OR NOT public.has_permission(v_actor_id, 'sales.manage') THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;
  IF p_requirement_id IS NULL OR p_expected_revision_number IS NULL
     OR p_expected_revision_number < 0 OR p_request_key IS NULL THEN
    RAISE EXCEPTION 'Immutable commercial receipt-readback scope is required';
  END IF;

  -- This asserts an existing globally Sales-readable requirement before inspecting a receipt.
  SELECT * INTO v_requirement
  FROM public.customer_requirements requirement
  WHERE requirement.id = p_requirement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scoped commercial source is unavailable';
  END IF;

  SELECT * INTO v_receipt
  FROM public.sales_commercial_save_requests receipt
  WHERE receipt.request_key = p_request_key
    AND receipt.requested_by = v_actor_id
    AND receipt.requirement_id = p_requirement_id
    AND receipt.expected_revision_number = p_expected_revision_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Positive scoped commercial receipt graph is unavailable or incomplete';
  END IF;

  SELECT * INTO v_commercial
  FROM public.sales_commercial_records commercial
  WHERE commercial.id = v_receipt.commercial_record_id
    AND commercial.requirement_id = v_receipt.requirement_id
    AND commercial.revision_number = v_receipt.expected_revision_number + 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Positive scoped commercial receipt graph is unavailable or incomplete';
  END IF;

  SELECT * INTO v_revision
  FROM public.sales_commercial_record_revisions revision
  WHERE revision.commercial_record_id = v_commercial.id
    AND revision.requirement_id = v_receipt.requirement_id
    AND revision.revision_number = v_commercial.revision_number
    AND revision.created_by = v_receipt.requested_by
    AND revision.snapshot #>> '{commercial_record_id}' = v_commercial.id::text
    AND revision.snapshot #>> '{requirement_id}' = v_receipt.requirement_id::text
    AND revision.snapshot #>> '{revision_number}' = v_commercial.revision_number::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Positive scoped commercial receipt graph is unavailable or incomplete';
  END IF;

  -- Reconstruct from the immutable revision snapshot, never the mutable commercial row.
  -- JSON extraction/casting is deliberately strict: malformed or missing historical content
  -- aborts this positive-only proof rather than falling back to a current record value.
  v_revision_payload_canonical := public.sales_commercial_save_canonical_payload(
    v_receipt.requirement_id,
    v_receipt.expected_revision_number,
    v_revision.snapshot #>> '{quotation_reference}',
    v_revision.snapshot #>> '{currency}',
    (v_revision.snapshot #>> '{quoted_amount}')::numeric,
    v_revision.snapshot #>> '{status}',
    v_revision.snapshot #>> '{authorization_reference}',
    v_revision.snapshot #>> '{notes}'
  );
  v_revision_payload_hash := public.sales_commercial_save_payload_hash(
    v_receipt.requirement_id,
    v_receipt.expected_revision_number,
    v_revision.snapshot #>> '{quotation_reference}',
    v_revision.snapshot #>> '{currency}',
    (v_revision.snapshot #>> '{quoted_amount}')::numeric,
    v_revision.snapshot #>> '{status}',
    v_revision.snapshot #>> '{authorization_reference}',
    v_revision.snapshot #>> '{notes}'
  );
  IF v_receipt.payload_canonical IS DISTINCT FROM v_revision_payload_canonical
     OR v_receipt.payload_hash IS DISTINCT FROM v_revision_payload_hash THEN
    RAISE EXCEPTION 'Positive scoped commercial receipt graph is unavailable or incomplete';
  END IF;

  SELECT count(*), min(audit.id::text)::uuid
  INTO v_audit_count, v_audit_id
  FROM public.activity_log audit
  WHERE audit.entity_id = v_commercial.id
    AND audit.module_key = 'sales'
    AND audit.entity_type = 'sales_commercial_record'
    AND audit.action = 'saved'
    AND audit.actor_user_id = v_receipt.requested_by
    AND audit.after_data #>> '{requirement_id}' = v_receipt.requirement_id::text
    AND audit.after_data #>> '{request_key}' = v_receipt.request_key::text
    AND audit.after_data #>> '{status}' = v_revision.snapshot #>> '{status}'
    AND audit.after_data -> 'authorization_reference' IS NOT DISTINCT FROM v_revision.snapshot -> 'authorization_reference';
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Positive scoped commercial receipt graph is unavailable or incomplete';
  END IF;

  RETURN QUERY SELECT
    v_receipt.request_key,
    v_receipt.requirement_id,
    v_receipt.expected_revision_number,
    v_commercial.id,
    v_revision.id,
    v_commercial.revision_number,
    v_audit_id;
END;
$$;
REVOKE ALL ON FUNCTION public.read_sales_commercial_save_receipt(uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_sales_commercial_save_receipt(uuid, integer, uuid) TO authenticated, service_role;

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

-- PENDING POSITIVE-ONLY BASELINE READBACK CONTRACT — SOURCE-ONLY. This returns no
-- receipt payload, baseline snapshot, count, or arbitrary filter API. It validates one
-- actor-bound approval receipt graph from immutable receipt, revision, Master-version,
-- commercial-revision, and baseline snapshots only. Empty results cannot prove rollback absence, reviewer history, or concurrency, so those assertions remain BLOCKED pending
-- separately scoped contracts. The requirement/source lookup mirrors the deployed global
-- sales.manage caller-RLS scope; no nullable department or ownership field is inferred here.
CREATE OR REPLACE FUNCTION public.read_sales_requirement_baseline_approval_receipt(
  p_requirement_id uuid,
  p_expected_revision_number integer,
  p_source_revision_id uuid,
  p_master_specification_version_id uuid,
  p_request_key uuid
) RETURNS TABLE(
  request_key uuid,
  requirement_id uuid,
  expected_revision_number integer,
  source_revision_id uuid,
  master_specification_version_id uuid,
  master_specification_version_number integer,
  baseline_id uuid,
  audit_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_receipt public.sales_baseline_approval_requests%ROWTYPE;
  v_requirement public.customer_requirements%ROWTYPE;
  v_revision public.customer_requirement_revisions%ROWTYPE;
  v_master_version public.master_specification_versions%ROWTYPE;
  v_commercial_revision public.sales_commercial_record_revisions%ROWTYPE;
  v_baseline public.requirement_baselines%ROWTYPE;
  v_audit_id uuid;
  v_audit_count integer;
  v_payload_canonical jsonb;
  v_payload_hash text;
BEGIN
  -- Authorize before every receipt lookup so a wrong actor or scope cannot learn existence.
  IF v_actor_id IS NULL OR NOT public.has_permission(v_actor_id, 'sales.manage') THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;
  IF p_requirement_id IS NULL OR p_expected_revision_number IS NULL
     OR p_expected_revision_number < 1 OR p_source_revision_id IS NULL
     OR p_master_specification_version_id IS NULL OR p_request_key IS NULL THEN
    RAISE EXCEPTION 'Immutable baseline receipt-readback scope is required';
  END IF;

  -- This asserts an existing globally Sales-readable requirement before inspecting a receipt.
  SELECT * INTO v_requirement
  FROM public.customer_requirements requirement
  WHERE requirement.id = p_requirement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scoped baseline source is unavailable';
  END IF;

  SELECT * INTO v_receipt
  FROM public.sales_baseline_approval_requests receipt
  WHERE receipt.request_key = p_request_key
    AND receipt.requested_by = v_actor_id
    AND receipt.requirement_id = p_requirement_id
    AND receipt.source_revision_id = p_source_revision_id
    AND receipt.master_specification_version_id = p_master_specification_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Positive scoped baseline receipt graph is unavailable or incomplete';
  END IF;

  v_payload_canonical := public.sales_baseline_approval_canonical_payload(
    v_receipt.requirement_id, p_expected_revision_number
  );
  v_payload_hash := public.sales_baseline_approval_payload_hash(
    v_receipt.requirement_id, p_expected_revision_number
  );
  IF v_receipt.payload_canonical IS DISTINCT FROM v_payload_canonical
     OR v_receipt.payload_hash IS DISTINCT FROM v_payload_hash THEN
    RAISE EXCEPTION 'Positive scoped baseline receipt graph is unavailable or incomplete';
  END IF;

  SELECT * INTO v_revision
  FROM public.customer_requirement_revisions revision
  WHERE revision.id = v_receipt.source_revision_id
    AND revision.requirement_id = v_receipt.requirement_id
    AND revision.revision_number = p_expected_revision_number
    AND revision.requirement_data #>> '{source,opportunity_id}' = v_requirement.opportunity_id::text
    AND revision.requirement_data #>> '{source,customer_id}' = v_requirement.customer_id::text
    AND revision.requirement_data #>> '{source,master_specification_version_id}' = v_receipt.master_specification_version_id::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Positive scoped baseline receipt graph is unavailable or incomplete';
  END IF;

  SELECT version.* INTO v_master_version
  FROM public.master_specification_versions version
  JOIN public.master_specifications specification ON specification.id = version.specification_id
  WHERE version.id = v_receipt.master_specification_version_id
    AND specification.opportunity_id = v_requirement.opportunity_id
    AND specification.customer_id = v_requirement.customer_id;
  IF NOT FOUND
     OR v_revision.requirement_data #>> '{source,master_specification_version_number}' IS DISTINCT FROM v_master_version.version_number::text
     OR jsonb_typeof(v_master_version.specification_data -> 'workstreams') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_master_version.specification_data -> 'workstreams') = 0
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_master_version.specification_data -> 'workstreams') AS workstream(value)
       WHERE jsonb_typeof(workstream.value) <> 'string'
          OR trim(both '"' FROM workstream.value::text) NOT IN ('HARDWARE', 'FIRMWARE', 'MECHANICAL', 'TEST', 'MANUFACTURING')
     ) THEN
    RAISE EXCEPTION 'Positive scoped baseline receipt graph is unavailable or incomplete';
  END IF;

  SELECT * INTO v_baseline
  FROM public.requirement_baselines baseline
  WHERE baseline.id = v_receipt.baseline_id
    AND baseline.requirement_id = v_receipt.requirement_id
    AND baseline.revision_number = p_expected_revision_number
    AND baseline.approved_by = v_receipt.requested_by
    AND baseline.requirement_snapshot #>> '{requirement_id}' = v_receipt.requirement_id::text
    AND baseline.requirement_snapshot #>> '{source_revision_id}' = v_receipt.source_revision_id::text
    AND baseline.requirement_snapshot #>> '{source_revision_number}' = p_expected_revision_number::text
    AND baseline.requirement_snapshot #>> '{master_specification_version_id}' = v_receipt.master_specification_version_id::text
    AND baseline.requirement_snapshot #>> '{master_specification_version_number}' = v_master_version.version_number::text
    AND baseline.requirement_snapshot -> 'requirement_data' = v_revision.requirement_data
    AND baseline.requirement_snapshot -> 'applicable_workstreams' = v_master_version.specification_data -> 'workstreams'
    AND baseline.commercial_snapshot #>> '{requirement_id}' = v_receipt.requirement_id::text
    AND baseline.commercial_snapshot #>> '{id}' IS NOT NULL
    AND baseline.commercial_snapshot #>> '{status}' = 'customer_authorized'
    AND baseline.commercial_snapshot -> 'customer_authorized_at' IS NOT NULL
    AND jsonb_typeof(baseline.commercial_snapshot -> 'customer_authorized_at') = 'string'
    AND NULLIF(btrim(coalesce(baseline.commercial_snapshot #>> '{authorization_reference}', '')), '') IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Positive scoped baseline receipt graph is unavailable or incomplete';
  END IF;

  -- The baseline snapshot stores no immutable commercial-revision identifier. Its exact
  -- historical identity is therefore limited to the matching immutable snapshot below;
  -- if a future snapshot format adds an explicit revision ID, a separately reviewed
  -- contract may tighten this linkage. Never infer it from the mutable current record.
  SELECT * INTO v_commercial_revision
  FROM public.sales_commercial_record_revisions revision
  WHERE revision.requirement_id = v_receipt.requirement_id
    AND revision.snapshot #>> '{commercial_record_id}' = v_baseline.commercial_snapshot #>> '{id}'
    AND revision.snapshot #>> '{requirement_id}' = v_receipt.requirement_id::text
    AND revision.snapshot -> 'quotation_reference' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'quotation_reference'
    AND revision.snapshot -> 'currency' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'currency'
    AND revision.snapshot -> 'quoted_amount' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'quoted_amount'
    AND revision.snapshot -> 'status' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'status'
    AND revision.snapshot -> 'customer_authorized_at' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'customer_authorized_at'
    AND revision.snapshot -> 'authorization_reference' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'authorization_reference'
    AND revision.snapshot -> 'notes' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'notes';
  IF NOT FOUND OR EXISTS (
    SELECT 1
    FROM public.sales_commercial_record_revisions revision
    WHERE revision.requirement_id = v_receipt.requirement_id
      AND revision.snapshot #>> '{commercial_record_id}' = v_baseline.commercial_snapshot #>> '{id}'
      AND revision.snapshot #>> '{requirement_id}' = v_receipt.requirement_id::text
      AND revision.snapshot -> 'quotation_reference' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'quotation_reference'
      AND revision.snapshot -> 'currency' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'currency'
      AND revision.snapshot -> 'quoted_amount' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'quoted_amount'
      AND revision.snapshot -> 'status' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'status'
      AND revision.snapshot -> 'customer_authorized_at' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'customer_authorized_at'
      AND revision.snapshot -> 'authorization_reference' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'authorization_reference'
      AND revision.snapshot -> 'notes' IS NOT DISTINCT FROM v_baseline.commercial_snapshot -> 'notes'
      AND revision.id <> v_commercial_revision.id
  ) THEN
    RAISE EXCEPTION 'Positive scoped baseline receipt graph is unavailable or incomplete';
  END IF;

  SELECT count(*), min(audit.id::text)::uuid
  INTO v_audit_count, v_audit_id
  FROM public.activity_log audit
  WHERE audit.entity_id = v_baseline.id
    AND audit.module_key = 'sales'
    AND audit.entity_type = 'requirement_baseline'
    AND audit.action = 'approved'
    AND audit.actor_user_id = v_receipt.requested_by
    AND audit.after_data #>> '{requirement_id}' = v_receipt.requirement_id::text
    AND audit.after_data #>> '{source_revision_id}' = v_receipt.source_revision_id::text
    AND audit.after_data #>> '{source_revision_number}' = p_expected_revision_number::text
    AND audit.after_data #>> '{master_specification_version_id}' = v_receipt.master_specification_version_id::text
    AND audit.after_data #>> '{master_specification_version_number}' = v_master_version.version_number::text
    AND audit.after_data #>> '{commercial_record_id}' = v_baseline.commercial_snapshot #>> '{id}'
    AND audit.after_data #>> '{request_key}' = v_receipt.request_key::text;
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Positive scoped baseline receipt graph is unavailable or incomplete';
  END IF;

  RETURN QUERY SELECT
    v_receipt.request_key,
    v_receipt.requirement_id,
    p_expected_revision_number,
    v_receipt.source_revision_id,
    v_receipt.master_specification_version_id,
    v_master_version.version_number,
    v_baseline.id,
    v_audit_id;
END;
$$;
REVOKE ALL ON FUNCTION public.read_sales_requirement_baseline_approval_receipt(uuid, integer, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_sales_requirement_baseline_approval_receipt(uuid, integer, uuid, uuid, uuid) TO authenticated, service_role;


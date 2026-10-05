-- SOURCE-ONLY CONTROLLED-WRITE REPLACEMENT. Do not apply until isolated
-- caller-authenticated acceptance proves authorization, audit rollback,
-- optimistic conflicts, concurrency, direct-write denial, and non-admin RLS.
-- This proposal deliberately retains existing SELECT RLS policies.

CREATE OR REPLACE FUNCTION public.save_master_specification_version(
  p_specification_id uuid,
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_title text,
  p_expected_version integer,
  p_change_summary text,
  p_specification_data jsonb
)
RETURNS TABLE(specification_id uuid, version_id uuid, version_number integer, specification_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_spec public.master_specifications%ROWTYPE;
  v_version public.master_specification_versions%ROWTYPE;
  v_authorized boolean := false;
  v_expected_number integer;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'An authenticated actor is required';
  END IF;

  SELECT public.has_permission(v_actor_id, 'sales.manage')
      OR public.has_role(v_actor_id, 'admin')
  INTO v_authorized;
  IF NOT COALESCE(v_authorized, false) THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;

  IF p_expected_version < 0
     OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 300
     OR char_length(btrim(p_change_summary)) NOT BETWEEN 3 AND 1000
     OR jsonb_typeof(p_specification_data) <> 'object'
     OR COALESCE(NULLIF(btrim(p_specification_data->>'proposedName'), ''), '') = ''
     OR COALESCE(NULLIF(btrim(p_specification_data->>'customerOrInternalOwner'), ''), '') = ''
     OR COALESCE(NULLIF(btrim(p_specification_data->>'industryApplication'), ''), '') = ''
     OR COALESCE(NULLIF(btrim(p_specification_data->>'productFamily'), ''), '') = ''
     OR COALESCE(NULLIF(btrim(p_specification_data->>'developmentScope'), ''), '') = ''
     OR COALESCE(NULLIF(btrim(p_specification_data->>'requirementSummary'), ''), '') = ''
     OR jsonb_typeof(p_specification_data->'workstreams') <> 'array'
     OR jsonb_array_length(p_specification_data->'workstreams') = 0 THEN
    RAISE EXCEPTION 'Master Specification payload is incomplete or invalid';
  END IF;

  -- The source pair is verified from the authoritative Sales row, never from
  -- a browser-owned customer field. Lock the opportunity to serialize a first
  -- save for the same source pair.
  PERFORM 1
  FROM public.sales_opportunities
  WHERE id = p_opportunity_id AND customer_id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity/customer source mismatch';
  END IF;

  IF p_specification_id IS NULL THEN
    IF p_expected_version <> 0 THEN
      RAISE EXCEPTION 'Initial version must expect version 0';
    END IF;

    -- Replays of an initial save must not create a second header for the same
    -- opportunity. A caller must reopen the existing record with its version.
    SELECT * INTO v_spec
    FROM public.master_specifications
    WHERE opportunity_id = p_opportunity_id
    FOR UPDATE;
    IF FOUND THEN
      RAISE EXCEPTION 'Master Specification already exists; reopen it before saving';
    END IF;

    INSERT INTO public.master_specifications (
      specification_number, opportunity_id, customer_id, title, status,
      current_version, created_by
    ) VALUES (
      public.next_business_number('master_specification', 'MS', NULL),
      p_opportunity_id, p_customer_id, p_title, 'draft', 1, v_actor_id
    ) RETURNING * INTO v_spec;
  ELSE
    SELECT * INTO v_spec
    FROM public.master_specifications
    WHERE id = p_specification_id
    FOR UPDATE;
    IF NOT FOUND
       OR v_spec.opportunity_id <> p_opportunity_id
       OR v_spec.customer_id <> p_customer_id THEN
      RAISE EXCEPTION 'Master Specification source mismatch';
    END IF;
    IF v_spec.status IN ('approved', 'archived') THEN
      RAISE EXCEPTION 'Approved or archived Master Specifications are immutable';
    END IF;
    IF v_spec.current_version <> p_expected_version THEN
      RAISE EXCEPTION 'Master Specification was changed by another user; reopen before saving';
    END IF;

    UPDATE public.master_specifications
    SET title = p_title,
        current_version = current_version + 1,
        updated_at = now()
    WHERE id = v_spec.id
    RETURNING * INTO v_spec;
  END IF;

  v_expected_number := v_spec.current_version;
  INSERT INTO public.master_specification_versions (
    specification_id, version_number, change_summary, specification_data,
    status, created_by
  ) VALUES (
    v_spec.id, v_expected_number, p_change_summary, p_specification_data,
    'working', v_actor_id
  ) RETURNING * INTO v_version;

  INSERT INTO public.activity_log (
    actor_user_id, module_key, entity_type, entity_id, action, summary, after_data
  ) VALUES (
    v_actor_id, 'sales', 'master_specification', v_spec.id, 'version_saved',
    p_change_summary,
    jsonb_build_object(
      'version_id', v_version.id,
      'version_number', v_version.version_number,
      'opportunity_id', v_spec.opportunity_id,
      'customer_id', v_spec.customer_id
    )
  );

  RETURN QUERY SELECT v_spec.id, v_version.id, v_version.version_number, v_spec.specification_number;
END;
$$;

REVOKE ALL ON FUNCTION public.save_master_specification_version(uuid, uuid, uuid, text, integer, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_master_specification_version(uuid, uuid, uuid, text, integer, text, jsonb) TO authenticated, service_role;

-- Direct Data API writes bypass the controlled transaction above. The revokes,
-- policy removals, and triggers below are coupled to the definer routine in
-- this one proposal so the existing authenticated façade continues to work.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.master_specifications FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.master_specification_versions FROM authenticated;
DROP POLICY IF EXISTS "Sales users manage master specifications" ON public.master_specifications;
DROP POLICY IF EXISTS "Sales users append master specification versions" ON public.master_specification_versions;

CREATE OR REPLACE FUNCTION public.master_specification_direct_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Master Specification records may only be changed through save_master_specification_version';
END;
$$;

DROP TRIGGER IF EXISTS master_specifications_no_direct_write ON public.master_specifications;
CREATE TRIGGER master_specifications_no_direct_write
BEFORE INSERT OR UPDATE OR DELETE ON public.master_specifications
FOR EACH ROW EXECUTE FUNCTION public.master_specification_direct_write_guard();

DROP TRIGGER IF EXISTS master_specification_versions_no_direct_insert ON public.master_specification_versions;
CREATE TRIGGER master_specification_versions_no_direct_insert
BEFORE INSERT ON public.master_specification_versions
FOR EACH ROW EXECUTE FUNCTION public.master_specification_direct_write_guard();

-- The two direct-write triggers block any future accidental table mutation.
-- The SECURITY DEFINER routine is the sole intended mutator and is safe only
-- because it derives v_actor_id from auth.uid(), re-checks authorization, has
-- a pinned search path, and receives no actor or role input parameter.
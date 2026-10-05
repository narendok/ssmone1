-- Additive Master Specification revisions. No project conversion, document generation, or sharing.
CREATE TABLE public.master_specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specification_number text NOT NULL UNIQUE,
  opportunity_id uuid NOT NULL REFERENCES public.sales_opportunities(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 300),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','under_review','approved','superseded','archived')),
  current_version integer NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_specifications TO authenticated;
GRANT ALL ON public.master_specifications TO service_role;
ALTER TABLE public.master_specifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales users view master specifications" ON public.master_specifications FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_permission(auth.uid(), 'engineering.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users manage master specifications" ON public.master_specifications FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.master_specification_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specification_id uuid NOT NULL REFERENCES public.master_specifications(id) ON DELETE RESTRICT,
  version_number integer NOT NULL CHECK (version_number > 0),
  change_summary text NOT NULL CHECK (char_length(btrim(change_summary)) BETWEEN 3 AND 1000),
  specification_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'working' CHECK (status IN ('working','submitted','approved','superseded')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(specification_id, version_number)
);
GRANT SELECT, INSERT ON public.master_specification_versions TO authenticated;
GRANT ALL ON public.master_specification_versions TO service_role;
ALTER TABLE public.master_specification_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales users view master specification versions" ON public.master_specification_versions FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_permission(auth.uid(), 'engineering.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users append master specification versions" ON public.master_specification_versions FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.master_specification_versions_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN RAISE EXCEPTION 'Master Specification versions are append-only'; END; $$;
CREATE TRIGGER master_specification_versions_no_update_delete BEFORE UPDATE OR DELETE ON public.master_specification_versions FOR EACH ROW EXECUTE FUNCTION public.master_specification_versions_immutable();

CREATE OR REPLACE FUNCTION public.save_master_specification_version(p_specification_id uuid, p_opportunity_id uuid, p_customer_id uuid, p_title text, p_expected_version integer, p_change_summary text, p_specification_data jsonb)
RETURNS TABLE(specification_id uuid, version_id uuid, version_number integer, specification_number text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_spec public.master_specifications%ROWTYPE; v_version public.master_specification_versions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) THEN RAISE EXCEPTION 'Sales management permission is required'; END IF;
  IF jsonb_typeof(p_specification_data) <> 'object' OR COALESCE(NULLIF(btrim(p_specification_data->>'proposedName'), ''), '') = '' OR COALESCE(NULLIF(btrim(p_specification_data->>'customerOrInternalOwner'), ''), '') = '' OR COALESCE(NULLIF(btrim(p_specification_data->>'industryApplication'), ''), '') = '' OR COALESCE(NULLIF(btrim(p_specification_data->>'productFamily'), ''), '') = '' OR COALESCE(NULLIF(btrim(p_specification_data->>'developmentScope'), ''), '') = '' OR COALESCE(NULLIF(btrim(p_specification_data->>'requirementSummary'), ''), '') = '' OR jsonb_typeof(p_specification_data->'workstreams') <> 'array' OR jsonb_array_length(p_specification_data->'workstreams') = 0 THEN RAISE EXCEPTION 'Master Specification core fields are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sales_opportunities WHERE id = p_opportunity_id AND customer_id = p_customer_id) THEN RAISE EXCEPTION 'Opportunity/customer source mismatch'; END IF;
  IF p_specification_id IS NULL THEN
    IF p_expected_version <> 0 THEN RAISE EXCEPTION 'Initial version must expect version 0'; END IF;
    INSERT INTO public.master_specifications (specification_number, opportunity_id, customer_id, title, current_version, created_by) VALUES (public.next_business_number('master_specification', NULL, NULL), p_opportunity_id, p_customer_id, p_title, 1, auth.uid()) RETURNING * INTO v_spec;
  ELSE
    SELECT * INTO v_spec FROM public.master_specifications WHERE id = p_specification_id FOR UPDATE;
    IF NOT FOUND OR v_spec.opportunity_id <> p_opportunity_id OR v_spec.customer_id <> p_customer_id THEN RAISE EXCEPTION 'Master Specification source mismatch'; END IF;
    IF v_spec.status IN ('approved','archived') THEN RAISE EXCEPTION 'Approved or archived Master Specifications are immutable'; END IF;
    IF v_spec.current_version <> p_expected_version THEN RAISE EXCEPTION 'Master Specification was changed by another user; reopen before saving'; END IF;
    UPDATE public.master_specifications SET title = p_title, current_version = current_version + 1, updated_at = now() WHERE id = v_spec.id RETURNING * INTO v_spec;
  END IF;
  INSERT INTO public.master_specification_versions (specification_id, version_number, change_summary, specification_data, created_by) VALUES (v_spec.id, v_spec.current_version, p_change_summary, p_specification_data, auth.uid()) RETURNING * INTO v_version;
  INSERT INTO public.activity_log (actor_user_id, module_key, entity_type, entity_id, action, summary, after_data) VALUES (auth.uid(), 'sales', 'master_specification', v_spec.id, 'version_saved', p_change_summary, jsonb_build_object('version_id', v_version.id, 'version_number', v_version.version_number, 'opportunity_id', p_opportunity_id));
  RETURN QUERY SELECT v_spec.id, v_version.id, v_version.version_number, v_spec.specification_number;
END;
$$;
REVOKE ALL ON FUNCTION public.save_master_specification_version(uuid, uuid, uuid, text, integer, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_master_specification_version(uuid, uuid, uuid, text, integer, text, jsonb) TO authenticated, service_role;

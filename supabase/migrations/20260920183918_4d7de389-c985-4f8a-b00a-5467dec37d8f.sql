CREATE TABLE public.production_ppap_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_number text NOT NULL UNIQUE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  revision text NOT NULL DEFAULT 'A',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_REVIEW','SUBMITTED','APPROVED','REJECTED')),
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  evidence_notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_ppap_packages TO authenticated;
GRANT ALL ON public.production_ppap_packages TO service_role;
ALTER TABLE public.production_ppap_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_ppap_packages_read_internal" ON public.production_ppap_packages FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_ppap_packages_manage_production" ON public.production_ppap_packages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE TABLE public.production_finished_goods_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_unit_id uuid NOT NULL UNIQUE REFERENCES public.production_units(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RELEASED','BLOCKED')),
  packaging_reference text,
  release_notes text,
  released_by uuid,
  released_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_finished_goods_releases TO authenticated;
GRANT ALL ON public.production_finished_goods_releases TO service_role;
ALTER TABLE public.production_finished_goods_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_finished_goods_releases_read_internal" ON public.production_finished_goods_releases FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_finished_goods_releases_manage_production" ON public.production_finished_goods_releases FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE TABLE public.production_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','DISPATCHED','CANCELLED')),
  recipient_name text,
  carrier_name text,
  tracking_reference text,
  dispatched_at timestamptz,
  dispatch_notes text,
  dispatched_by uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_dispatches TO authenticated;
GRANT ALL ON public.production_dispatches TO service_role;
ALTER TABLE public.production_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_dispatches_read_internal" ON public.production_dispatches FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_dispatches_manage_production" ON public.production_dispatches FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE TABLE public.production_dispatch_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES public.production_dispatches(id) ON DELETE CASCADE,
  production_unit_id uuid NOT NULL UNIQUE REFERENCES public.production_units(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dispatch_id, production_unit_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_dispatch_units TO authenticated;
GRANT ALL ON public.production_dispatch_units TO service_role;
ALTER TABLE public.production_dispatch_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_dispatch_units_read_internal" ON public.production_dispatch_units FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_dispatch_units_manage_production" ON public.production_dispatch_units FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE INDEX production_ppap_packages_order_idx ON public.production_ppap_packages(work_order_id, status);
CREATE INDEX production_finished_goods_releases_order_idx ON public.production_finished_goods_releases(work_order_id, status);
CREATE INDEX production_dispatches_customer_idx ON public.production_dispatches(customer_id, status);

CREATE TRIGGER production_ppap_packages_touch_updated_at BEFORE UPDATE ON public.production_ppap_packages FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();
CREATE TRIGGER production_finished_goods_releases_touch_updated_at BEFORE UPDATE ON public.production_finished_goods_releases FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();
CREATE TRIGGER production_dispatches_touch_updated_at BEFORE UPDATE ON public.production_dispatches FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();

CREATE OR REPLACE FUNCTION public.create_phase7_ppap_package(_work_order_id uuid, _customer_id uuid DEFAULT NULL, _revision text DEFAULT 'A', _evidence_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_id uuid; v_number text;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid, 'admin') OR public.has_permission(uid, 'production.edit')) THEN RAISE EXCEPTION 'Not allowed to create a PPAP package'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.work_orders WHERE id = _work_order_id) THEN RAISE EXCEPTION 'Work order not found'; END IF;
  v_number := public.next_business_number('ppap', 'PROD', NULL);
  INSERT INTO public.production_ppap_packages(package_number, work_order_id, customer_id, revision, evidence_notes) VALUES (v_number, _work_order_id, _customer_id, COALESCE(NULLIF(trim(_revision), ''), 'A'), NULLIF(trim(_evidence_notes), '')) RETURNING id INTO v_id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary) VALUES (uid, 'production', 'production_ppap_package', v_id, 'created', 'Created PPAP package ' || v_number);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_phase7_ppap_package(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_phase7_ppap_package(uuid,uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decide_phase7_ppap_package(_package_id uuid, _status text, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid, 'admin') OR public.has_permission(uid, 'production.approve')) THEN RAISE EXCEPTION 'Production approval is required for PPAP decisions'; END IF;
  IF _status NOT IN ('IN_REVIEW','SUBMITTED','APPROVED','REJECTED') THEN RAISE EXCEPTION 'Invalid PPAP status'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_ppap_packages WHERE id = _package_id) THEN RAISE EXCEPTION 'PPAP package not found'; END IF;
  UPDATE public.production_ppap_packages SET status = _status, evidence_notes = COALESCE(NULLIF(trim(_notes), ''), evidence_notes), submitted_at = CASE WHEN _status = 'SUBMITTED' THEN now() ELSE submitted_at END, approved_by = CASE WHEN _status IN ('APPROVED','REJECTED') THEN uid ELSE approved_by END, approved_at = CASE WHEN _status IN ('APPROVED','REJECTED') THEN now() ELSE approved_at END WHERE id = _package_id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary) VALUES (uid, 'production', 'production_ppap_package', _package_id, lower(_status), 'Set PPAP package status to ' || _status);
END;
$$;
REVOKE ALL ON FUNCTION public.decide_phase7_ppap_package(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_phase7_ppap_package(uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decide_phase7_finished_goods_release(_production_unit_id uuid, _status text, _packaging_reference text DEFAULT NULL, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_order_id uuid; v_unit_status text; v_id uuid;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid, 'admin') OR public.has_permission(uid, 'production.approve')) THEN RAISE EXCEPTION 'Production approval is required to release finished goods'; END IF;
  IF _status NOT IN ('RELEASED','BLOCKED') THEN RAISE EXCEPTION 'Invalid finished-goods release decision'; END IF;
  SELECT work_order_id, unit_status INTO v_order_id, v_unit_status FROM public.production_units WHERE id = _production_unit_id FOR UPDATE;
  IF v_order_id IS NULL THEN RAISE EXCEPTION 'Production unit not found'; END IF;
  IF _status = 'RELEASED' AND v_unit_status <> 'PASSED' THEN RAISE EXCEPTION 'Only units with a passing test may be released'; END IF;
  INSERT INTO public.production_finished_goods_releases(production_unit_id, work_order_id, status, packaging_reference, release_notes, released_by, released_at) VALUES (_production_unit_id, v_order_id, _status, NULLIF(trim(_packaging_reference), ''), NULLIF(trim(_notes), ''), uid, now()) ON CONFLICT (production_unit_id) DO UPDATE SET status = EXCLUDED.status, packaging_reference = EXCLUDED.packaging_reference, release_notes = EXCLUDED.release_notes, released_by = uid, released_at = now() RETURNING id INTO v_id;
  UPDATE public.production_units SET unit_status = CASE WHEN _status = 'RELEASED' THEN 'PACKED' ELSE 'HOLD' END WHERE id = _production_unit_id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary) VALUES (uid, 'production', 'production_unit', _production_unit_id, lower(_status), 'Finished-goods release set to ' || _status);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_phase7_finished_goods_release(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_phase7_finished_goods_release(uuid,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_phase7_dispatch(_customer_id uuid DEFAULT NULL, _recipient_name text DEFAULT NULL, _carrier_name text DEFAULT NULL, _tracking_reference text DEFAULT NULL, _notes text DEFAULT NULL, _unit_ids uuid[] DEFAULT ARRAY[]::uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_id uuid; v_number text; v_unit_id uuid;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid, 'admin') OR public.has_permission(uid, 'production.approve')) THEN RAISE EXCEPTION 'Production approval is required to dispatch finished goods'; END IF;
  IF cardinality(_unit_ids) IS NULL OR cardinality(_unit_ids) = 0 THEN RAISE EXCEPTION 'Select at least one released unit for dispatch'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_unit_ids) AS selected(id) LEFT JOIN public.production_finished_goods_releases release ON release.production_unit_id = selected.id AND release.status = 'RELEASED' LEFT JOIN public.production_units unit ON unit.id = selected.id WHERE release.id IS NULL OR unit.unit_status <> 'PACKED') THEN RAISE EXCEPTION 'Every dispatched unit must have an approved finished-goods release'; END IF;
  v_number := public.next_business_number('dispatch', 'PROD', NULL);
  INSERT INTO public.production_dispatches(dispatch_number, customer_id, status, recipient_name, carrier_name, tracking_reference, dispatched_at, dispatch_notes, dispatched_by) VALUES (v_number, _customer_id, 'DISPATCHED', NULLIF(trim(_recipient_name), ''), NULLIF(trim(_carrier_name), ''), NULLIF(trim(_tracking_reference), ''), now(), NULLIF(trim(_notes), ''), uid) RETURNING id INTO v_id;
  FOREACH v_unit_id IN ARRAY _unit_ids LOOP INSERT INTO public.production_dispatch_units(dispatch_id, production_unit_id) VALUES (v_id, v_unit_id); UPDATE public.production_units SET unit_status = 'DISPATCHED' WHERE id = v_unit_id; END LOOP;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary) VALUES (uid, 'production', 'production_dispatch', v_id, 'dispatched', 'Dispatched ' || cardinality(_unit_ids) || ' finished unit(s) as ' || v_number);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_phase7_dispatch(uuid,text,text,text,text,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_phase7_dispatch(uuid,text,text,text,text,uuid[]) TO authenticated, service_role;
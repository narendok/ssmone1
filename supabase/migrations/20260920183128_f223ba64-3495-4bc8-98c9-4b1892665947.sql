CREATE TABLE public.production_step_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  production_unit_id uuid NOT NULL REFERENCES public.production_units(id) ON DELETE CASCADE,
  route_step_id uuid REFERENCES public.production_route_steps(id),
  status text NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED','COMPLETED','HOLD','REWORK')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  performed_by uuid NOT NULL DEFAULT auth.uid(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_step_executions TO authenticated;
GRANT ALL ON public.production_step_executions TO service_role;
ALTER TABLE public.production_step_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_step_executions_read_internal" ON public.production_step_executions FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_step_executions_manage_production" ON public.production_step_executions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE TABLE public.production_in_process_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  production_unit_id uuid NOT NULL REFERENCES public.production_units(id) ON DELETE CASCADE,
  route_step_id uuid REFERENCES public.production_route_steps(id),
  result text NOT NULL CHECK (result IN ('PASS','HOLD','FAIL','REWORK')),
  findings text,
  inspected_by uuid NOT NULL DEFAULT auth.uid(),
  inspected_at timestamptz NOT NULL DEFAULT now(),
  released_by uuid,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_in_process_inspections TO authenticated;
GRANT ALL ON public.production_in_process_inspections TO service_role;
ALTER TABLE public.production_in_process_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_in_process_inspections_read_internal" ON public.production_in_process_inspections FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_in_process_inspections_manage_production" ON public.production_in_process_inspections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE TABLE public.production_unit_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  production_unit_id uuid NOT NULL REFERENCES public.production_units(id) ON DELETE CASCADE,
  test_type text NOT NULL,
  result text NOT NULL CHECK (result IN ('PASS','FAIL','INCONCLUSIVE')),
  measured_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  tested_by uuid NOT NULL DEFAULT auth.uid(),
  tested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_unit_tests TO authenticated;
GRANT ALL ON public.production_unit_tests TO service_role;
ALTER TABLE public.production_unit_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_unit_tests_read_internal" ON public.production_unit_tests FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_unit_tests_manage_production" ON public.production_unit_tests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE TABLE public.production_ncrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ncr_number text NOT NULL UNIQUE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  production_unit_id uuid REFERENCES public.production_units(id) ON DELETE SET NULL,
  route_step_id uuid REFERENCES public.production_route_steps(id),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','UNDER_REVIEW','REWORK','SCRAP','CLOSED')),
  description text NOT NULL,
  disposition_notes text,
  raised_by uuid NOT NULL DEFAULT auth.uid(),
  raised_at timestamptz NOT NULL DEFAULT now(),
  dispositioned_by uuid,
  dispositioned_at timestamptz,
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_ncrs TO authenticated;
GRANT ALL ON public.production_ncrs TO service_role;
ALTER TABLE public.production_ncrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_ncrs_read_internal" ON public.production_ncrs FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_ncrs_manage_production" ON public.production_ncrs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE INDEX production_step_executions_unit_created_idx ON public.production_step_executions(production_unit_id, created_at DESC);
CREATE INDEX production_in_process_inspections_unit_created_idx ON public.production_in_process_inspections(production_unit_id, created_at DESC);
CREATE INDEX production_unit_tests_unit_created_idx ON public.production_unit_tests(production_unit_id, created_at DESC);
CREATE INDEX production_ncrs_order_status_idx ON public.production_ncrs(work_order_id, status, created_at DESC);

CREATE TRIGGER production_step_executions_touch_updated_at BEFORE UPDATE ON public.production_step_executions FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();
CREATE TRIGGER production_in_process_inspections_touch_updated_at BEFORE UPDATE ON public.production_in_process_inspections FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();
CREATE TRIGGER production_unit_tests_touch_updated_at BEFORE UPDATE ON public.production_unit_tests FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();
CREATE TRIGGER production_ncrs_touch_updated_at BEFORE UPDATE ON public.production_ncrs FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();

CREATE OR REPLACE FUNCTION public.record_phase7_unit_execution(_work_order_id uuid, _production_unit_id uuid, _route_step_id uuid, _status text, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_execution_id uuid; v_requires_hold boolean := false;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid, 'admin') OR public.has_permission(uid, 'production.edit')) THEN RAISE EXCEPTION 'Not allowed to record production execution'; END IF;
  IF _status NOT IN ('STARTED','COMPLETED','HOLD','REWORK') THEN RAISE EXCEPTION 'Invalid production execution status'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_units WHERE id = _production_unit_id AND work_order_id = _work_order_id) THEN RAISE EXCEPTION 'The unit does not belong to this work order'; END IF;
  SELECT requires_quality_hold INTO v_requires_hold FROM public.production_route_steps WHERE id = _route_step_id;
  INSERT INTO public.production_step_executions(work_order_id, production_unit_id, route_step_id, status, completed_at, notes)
  VALUES (_work_order_id, _production_unit_id, _route_step_id, _status, CASE WHEN _status = 'COMPLETED' THEN now() END, nullif(trim(_notes), '')) RETURNING id INTO v_execution_id;
  UPDATE public.production_units SET current_step_id = COALESCE(_route_step_id, current_step_id), unit_status = CASE WHEN _status IN ('HOLD','REWORK') OR (_status = 'COMPLETED' AND coalesce(v_requires_hold, false)) THEN 'HOLD' ELSE 'IN_PROCESS' END WHERE id = _production_unit_id;
  UPDATE public.work_orders SET status = CASE WHEN status = 'RELEASED' THEN 'IN_PROGRESS' ELSE status END WHERE id = _work_order_id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary) VALUES (uid, 'production', 'production_unit', _production_unit_id, lower(_status), 'Recorded ' || lower(_status) || ' for production unit');
  RETURN v_execution_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_phase7_unit_execution(uuid,uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_phase7_unit_execution(uuid,uuid,uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_phase7_unit_inspection(_work_order_id uuid, _production_unit_id uuid, _route_step_id uuid, _result text, _findings text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid, 'admin') OR public.has_permission(uid, 'production.edit')) THEN RAISE EXCEPTION 'Not allowed to record an in-process inspection'; END IF;
  IF _result NOT IN ('PASS','HOLD','FAIL','REWORK') THEN RAISE EXCEPTION 'Invalid inspection result'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_units WHERE id = _production_unit_id AND work_order_id = _work_order_id) THEN RAISE EXCEPTION 'The unit does not belong to this work order'; END IF;
  INSERT INTO public.production_in_process_inspections(work_order_id, production_unit_id, route_step_id, result, findings) VALUES (_work_order_id, _production_unit_id, _route_step_id, _result, nullif(trim(_findings), '')) RETURNING id INTO v_id;
  UPDATE public.production_units SET unit_status = CASE WHEN _result = 'PASS' THEN 'IN_PROCESS' ELSE 'HOLD' END WHERE id = _production_unit_id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary) VALUES (uid, 'production', 'production_unit', _production_unit_id, 'inspection_' || lower(_result), 'Recorded in-process inspection: ' || _result);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_phase7_unit_inspection(uuid,uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_phase7_unit_inspection(uuid,uuid,uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_phase7_unit_test(_work_order_id uuid, _production_unit_id uuid, _test_type text, _result text, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid, 'admin') OR public.has_permission(uid, 'production.edit')) THEN RAISE EXCEPTION 'Not allowed to record a production test'; END IF;
  IF coalesce(trim(_test_type), '') = '' OR _result NOT IN ('PASS','FAIL','INCONCLUSIVE') THEN RAISE EXCEPTION 'A test type and valid result are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_units WHERE id = _production_unit_id AND work_order_id = _work_order_id) THEN RAISE EXCEPTION 'The unit does not belong to this work order'; END IF;
  INSERT INTO public.production_unit_tests(work_order_id, production_unit_id, test_type, result, notes) VALUES (_work_order_id, _production_unit_id, trim(_test_type), _result, nullif(trim(_notes), '')) RETURNING id INTO v_id;
  UPDATE public.production_units SET unit_status = CASE WHEN _result = 'PASS' THEN 'PASSED' WHEN _result = 'FAIL' THEN 'FAILED' ELSE 'HOLD' END, completed_at = CASE WHEN _result = 'PASS' THEN now() ELSE completed_at END WHERE id = _production_unit_id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary) VALUES (uid, 'production', 'production_unit', _production_unit_id, 'test_' || lower(_result), 'Recorded production test: ' || _result);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_phase7_unit_test(uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_phase7_unit_test(uuid,uuid,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.disposition_phase7_ncr(_ncr_id uuid, _status text, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_unit_id uuid; v_order_id uuid;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid, 'admin') OR public.has_permission(uid, 'production.approve')) THEN RAISE EXCEPTION 'Production approval is required to disposition an NCR'; END IF;
  IF _status NOT IN ('UNDER_REVIEW','REWORK','SCRAP','CLOSED') THEN RAISE EXCEPTION 'Invalid NCR disposition'; END IF;
  SELECT production_unit_id, work_order_id INTO v_unit_id, v_order_id FROM public.production_ncrs WHERE id = _ncr_id FOR UPDATE;
  IF v_order_id IS NULL THEN RAISE EXCEPTION 'Production NCR not found'; END IF;
  UPDATE public.production_ncrs SET status = _status, disposition_notes = COALESCE(nullif(trim(_notes), ''), disposition_notes), dispositioned_by = uid, dispositioned_at = now(), closed_by = CASE WHEN _status = 'CLOSED' THEN uid ELSE closed_by END, closed_at = CASE WHEN _status = 'CLOSED' THEN now() ELSE closed_at END WHERE id = _ncr_id;
  IF v_unit_id IS NOT NULL AND _status = 'SCRAP' THEN UPDATE public.production_units SET unit_status = 'SCRAPPED' WHERE id = v_unit_id; UPDATE public.work_orders SET quantity_scrapped = quantity_scrapped + 1 WHERE id = v_order_id; END IF;
  IF v_unit_id IS NOT NULL AND _status = 'REWORK' THEN UPDATE public.production_units SET unit_status = 'HOLD' WHERE id = v_unit_id; END IF;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary) VALUES (uid, 'production', 'production_ncr', _ncr_id, lower(_status), 'Dispositioned production NCR as ' || _status);
END;
$$;
REVOKE ALL ON FUNCTION public.disposition_phase7_ncr(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disposition_phase7_ncr(uuid,text,text) TO authenticated, service_role;
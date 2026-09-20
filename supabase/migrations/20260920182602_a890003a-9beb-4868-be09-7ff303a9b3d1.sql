INSERT INTO public.application_modules (key, name, group_key, route_path, icon_key, sort_order, status)
VALUES ('production', 'Production', 'Operations', '/production', 'Factory', 45, 'ENABLED')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, group_key = EXCLUDED.group_key, route_path = EXCLUDED.route_path, icon_key = EXCLUDED.icon_key, sort_order = EXCLUDED.sort_order, status = EXCLUDED.status;

INSERT INTO public.permissions (key, label, description, module_key)
VALUES
  ('production.view', 'View production', 'View production plans, work orders, kits, and traceability.', 'production'),
  ('production.edit', 'Manage production', 'Create and operate production plans, work orders, kits, and traceability.', 'production'),
  ('production.approve', 'Approve production', 'Release and close controlled production work orders.', 'production')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, module_key = EXCLUDED.module_key;

CREATE OR REPLACE FUNCTION public.phase7_can_production(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin')
    OR public.has_permission(_uid, 'production.view')
    OR public.has_permission(_uid, 'production.edit')
    OR public.has_permission(_uid, 'production.approve');
$$;
REVOKE ALL ON FUNCTION public.phase7_can_production(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phase7_can_production(uuid) TO authenticated, service_role;

CREATE TABLE public.production_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  revision text NOT NULL DEFAULT 'A',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_routes TO authenticated;
GRANT ALL ON public.production_routes TO service_role;
ALTER TABLE public.production_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_routes_read_internal" ON public.production_routes FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_routes_manage_production" ON public.production_routes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE TABLE public.production_route_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.production_routes(id) ON DELETE CASCADE,
  step_number integer NOT NULL CHECK (step_number > 0),
  name text NOT NULL,
  station_type text NOT NULL DEFAULT 'GENERAL',
  instructions text,
  requires_quality_hold boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, step_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_route_steps TO authenticated;
GRANT ALL ON public.production_route_steps TO service_role;
ALTER TABLE public.production_route_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_route_steps_read_internal" ON public.production_route_steps FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_route_steps_manage_production" ON public.production_route_steps FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_number text NOT NULL UNIQUE,
  project_id uuid REFERENCES public.projects(id),
  bom_id uuid NOT NULL REFERENCES public.project_boms(id),
  route_id uuid REFERENCES public.production_routes(id),
  demand_source_type text NOT NULL DEFAULT 'PROJECT' CHECK (demand_source_type IN ('PROJECT','SALES_ORDER','FORECAST','SERVICE','INTERNAL')),
  demand_source_reference text,
  product_name text NOT NULL,
  product_variant text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','MATERIAL_REVIEW','READY_TO_RELEASE','RELEASED','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED')),
  priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  quantity_planned numeric NOT NULL CHECK (quantity_planned > 0),
  quantity_completed numeric NOT NULL DEFAULT 0 CHECK (quantity_completed >= 0),
  quantity_scrapped numeric NOT NULL DEFAULT 0 CHECK (quantity_scrapped >= 0),
  planned_start_date date,
  planned_completion_date date,
  released_at timestamptz,
  released_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  owner_id uuid,
  bom_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  route_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_orders_read_internal" ON public.work_orders FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "work_orders_manage_production" ON public.work_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE TABLE public.work_order_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  bom_item_id uuid REFERENCES public.project_bom_items(id),
  component_id uuid REFERENCES public.components(id),
  mpn text,
  description text,
  required_quantity numeric NOT NULL CHECK (required_quantity > 0),
  reserved_quantity numeric NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  issued_quantity numeric NOT NULL DEFAULT 0 CHECK (issued_quantity >= 0),
  consumed_quantity numeric NOT NULL DEFAULT 0 CHECK (consumed_quantity >= 0),
  reservation_id uuid REFERENCES public.inventory_reservations(id),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SHORT','RESERVED','ISSUED','CONSUMED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_materials TO authenticated;
GRANT ALL ON public.work_order_materials TO service_role;
ALTER TABLE public.work_order_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_order_materials_read_internal" ON public.work_order_materials FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "work_order_materials_manage_production" ON public.work_order_materials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE TABLE public.production_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_number text NOT NULL UNIQUE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PICKING','READY','ISSUED','RETURNED','CANCELLED')),
  prepared_by uuid,
  prepared_at timestamptz,
  issued_by uuid,
  issued_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_kits TO authenticated;
GRANT ALL ON public.production_kits TO service_role;
ALTER TABLE public.production_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_kits_read_internal" ON public.production_kits FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_kits_manage_production" ON public.production_kits FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit') OR public.can_inward(auth.uid())) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit') OR public.can_inward(auth.uid()));

CREATE TABLE public.production_kit_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.production_kits(id) ON DELETE CASCADE,
  work_order_material_id uuid REFERENCES public.work_order_materials(id),
  inventory_lot_id uuid NOT NULL REFERENCES public.inventory_lots(id),
  quantity_picked numeric NOT NULL CHECK (quantity_picked > 0),
  quantity_returned numeric NOT NULL DEFAULT 0 CHECK (quantity_returned >= 0),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kit_id, inventory_lot_id, work_order_material_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_kit_lines TO authenticated;
GRANT ALL ON public.production_kit_lines TO service_role;
ALTER TABLE public.production_kit_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_kit_lines_read_internal" ON public.production_kit_lines FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_kit_lines_manage_production" ON public.production_kit_lines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit') OR public.can_inward(auth.uid())) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit') OR public.can_inward(auth.uid()));

CREATE TABLE public.production_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  serial_number text NOT NULL UNIQUE,
  unit_status text NOT NULL DEFAULT 'PLANNED' CHECK (unit_status IN ('PLANNED','IN_PROCESS','HOLD','TESTING','PASSED','FAILED','SCRAPPED','PACKED','DISPATCHED')),
  current_step_id uuid REFERENCES public.production_route_steps(id),
  firmware_reference text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_units TO authenticated;
GRANT ALL ON public.production_units TO service_role;
ALTER TABLE public.production_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_units_read_internal" ON public.production_units FOR SELECT TO authenticated USING (public.phase7_can_production(auth.uid()));
CREATE POLICY "production_units_manage_production" ON public.production_units FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'production.edit'));

CREATE INDEX work_orders_status_dates_idx ON public.work_orders(status, planned_start_date, planned_completion_date);
CREATE INDEX work_order_materials_order_status_idx ON public.work_order_materials(work_order_id, status);
CREATE INDEX production_kits_work_order_status_idx ON public.production_kits(work_order_id, status);
CREATE INDEX production_units_work_order_status_idx ON public.production_units(work_order_id, unit_status);

CREATE OR REPLACE FUNCTION public.phase7_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER production_routes_touch_updated_at BEFORE UPDATE ON public.production_routes FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();
CREATE TRIGGER production_route_steps_touch_updated_at BEFORE UPDATE ON public.production_route_steps FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();
CREATE TRIGGER work_orders_touch_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();
CREATE TRIGGER work_order_materials_touch_updated_at BEFORE UPDATE ON public.work_order_materials FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();
CREATE TRIGGER production_kits_touch_updated_at BEFORE UPDATE ON public.production_kits FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();
CREATE TRIGGER production_kit_lines_touch_updated_at BEFORE UPDATE ON public.production_kit_lines FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();
CREATE TRIGGER production_units_touch_updated_at BEFORE UPDATE ON public.production_units FOR EACH ROW EXECUTE FUNCTION public.phase7_touch_updated_at();

CREATE OR REPLACE FUNCTION public.create_phase7_work_order(
  _project_id uuid,
  _bom_id uuid,
  _route_id uuid,
  _product_name text,
  _product_variant text,
  _quantity_planned numeric,
  _planned_start_date date,
  _planned_completion_date date,
  _priority text,
  _notes text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  v_number text;
  v_order_id uuid;
  v_bom jsonb;
  v_route jsonb;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid, 'admin') OR public.has_permission(uid, 'production.edit')) THEN RAISE EXCEPTION 'Not allowed to create work orders'; END IF;
  IF _quantity_planned IS NULL OR _quantity_planned <= 0 OR coalesce(trim(_product_name), '') = '' THEN RAISE EXCEPTION 'Product name and a positive planned quantity are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_boms WHERE id = _bom_id AND (_project_id IS NULL OR project_id = _project_id)) THEN RAISE EXCEPTION 'The selected BOM does not belong to the selected project'; END IF;
  IF _route_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.production_routes WHERE id = _route_id AND is_active) THEN RAISE EXCEPTION 'The selected production route is not active'; END IF;
  SELECT jsonb_build_object('bom_id', b.id, 'bom_number', b.bom_number, 'name', b.name, 'revision', b.revision, 'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('bom_item_id', i.id, 'component_id', i.matched_component_id, 'mpn', i.mpn, 'description', i.description, 'quantity', i.quantity) ORDER BY i.line_index) FROM public.project_bom_items i WHERE i.bom_id = b.id), '[]'::jsonb)) INTO v_bom FROM public.project_boms b WHERE b.id = _bom_id;
  SELECT COALESCE(jsonb_build_object('route_id', r.id, 'code', r.code, 'name', r.name, 'revision', r.revision, 'steps', COALESCE((SELECT jsonb_agg(jsonb_build_object('step_id', s.id, 'step_number', s.step_number, 'name', s.name, 'station_type', s.station_type, 'requires_quality_hold', s.requires_quality_hold) ORDER BY s.step_number) FROM public.production_route_steps s WHERE s.route_id = r.id AND s.is_active), '[]'::jsonb)), '{}'::jsonb) INTO v_route FROM public.production_routes r WHERE r.id = _route_id;
  v_number := public.next_business_number('work_order', 'MPRD/PRD-01', NULL);
  INSERT INTO public.work_orders(work_order_number, project_id, bom_id, route_id, product_name, product_variant, quantity_planned, planned_start_date, planned_completion_date, priority, bom_snapshot, route_snapshot, notes, owner_id, created_by)
  VALUES (v_number, _project_id, _bom_id, _route_id, trim(_product_name), nullif(trim(_product_variant), ''), _quantity_planned, _planned_start_date, _planned_completion_date, COALESCE(_priority, 'NORMAL'), v_bom, v_route, nullif(trim(_notes), ''), uid, uid)
  RETURNING id INTO v_order_id;
  INSERT INTO public.work_order_materials(work_order_id, bom_item_id, component_id, mpn, description, required_quantity, status)
  SELECT v_order_id, i.id, i.matched_component_id, i.mpn, i.description, i.quantity * _quantity_planned, CASE WHEN i.matched_component_id IS NULL THEN 'SHORT' ELSE 'PENDING' END
  FROM public.project_bom_items i WHERE i.bom_id = _bom_id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary)
  VALUES (uid, 'production', 'work_order', v_order_id, 'created', 'Created work order ' || v_number);
  RETURN v_order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_phase7_work_order(uuid,uuid,uuid,text,text,numeric,date,date,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_phase7_work_order(uuid,uuid,uuid,text,text,numeric,date,date,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.transition_phase7_work_order(_work_order_id uuid, _status text, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_current text; BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid, 'admin') OR public.has_permission(uid, 'production.edit') OR public.has_permission(uid, 'production.approve')) THEN RAISE EXCEPTION 'Not allowed to update work orders'; END IF;
  SELECT status INTO v_current FROM public.work_orders WHERE id = _work_order_id FOR UPDATE;
  IF v_current IS NULL THEN RAISE EXCEPTION 'Work order not found'; END IF;
  IF _status NOT IN ('DRAFT','MATERIAL_REVIEW','READY_TO_RELEASE','RELEASED','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'Invalid work-order status'; END IF;
  IF _status IN ('RELEASED','COMPLETED') AND NOT (public.has_role(uid, 'admin') OR public.has_permission(uid, 'production.approve')) THEN RAISE EXCEPTION 'Production approval is required for this transition'; END IF;
  IF _status = 'RELEASED' AND EXISTS (SELECT 1 FROM public.work_order_materials WHERE work_order_id = _work_order_id AND status IN ('PENDING','SHORT')) THEN RAISE EXCEPTION 'Resolve material readiness before releasing this work order'; END IF;
  UPDATE public.work_orders SET status = _status, released_by = CASE WHEN _status = 'RELEASED' THEN uid ELSE released_by END, released_at = CASE WHEN _status = 'RELEASED' THEN now() ELSE released_at END, closed_by = CASE WHEN _status = 'COMPLETED' THEN uid ELSE closed_by END, closed_at = CASE WHEN _status = 'COMPLETED' THEN now() ELSE closed_at END, notes = COALESCE(nullif(trim(_notes), ''), notes) WHERE id = _work_order_id;
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary) VALUES (uid, 'production', 'work_order', _work_order_id, lower(_status), 'Changed work order status from ' || v_current || ' to ' || _status);
END;
$$;
REVOKE ALL ON FUNCTION public.transition_phase7_work_order(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_phase7_work_order(uuid,text,text) TO authenticated, service_role;
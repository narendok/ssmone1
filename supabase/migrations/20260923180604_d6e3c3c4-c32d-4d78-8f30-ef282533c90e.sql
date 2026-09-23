CREATE OR REPLACE FUNCTION public.phase8_can(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_permission(_user_id, _permission);
$$;
GRANT EXECUTE ON FUNCTION public.phase8_can(uuid, text) TO authenticated, service_role;

CREATE TABLE public.facility_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_id uuid REFERENCES public.facility_locations(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE, name text NOT NULL, location_type text NOT NULL CHECK (location_type IN ('ORGANIZATION','SITE','BUILDING','FLOOR','ZONE','ROOM','LAB','OFFICE','PRODUCTION_AREA','STORE','SECURITY_GATE','UTILITY_AREA','OTHER')),
  description text, responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, is_active boolean NOT NULL DEFAULT true,
  qr_payload text NOT NULL UNIQUE, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(parent_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facility_locations TO authenticated; GRANT ALL ON public.facility_locations TO service_role;
ALTER TABLE public.facility_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_locations_read" ON public.facility_locations FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'facility.view'));
CREATE POLICY "facility_locations_manage" ON public.facility_locations FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'facility.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'facility.edit'));
CREATE TRIGGER facility_locations_touch BEFORE UPDATE ON public.facility_locations FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.facility_location_responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), facility_location_id uuid NOT NULL REFERENCES public.facility_locations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, responsibility_type text NOT NULL DEFAULT 'OWNER', active_from date NOT NULL DEFAULT current_date, active_to date, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(facility_location_id,user_id,responsibility_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facility_location_responsibilities TO authenticated; GRANT ALL ON public.facility_location_responsibilities TO service_role;
ALTER TABLE public.facility_location_responsibilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_responsibilities_read" ON public.facility_location_responsibilities FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'facility.view'));
CREATE POLICY "facility_responsibilities_manage" ON public.facility_location_responsibilities FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'facility.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'facility.edit'));

CREATE TABLE public.asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL UNIQUE, description text, requires_calibration boolean NOT NULL DEFAULT false, requires_maintenance boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_categories TO authenticated; GRANT ALL ON public.asset_categories TO service_role;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset_categories_read" ON public.asset_categories FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'assets.view'));
CREATE POLICY "asset_categories_manage" ON public.asset_categories FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'assets.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'assets.edit'));
CREATE TRIGGER asset_categories_touch BEFORE UPDATE ON public.asset_categories FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_code text NOT NULL UNIQUE, name text NOT NULL, category_id uuid REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL','ACTIVE','IN_SERVICE','UNDER_MAINTENANCE','CALIBRATION_DUE','QUARANTINED','LOST','RETIRED','SCRAPPED','DISPOSED')),
  manufacturer text, model_number text, serial_number text, purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  grn_id uuid REFERENCES public.goods_receipt_notes(id) ON DELETE SET NULL, vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  acquisition_date date, acquisition_cost numeric(14,2), warranty_expiry date, amc_expiry date,
  facility_location_id uuid REFERENCES public.facility_locations(id) ON DELETE SET NULL, custodian_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  qr_payload text NOT NULL UNIQUE, specifications jsonb NOT NULL DEFAULT '{}'::jsonb, approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, approved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT(manufacturer,model_number,serial_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated; GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets_read" ON public.assets FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'assets.view') OR custodian_user_id = auth.uid());
CREATE POLICY "assets_manage" ON public.assets FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'assets.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'assets.edit'));
CREATE TRIGGER assets_touch BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE INDEX assets_location_idx ON public.assets(facility_location_id); CREATE INDEX assets_status_idx ON public.assets(status);

CREATE TABLE public.asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE, assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_location_id uuid REFERENCES public.facility_locations(id) ON DELETE SET NULL, assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(), returned_at timestamptz, handover_notes text, status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','RETURNED','CANCELLED')), accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_assignments TO authenticated; GRANT ALL ON public.asset_assignments TO service_role;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset_assignments_read" ON public.asset_assignments FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'assets.view') OR assigned_to_user_id = auth.uid());
CREATE POLICY "asset_assignments_manage" ON public.asset_assignments FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'assets.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'assets.edit'));

CREATE TABLE public.maintenance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_code text NOT NULL UNIQUE, asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE, strategy text NOT NULL CHECK(strategy IN ('PREVENTIVE','PREDICTIVE','CONDITION_BASED')),
  frequency_days integer NOT NULL CHECK(frequency_days > 0), next_due_date date NOT NULL, checklist jsonb NOT NULL DEFAULT '[]'::jsonb, is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_plans TO authenticated; GRANT ALL ON public.maintenance_plans TO service_role;
ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maintenance_plans_read" ON public.maintenance_plans FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'maintenance.view'));
CREATE POLICY "maintenance_plans_manage" ON public.maintenance_plans FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'maintenance.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'maintenance.edit'));
CREATE TRIGGER maintenance_plans_touch BEFORE UPDATE ON public.maintenance_plans FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.maintenance_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), work_order_code text NOT NULL UNIQUE, asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  plan_id uuid REFERENCES public.maintenance_plans(id) ON DELETE SET NULL, work_type text NOT NULL CHECK(work_type IN ('PREVENTIVE','CORRECTIVE','BREAKDOWN','CONDITION_BASED')),
  status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','ASSIGNED','IN_PROGRESS','PENDING_REVIEW','COMPLETED','CANCELLED')),
  priority text NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW','MEDIUM','HIGH','CRITICAL')), description text NOT NULL, due_date date,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL, completed_at timestamptz, completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, approved_at timestamptz, completion_notes text, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_work_orders TO authenticated; GRANT ALL ON public.maintenance_work_orders TO service_role;
ALTER TABLE public.maintenance_work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maintenance_work_orders_read" ON public.maintenance_work_orders FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'maintenance.view') OR assigned_to = auth.uid());
CREATE POLICY "maintenance_work_orders_manage" ON public.maintenance_work_orders FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'maintenance.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'maintenance.edit'));
CREATE TRIGGER maintenance_work_orders_touch BEFORE UPDATE ON public.maintenance_work_orders FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE INDEX maintenance_work_orders_asset_idx ON public.maintenance_work_orders(asset_id,status);

CREATE TABLE public.imte_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), instrument_code text NOT NULL UNIQUE, asset_id uuid NOT NULL UNIQUE REFERENCES public.assets(id) ON DELETE CASCADE,
  measurement_range text, least_count text, accuracy text, calibration_interval_days integer NOT NULL DEFAULT 365 CHECK(calibration_interval_days > 0),
  next_calibration_due date NOT NULL, calibration_status text NOT NULL DEFAULT 'CURRENT' CHECK(calibration_status IN ('CURRENT','DUE_SOON','OVERDUE','QUARANTINED')), qr_payload text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imte_instruments TO authenticated; GRANT ALL ON public.imte_instruments TO service_role;
ALTER TABLE public.imte_instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imte_read" ON public.imte_instruments FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'calibration.view'));
CREATE POLICY "imte_manage" ON public.imte_instruments FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'calibration.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'calibration.edit'));
CREATE TRIGGER imte_instruments_touch BEFORE UPDATE ON public.imte_instruments FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.calibration_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), record_code text NOT NULL UNIQUE, instrument_id uuid NOT NULL REFERENCES public.imte_instruments(id) ON DELETE CASCADE,
  calibrated_on date NOT NULL, due_date date NOT NULL, result text NOT NULL CHECK(result IN ('PASS','FAIL','OOT')), certificate_reference text, certificate_drive_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE SET NULL,
  provider_name text, accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, accepted_at timestamptz, notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calibration_records TO authenticated; GRANT ALL ON public.calibration_records TO service_role;
ALTER TABLE public.calibration_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calibration_records_read" ON public.calibration_records FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'calibration.view'));
CREATE POLICY "calibration_records_manage" ON public.calibration_records FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'calibration.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'calibration.edit'));
CREATE TRIGGER calibration_records_touch BEFORE UPDATE ON public.calibration_records FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.workstations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workstation_code text NOT NULL UNIQUE, name text NOT NULL, facility_location_id uuid REFERENCES public.facility_locations(id) ON DELETE SET NULL, workstation_type text NOT NULL DEFAULT 'GENERAL', status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE','MAINTENANCE')), qr_payload text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workstations TO authenticated; GRANT ALL ON public.workstations TO service_role;
ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workstations_read" ON public.workstations FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'workplace.view'));
CREATE POLICY "workstations_manage" ON public.workstations FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'workplace.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'workplace.edit'));
CREATE TRIGGER workstations_touch BEFORE UPDATE ON public.workstations FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.workstation_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workstation_id uuid NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE, employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL, allocated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, allocated_at timestamptz NOT NULL DEFAULT now(), released_at timestamptz, notes text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workstation_allocations TO authenticated; GRANT ALL ON public.workstation_allocations TO service_role;
ALTER TABLE public.workstation_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workstation_allocations_read" ON public.workstation_allocations FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'workplace.view') OR EXISTS(SELECT 1 FROM public.employees e WHERE e.id=employee_id AND e.user_id=auth.uid()));
CREATE POLICY "workstation_allocations_manage" ON public.workstation_allocations FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'workplace.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'workplace.edit'));

CREATE TABLE public.visitor_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_code text NOT NULL UNIQUE, visitor_name text NOT NULL, company_name text, phone text, host_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  facility_location_id uuid REFERENCES public.facility_locations(id) ON DELETE SET NULL, purpose text NOT NULL, status text NOT NULL DEFAULT 'PRE_REGISTERED' CHECK(status IN ('PRE_REGISTERED','CHECKED_IN','CHECKED_OUT','DENIED','OVERSTAY')),
  expected_in timestamptz, expected_out timestamptz, checked_in_at timestamptz, checked_out_at timestamptz, id_reference text, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitor_visits TO authenticated; GRANT ALL ON public.visitor_visits TO service_role;
ALTER TABLE public.visitor_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitor_visits_read" ON public.visitor_visits FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'security.view') OR host_user_id=auth.uid());
CREATE POLICY "visitor_visits_manage" ON public.visitor_visits FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'security.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'security.edit'));
CREATE TRIGGER visitor_visits_touch BEFORE UPDATE ON public.visitor_visits FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.vehicle_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entry_code text NOT NULL UNIQUE, vehicle_number text NOT NULL, driver_name text, driver_phone text, purpose text, visitor_visit_id uuid REFERENCES public.visitor_visits(id) ON DELETE SET NULL, gate_location_id uuid REFERENCES public.facility_locations(id) ON DELETE SET NULL, entered_at timestamptz NOT NULL DEFAULT now(), exited_at timestamptz, status text NOT NULL DEFAULT 'IN' CHECK(status IN ('IN','OUT','DENIED')), created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_entries TO authenticated; GRANT ALL ON public.vehicle_entries TO service_role;
ALTER TABLE public.vehicle_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_entries_read" ON public.vehicle_entries FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'security.view'));
CREATE POLICY "vehicle_entries_manage" ON public.vehicle_entries FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'security.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'security.edit'));

CREATE TABLE public.material_gate_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pass_code text NOT NULL UNIQUE, pass_type text NOT NULL CHECK(pass_type IN ('OUTWARD','RETURNABLE')), status text NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK(status IN ('PENDING_APPROVAL','APPROVED','RELEASED','RETURNED','CANCELLED')),
  purpose text NOT NULL, destination text, asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL, approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, approved_at timestamptz, released_at timestamptz, return_due_date date, returned_at timestamptz, qr_payload text NOT NULL UNIQUE, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_gate_passes TO authenticated; GRANT ALL ON public.material_gate_passes TO service_role;
ALTER TABLE public.material_gate_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gate_passes_read" ON public.material_gate_passes FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'security.view') OR created_by=auth.uid());
CREATE POLICY "gate_passes_manage" ON public.material_gate_passes FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'security.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'security.edit'));
CREATE TRIGGER material_gate_passes_touch BEFORE UPDATE ON public.material_gate_passes FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_code text NOT NULL UNIQUE, title text NOT NULL, severity text NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')), status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','INVESTIGATING','CLOSED')),
  facility_location_id uuid REFERENCES public.facility_locations(id) ON DELETE SET NULL, occurred_at timestamptz NOT NULL DEFAULT now(), details text, reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_incidents TO authenticated; GRANT ALL ON public.security_incidents TO service_role;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_incidents_read" ON public.security_incidents FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'security.view'));
CREATE POLICY "security_incidents_manage" ON public.security_incidents FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'security.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'security.edit'));
CREATE TRIGGER security_incidents_touch BEFORE UPDATE ON public.security_incidents FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE OR REPLACE FUNCTION public.phase8_assign_identifiers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text; v_qr text;
BEGIN
  IF TG_TABLE_NAME='facility_locations' THEN
    IF NEW.code IS NULL OR btrim(NEW.code)='' THEN NEW.code := public.next_business_number('facility_location', 'FAC', NULL); END IF;
    NEW.qr_payload := COALESCE(NULLIF(NEW.qr_payload,''), 'facility:' || NEW.code);
    INSERT INTO public.entity_registry(entity_type,entity_id,permalink,qr_payload) VALUES ('facility_location',NEW.id,'/facility/locations/'||NEW.id,NEW.qr_payload) ON CONFLICT (entity_type,entity_id) DO UPDATE SET permalink=EXCLUDED.permalink,qr_payload=EXCLUDED.qr_payload;
  ELSIF TG_TABLE_NAME='assets' THEN
    IF NEW.asset_code IS NULL OR btrim(NEW.asset_code)='' THEN NEW.asset_code := public.next_business_number('asset', 'AST', NULL); END IF;
    NEW.qr_payload := COALESCE(NULLIF(NEW.qr_payload,''), 'asset:' || NEW.asset_code);
    INSERT INTO public.entity_registry(entity_type,entity_id,permalink,qr_payload) VALUES ('asset',NEW.id,'/assets/register/'||NEW.id,NEW.qr_payload) ON CONFLICT (entity_type,entity_id) DO UPDATE SET permalink=EXCLUDED.permalink,qr_payload=EXCLUDED.qr_payload;
  ELSIF TG_TABLE_NAME='maintenance_plans' THEN
    IF NEW.plan_code IS NULL OR btrim(NEW.plan_code)='' THEN NEW.plan_code := public.next_business_number('maintenance_plan', 'MNT', NULL); END IF;
  ELSIF TG_TABLE_NAME='maintenance_work_orders' THEN
    IF NEW.work_order_code IS NULL OR btrim(NEW.work_order_code)='' THEN NEW.work_order_code := public.next_business_number('maintenance_work_order', 'MNT', NULL); END IF;
  ELSIF TG_TABLE_NAME='imte_instruments' THEN
    IF NEW.instrument_code IS NULL OR btrim(NEW.instrument_code)='' THEN NEW.instrument_code := public.next_business_number('instrument', 'CAL', NULL); END IF;
    NEW.qr_payload := COALESCE(NULLIF(NEW.qr_payload,''), 'instrument:' || NEW.instrument_code);
    INSERT INTO public.entity_registry(entity_type,entity_id,permalink,qr_payload) VALUES ('instrument',NEW.id,'/calibration/instruments/'||NEW.id,NEW.qr_payload) ON CONFLICT (entity_type,entity_id) DO UPDATE SET permalink=EXCLUDED.permalink,qr_payload=EXCLUDED.qr_payload;
  ELSIF TG_TABLE_NAME='calibration_records' THEN
    IF NEW.record_code IS NULL OR btrim(NEW.record_code)='' THEN NEW.record_code := public.next_business_number('calibration_record', 'CAL', NULL); END IF;
  ELSIF TG_TABLE_NAME='workstations' THEN
    IF NEW.workstation_code IS NULL OR btrim(NEW.workstation_code)='' THEN NEW.workstation_code := public.next_business_number('workstation', 'WKS', NULL); END IF;
    NEW.qr_payload := COALESCE(NULLIF(NEW.qr_payload,''), 'workstation:' || NEW.workstation_code);
  ELSIF TG_TABLE_NAME='visitor_visits' THEN
    IF NEW.visit_code IS NULL OR btrim(NEW.visit_code)='' THEN NEW.visit_code := public.next_business_number('visitor_visit', 'VIS', NULL); END IF;
  ELSIF TG_TABLE_NAME='vehicle_entries' THEN
    IF NEW.entry_code IS NULL OR btrim(NEW.entry_code)='' THEN NEW.entry_code := public.next_business_number('vehicle_entry', 'SEC', NULL); END IF;
  ELSIF TG_TABLE_NAME='material_gate_passes' THEN
    IF NEW.pass_code IS NULL OR btrim(NEW.pass_code)='' THEN NEW.pass_code := public.next_business_number('gate_pass', 'GATE', NULL); END IF;
    NEW.qr_payload := COALESCE(NULLIF(NEW.qr_payload,''), 'gate-pass:' || NEW.pass_code);
  ELSIF TG_TABLE_NAME='security_incidents' THEN
    IF NEW.incident_code IS NULL OR btrim(NEW.incident_code)='' THEN NEW.incident_code := public.next_business_number('security_incident', 'SEC', NULL); END IF;
  END IF; RETURN NEW;
END; $$;
CREATE TRIGGER facility_locations_identifier BEFORE INSERT OR UPDATE ON public.facility_locations FOR EACH ROW EXECUTE FUNCTION public.phase8_assign_identifiers();
CREATE TRIGGER assets_identifier BEFORE INSERT OR UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.phase8_assign_identifiers();
CREATE TRIGGER maintenance_plans_identifier BEFORE INSERT ON public.maintenance_plans FOR EACH ROW EXECUTE FUNCTION public.phase8_assign_identifiers();
CREATE TRIGGER maintenance_work_orders_identifier BEFORE INSERT ON public.maintenance_work_orders FOR EACH ROW EXECUTE FUNCTION public.phase8_assign_identifiers();
CREATE TRIGGER imte_instruments_identifier BEFORE INSERT OR UPDATE ON public.imte_instruments FOR EACH ROW EXECUTE FUNCTION public.phase8_assign_identifiers();
CREATE TRIGGER calibration_records_identifier BEFORE INSERT ON public.calibration_records FOR EACH ROW EXECUTE FUNCTION public.phase8_assign_identifiers();
CREATE TRIGGER workstations_identifier BEFORE INSERT OR UPDATE ON public.workstations FOR EACH ROW EXECUTE FUNCTION public.phase8_assign_identifiers();
CREATE TRIGGER visitor_visits_identifier BEFORE INSERT ON public.visitor_visits FOR EACH ROW EXECUTE FUNCTION public.phase8_assign_identifiers();
CREATE TRIGGER vehicle_entries_identifier BEFORE INSERT ON public.vehicle_entries FOR EACH ROW EXECUTE FUNCTION public.phase8_assign_identifiers();
CREATE TRIGGER gate_passes_identifier BEFORE INSERT OR UPDATE ON public.material_gate_passes FOR EACH ROW EXECUTE FUNCTION public.phase8_assign_identifiers();
CREATE TRIGGER security_incidents_identifier BEFORE INSERT ON public.security_incidents FOR EACH ROW EXECUTE FUNCTION public.phase8_assign_identifiers();

INSERT INTO public.application_modules(key,name,group_key,route_path,icon_key,status,sort_order) VALUES
('facility','Facility','operations','/facility','Building2','ENABLED',80),('assets','Assets','operations','/assets','Package','ENABLED',81),('maintenance','Maintenance','operations','/maintenance','Wrench','ENABLED',82),('calibration','Calibration','operations','/calibration','Gauge','ENABLED',83),('security','Security','operations','/security','Shield','ENABLED',84),('workplace','Workplace','operations','/workplace','Armchair','ENABLED',85)
ON CONFLICT(key) DO UPDATE SET name=EXCLUDED.name,route_path=EXCLUDED.route_path,status='ENABLED',sort_order=EXCLUDED.sort_order;
INSERT INTO public.permissions(key,module_key,label,description) VALUES
('facility.view','facility','View facility','View facility locations and responsibilities'),('facility.edit','facility','Manage facility','Manage facility locations and responsibilities'),
('assets.view','assets','View assets','View assets and assignments'),('assets.edit','assets','Manage assets','Manage asset masters, approvals, and assignments'),
('maintenance.view','maintenance','View maintenance','View maintenance plans and work orders'),('maintenance.edit','maintenance','Manage maintenance','Manage maintenance plans and work orders'),
('calibration.view','calibration','View calibration','View instruments and calibration history'),('calibration.edit','calibration','Manage calibration','Manage instruments and calibration acceptance'),
('security.view','security','View security','View visitor, vehicle, gate-pass, and incident records'),('security.edit','security','Manage security','Manage security operations and exceptions'),
('workplace.view','workplace','View workplace','View workstations and allocations'),('workplace.edit','workplace','Manage workplace','Manage workstations and allocations')
ON CONFLICT(key) DO UPDATE SET label=EXCLUDED.label,description=EXCLUDED.description,module_key=EXCLUDED.module_key;
INSERT INTO public.access_role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.access_roles r CROSS JOIN public.permissions p WHERE r.name IN ('System Admin','Facility Manager','Security Officer') AND p.module_key IN ('facility','assets','maintenance','calibration','security','workplace') ON CONFLICT DO NOTHING;
INSERT INTO public.automation_rules(rule_key,name,description,trigger_key,execution_mode,priority,is_enabled) VALUES
('phase8_maintenance_due','Maintenance due reminder','Creates a reviewable reminder for maintenance due within seven days.','maintenance.due','review_required',80,true),
('phase8_calibration_due','Calibration due reminder','Creates a reviewable reminder for calibration due within fourteen days.','calibration.due','review_required',80,true),
('phase8_asset_handover','Asset handover review','Requires a human acknowledgement for asset custody changes.','asset.assignment.created','review_required',90,true),
('phase8_visitor_overstay','Visitor overstay alert','Flags visitors who remain beyond their expected checkout time.','security.visitor.overstay','review_required',90,true)
ON CONFLICT(rule_key) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,execution_mode=EXCLUDED.execution_mode,is_enabled=EXCLUDED.is_enabled;
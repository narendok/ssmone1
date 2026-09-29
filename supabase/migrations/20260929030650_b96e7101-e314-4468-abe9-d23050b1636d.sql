BEGIN;

DO $$
DECLARE
  v_rd uuid;
  v_hw uuid;
  v_purchase uuid;
  v_stores uuid;
  v_quality uuid;
  v_production uuid;
  v_engineering_production uuid;
  v_maintenance uuid;
  v_operations uuid;
  v_sales uuid;
  v_customer_support uuid;
  v_hr uuid;
  v_finance uuid;
  v_marketing uuid;
  v_management_review uuid;
BEGIN
  SELECT id INTO v_rd FROM public.departments WHERE code = 'R&D' LIMIT 1;
  SELECT id INTO v_hw FROM public.departments WHERE code = 'HW' LIMIT 1;
  SELECT id INTO v_purchase FROM public.departments WHERE code = 'PUR/PD' LIMIT 1;
  SELECT id INTO v_stores FROM public.departments WHERE code = 'STR' LIMIT 1;
  SELECT id INTO v_quality FROM public.departments WHERE code = 'QA' LIMIT 1;
  SELECT id INTO v_production FROM public.departments WHERE code = 'MPRD/PRD-01' LIMIT 1;
  SELECT id INTO v_engineering_production FROM public.departments WHERE code = 'EPRD/PRD-02' LIMIT 1;
  SELECT id INTO v_maintenance FROM public.departments WHERE code = 'MNT' LIMIT 1;
  SELECT id INTO v_operations FROM public.departments WHERE code = 'OP' LIMIT 1;
  SELECT id INTO v_sales FROM public.departments WHERE code = 'SAL' LIMIT 1;
  SELECT id INTO v_customer_support FROM public.departments WHERE code = 'CS' LIMIT 1;
  SELECT id INTO v_hr FROM public.departments WHERE code = 'HR' LIMIT 1;
  SELECT id INTO v_finance FROM public.departments WHERE code = 'FIN' LIMIT 1;
  SELECT id INTO v_marketing FROM public.departments WHERE code = 'MKT/BD' LIMIT 1;
  SELECT id INTO v_management_review FROM public.departments WHERE code = 'MR' LIMIT 1;

  IF v_rd IS NULL OR v_hw IS NULL OR v_purchase IS NULL OR v_stores IS NULL OR v_quality IS NULL OR v_production IS NULL OR v_engineering_production IS NULL OR v_maintenance IS NULL OR v_operations IS NULL OR v_sales IS NULL OR v_customer_support IS NULL OR v_hr IS NULL OR v_finance IS NULL OR v_marketing IS NULL OR v_management_review IS NULL THEN
    RAISE EXCEPTION 'Approved department consolidation prerequisites are missing.';
  END IF;

  UPDATE public.departments
  SET name = 'Hardware & R&D', code = 'RND', aliases = ARRAY['R&D', 'Research & Development', 'HW', 'Hardware', 'Embedded Software', 'Software'], description = 'Consolidated Hardware and R&D department.', is_active = true, parent_department_id = NULL, sort_order = 10
  WHERE id = v_rd;

  UPDATE public.departments
  SET name = 'Procurement, Stores & Incoming Quality', code = 'PROC', aliases = ARRAY['Purchase', 'Procurement', 'Stores', 'Incoming Quality', 'Quality Assurance', 'QA'], description = 'Consolidated procurement, stores, inwarding, and incoming quality department.', is_active = true, parent_department_id = NULL, sort_order = 20
  WHERE id = v_purchase;

  UPDATE public.departments
  SET name = 'Production & Calibration', code = 'PROD', aliases = ARRAY['Production', 'Engineering Production', 'Calibration'], description = 'Consolidated production and calibration department.', is_active = true, parent_department_id = NULL, sort_order = 30
  WHERE id = v_production;

  UPDATE public.departments
  SET name = 'Facility, Maintenance, Security, Utilities & Assets', code = 'FAC', aliases = ARRAY['Facility', 'Maintenance', 'Security', 'Electrical', 'Utilities', 'Assets'], description = 'Consolidated facility, maintenance, security, utilities, and asset department.', is_active = true, parent_department_id = NULL, sort_order = 40
  WHERE id = v_maintenance;

  UPDATE public.departments
  SET name = 'Operations & QMS', code = 'OPS', aliases = ARRAY['Operations', 'QMS', 'Management Review'], description = 'Consolidated operations and quality-management-system department.', is_active = true, parent_department_id = NULL, sort_order = 50
  WHERE id = v_operations;

  UPDATE public.departments
  SET name = 'Sales', code = 'SAL', aliases = ARRAY['Sales', 'Customer Support', 'Marketing', 'Business Development'], description = 'Consolidated sales, customer support, marketing, and business development department.', is_active = true, parent_department_id = NULL, sort_order = 60
  WHERE id = v_sales;

  UPDATE public.departments
  SET name = 'Human Resources', code = 'HR', aliases = ARRAY['HR', 'Human Resources'], is_active = true, parent_department_id = NULL, sort_order = 70
  WHERE id = v_hr;

  UPDATE public.departments
  SET name = 'Finance', code = 'FIN', aliases = ARRAY['Finance'], is_active = true, parent_department_id = NULL, sort_order = 80
  WHERE id = v_finance;

  UPDATE public.departments
  SET name = 'Administration', code = 'ADM', aliases = ARRAY['Administration', 'Admin'], description = 'Organization administration and governed access management.', is_active = true, parent_department_id = NULL, sort_order = 90
  WHERE id = v_management_review;

  CREATE TEMP TABLE department_migrations (source_id uuid PRIMARY KEY, target_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO department_migrations(source_id, target_id) VALUES
    (v_hw, v_rd),
    ((SELECT id FROM public.departments WHERE code = 'ESW' LIMIT 1), v_rd),
    ((SELECT id FROM public.departments WHERE code = 'SW' LIMIT 1), v_rd),
    (v_stores, v_purchase),
    (v_quality, v_purchase),
    (v_engineering_production, v_production),
    (v_customer_support, v_sales),
    (v_marketing, v_sales),
    (v_management_review, v_management_review)
  ON CONFLICT (source_id) DO NOTHING;
  DELETE FROM department_migrations WHERE source_id IS NULL OR source_id = target_id;

  INSERT INTO public.employee_departments(employee_id, department_id, is_primary)
  SELECT ed.employee_id, dm.target_id, bool_or(ed.is_primary)
  FROM public.employee_departments ed
  JOIN department_migrations dm ON dm.source_id = ed.department_id
  GROUP BY ed.employee_id, dm.target_id
  ON CONFLICT (employee_id, department_id) DO UPDATE SET is_primary = public.employee_departments.is_primary OR EXCLUDED.is_primary;

  UPDATE public.employees e SET primary_department_id = dm.target_id FROM department_migrations dm WHERE e.primary_department_id = dm.source_id;
  UPDATE public.departments d SET parent_department_id = dm.target_id FROM department_migrations dm WHERE d.parent_department_id = dm.source_id;
  UPDATE public.hr_job_postings x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.hr_job_profiles x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.hr_job_requisitions x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.hr_onboarding_plans x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.hr_training_programs x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.project_tasks x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.purchase_requests x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.qms_audits x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.qms_kpis x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.qms_quality_objectives x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.qms_risks x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.quick_expenses x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.rd_members x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;
  UPDATE public.requirement_feasibility_reviews x SET department_id = dm.target_id FROM department_migrations dm WHERE x.department_id = dm.source_id;

  DELETE FROM public.employee_departments ed USING department_migrations dm WHERE ed.department_id = dm.source_id;

  UPDATE public.departments d
  SET is_active = false,
      code = NULL,
      aliases = ARRAY[d.name],
      description = coalesce(d.description || E'\n\n', '') || 'Inactive legacy alias; references migrated to the approved consolidated department.'
  FROM department_migrations dm
  WHERE d.id = dm.source_id;

  UPDATE public.departments SET parent_department_id = v_rd WHERE id IN (SELECT id FROM public.departments WHERE code IN ('ESW', 'SW'));
END $$;

WITH desired(role_name, permission_key) AS (
  VALUES
    ('Employee / Engineer','engineering.view'), ('Employee / Engineer','engineering.create'), ('Employee / Engineer','engineering.edit'), ('Employee / Engineer','projects.view'), ('Employee / Engineer','documents.view'), ('Employee / Engineer','inventory.view'),
    ('Project Manager','engineering.view'), ('Project Manager','engineering.create'), ('Project Manager','engineering.edit'), ('Project Manager','projects.view'), ('Project Manager','projects.create'), ('Project Manager','projects.edit'), ('Project Manager','documents.view'), ('Project Manager','documents.create'), ('Project Manager','documents.edit'), ('Project Manager','inventory.view'),
    ('Team Lead','engineering.view'), ('Team Lead','engineering.create'), ('Team Lead','engineering.edit'), ('Team Lead','projects.view'), ('Team Lead','projects.create'), ('Team Lead','projects.edit'), ('Team Lead','documents.view'), ('Team Lead','documents.create'), ('Team Lead','documents.edit'), ('Team Lead','inventory.view'),
    ('Purchase','procurement.view'), ('Purchase','procurement.create'), ('Purchase','procurement.edit'), ('Purchase','procurement.approve'), ('Purchase','inventory.view'), ('Purchase','quality.view'),
    ('Storekeeper','inventory.view'), ('Storekeeper','inventory.manage'), ('Storekeeper','procurement.view'), ('Storekeeper','procurement.edit'),
    ('QA','quality.view'), ('QA','quality.create'), ('QA','quality.edit'), ('QA','qms.view'), ('QA','inventory.view'),
    ('Production Manager / Operator','production.view'), ('Production Manager / Operator','production.create'), ('Production Manager / Operator','production.edit'), ('Production Manager / Operator','inventory.view'),
    ('Calibration','calibration.view'), ('Calibration','calibration.create'), ('Calibration','calibration.edit'), ('Calibration','production.view'),
    ('Facility','facility.view'), ('Facility','facility.create'), ('Facility','facility.edit'),
    ('Maintenance','maintenance.view'), ('Maintenance','maintenance.create'), ('Maintenance','maintenance.edit'),
    ('Security','security.view'), ('Security','security.create'), ('Security','security.edit'),
    ('Asset Manager','assets.view'), ('Asset Manager','assets.create'), ('Asset Manager','assets.edit'),
    ('QMS Manager','qms.view'), ('QMS Manager','qms.create'), ('QMS Manager','qms.edit'), ('QMS Manager','qms.approve'), ('QMS Manager','customer_service.view'),
    ('Sales','sales.view'), ('Sales','sales.create'), ('Sales','sales.edit'), ('Sales','projects.view'), ('Sales','documents.view'),
    ('Customer Service','customer_service.view'), ('Customer Service','customer_service.edit'), ('Customer Service','customer_service.approve'), ('Customer Service','qms.view'),
    ('HR Admin','hr.view'), ('HR Admin','recruitment.manage'), ('HR Admin','leave.manage'), ('HR Admin','leave.approve'), ('HR Admin','training.manage'),
    ('Finance','finance.view'), ('Finance','finance.create'), ('Finance','finance.edit'),
    ('Head of Department','projects.view'), ('Head of Department','projects.edit'), ('Head of Department','documents.view'), ('Head of Department','documents.edit'),
    ('Viewer / Auditor','documents.view'), ('Viewer / Auditor','projects.view'), ('Viewer / Auditor','qms.view')
), governed_roles(role_name) AS (
  VALUES ('Employee / Engineer'), ('Project Manager'), ('Team Lead'), ('Purchase'), ('Storekeeper'), ('QA'), ('Production Manager / Operator'), ('Calibration'), ('Facility'), ('Maintenance'), ('Security'), ('Asset Manager'), ('QMS Manager'), ('Sales'), ('Customer Service'), ('HR Admin'), ('Finance'), ('Head of Department'), ('Viewer / Auditor')
)
DELETE FROM public.access_role_permissions arp
USING public.access_roles ar, governed_roles gr
WHERE ar.id = arp.role_id AND ar.name = gr.role_name;

WITH desired(role_name, permission_key) AS (
  VALUES
    ('Employee / Engineer','engineering.view'), ('Employee / Engineer','engineering.create'), ('Employee / Engineer','engineering.edit'), ('Employee / Engineer','projects.view'), ('Employee / Engineer','documents.view'), ('Employee / Engineer','inventory.view'),
    ('Project Manager','engineering.view'), ('Project Manager','engineering.create'), ('Project Manager','engineering.edit'), ('Project Manager','projects.view'), ('Project Manager','projects.create'), ('Project Manager','projects.edit'), ('Project Manager','documents.view'), ('Project Manager','documents.create'), ('Project Manager','documents.edit'), ('Project Manager','inventory.view'),
    ('Team Lead','engineering.view'), ('Team Lead','engineering.create'), ('Team Lead','engineering.edit'), ('Team Lead','projects.view'), ('Team Lead','projects.create'), ('Team Lead','projects.edit'), ('Team Lead','documents.view'), ('Team Lead','documents.create'), ('Team Lead','documents.edit'), ('Team Lead','inventory.view'),
    ('Purchase','procurement.view'), ('Purchase','procurement.create'), ('Purchase','procurement.edit'), ('Purchase','procurement.approve'), ('Purchase','inventory.view'), ('Purchase','quality.view'),
    ('Storekeeper','inventory.view'), ('Storekeeper','inventory.manage'), ('Storekeeper','procurement.view'), ('Storekeeper','procurement.edit'),
    ('QA','quality.view'), ('QA','quality.create'), ('QA','quality.edit'), ('QA','qms.view'), ('QA','inventory.view'),
    ('Production Manager / Operator','production.view'), ('Production Manager / Operator','production.create'), ('Production Manager / Operator','production.edit'), ('Production Manager / Operator','inventory.view'),
    ('Calibration','calibration.view'), ('Calibration','calibration.create'), ('Calibration','calibration.edit'), ('Calibration','production.view'),
    ('Facility','facility.view'), ('Facility','facility.create'), ('Facility','facility.edit'),
    ('Maintenance','maintenance.view'), ('Maintenance','maintenance.create'), ('Maintenance','maintenance.edit'),
    ('Security','security.view'), ('Security','security.create'), ('Security','security.edit'),
    ('Asset Manager','assets.view'), ('Asset Manager','assets.create'), ('Asset Manager','assets.edit'),
    ('QMS Manager','qms.view'), ('QMS Manager','qms.create'), ('QMS Manager','qms.edit'), ('QMS Manager','qms.approve'), ('QMS Manager','customer_service.view'),
    ('Sales','sales.view'), ('Sales','sales.create'), ('Sales','sales.edit'), ('Sales','projects.view'), ('Sales','documents.view'),
    ('Customer Service','customer_service.view'), ('Customer Service','customer_service.edit'), ('Customer Service','customer_service.approve'), ('Customer Service','qms.view'),
    ('HR Admin','hr.view'), ('HR Admin','recruitment.manage'), ('HR Admin','leave.manage'), ('HR Admin','leave.approve'), ('HR Admin','training.manage'),
    ('Finance','finance.view'), ('Finance','finance.create'), ('Finance','finance.edit'),
    ('Head of Department','projects.view'), ('Head of Department','projects.edit'), ('Head of Department','documents.view'), ('Head of Department','documents.edit'),
    ('Viewer / Auditor','documents.view'), ('Viewer / Auditor','projects.view'), ('Viewer / Auditor','qms.view')
)
INSERT INTO public.access_role_permissions(role_id, permission_id)
SELECT ar.id, p.id
FROM desired d
JOIN public.access_roles ar ON ar.name = d.role_name
JOIN public.permissions p ON p.key = d.permission_key
ON CONFLICT (role_id, permission_id) DO NOTHING;

DROP POLICY IF EXISTS "Explicit inventory readers view components" ON public.components;
CREATE POLICY "Explicit scoped inventory readers view components" ON public.components FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'engineering.view', 'engineering.edit', 'procurement.view', 'procurement.edit', 'production.view', 'quality.view']));
DROP POLICY IF EXISTS "Explicit inventory readers view locations" ON public.locations;
CREATE POLICY "Explicit scoped inventory readers view locations" ON public.locations FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'engineering.view', 'engineering.edit', 'procurement.view', 'procurement.edit', 'production.view', 'quality.view']));
DROP POLICY IF EXISTS "Explicit inventory readers view inventory lots" ON public.inventory_lots;
CREATE POLICY "Explicit scoped inventory readers view inventory lots" ON public.inventory_lots FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'engineering.view', 'engineering.edit', 'procurement.view', 'procurement.edit', 'production.view', 'quality.view']));
DROP POLICY IF EXISTS "Explicit inventory readers view substitutes" ON public.component_substitutes;
CREATE POLICY "Explicit scoped inventory readers view substitutes" ON public.component_substitutes FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'engineering.view', 'engineering.edit', 'procurement.view', 'procurement.edit', 'production.view', 'quality.view']));
DROP POLICY IF EXISTS "Explicit inventory readers view component projects" ON public.component_projects;
CREATE POLICY "Explicit scoped inventory readers view component projects" ON public.component_projects FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'engineering.view', 'engineering.edit', 'procurement.view', 'procurement.edit', 'production.view', 'quality.view']));

DROP POLICY IF EXISTS "Project teams manage Drive nodes" ON public.drive_nodes;
CREATE POLICY "Project and engineering managers manage Drive nodes" ON public.drive_nodes FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.manage', 'engineering.manage'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['projects.manage', 'engineering.manage']));

COMMIT;
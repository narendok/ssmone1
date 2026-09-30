CREATE TABLE public.drive_category_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  placement text NOT NULL CHECK (placement IN ('COMMON', 'INTERNAL_PROJECT', 'CLIENT_PROJECT')),
  label text NOT NULL,
  slug text NOT NULL,
  linked_work_area text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, placement, slug)
);
GRANT SELECT ON public.drive_category_templates TO authenticated;
GRANT ALL ON public.drive_category_templates TO service_role;
ALTER TABLE public.drive_category_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized users view Drive category templates"
ON public.drive_category_templates FOR SELECT TO authenticated
USING (public.can_access_department_drive(auth.uid(), department_id, NULL));
CREATE POLICY "Administrators manage Drive category templates"
ON public.drive_category_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.touch_drive_category_templates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_drive_category_templates_updated_at
BEFORE UPDATE ON public.drive_category_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_drive_category_templates();

CREATE OR REPLACE FUNCTION public.provision_drive_category_template(
  p_parent_id uuid,
  p_department_id uuid,
  p_placement text,
  p_project_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category record;
BEGIN
  FOR v_category IN
    SELECT * FROM public.drive_category_templates
    WHERE department_id = p_department_id
      AND placement = p_placement
      AND is_active = true
    ORDER BY sort_order, label
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.drive_nodes
      WHERE parent_id = p_parent_id
        AND slug = v_category.slug
        AND folder_kind = 'STANDARD'
    ) THEN
      INSERT INTO public.drive_nodes(
        project_id, department_id, parent_id, name, slug, node_type,
        is_locked, folder_kind, metadata
      ) VALUES (
        p_project_id, p_department_id, p_parent_id, v_category.label,
        v_category.slug, 'FOLDER', true, 'STANDARD',
        jsonb_build_object(
          'workspace_template', 'department-category-v1',
          'placement', p_placement,
          'linked_work_area', v_category.linked_work_area
        )
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.provision_department_drive_template(p_department_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root uuid;
  v_common uuid;
  v_department public.departments%ROWTYPE;
  v_folder record;
BEGIN
  SELECT * INTO v_department FROM public.departments WHERE id = p_department_id AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT id INTO v_root
  FROM public.drive_nodes
  WHERE department_id = p_department_id AND folder_kind = 'DEPARTMENT_ROOT' AND parent_id IS NULL
  ORDER BY created_at LIMIT 1;

  IF v_root IS NULL THEN
    INSERT INTO public.drive_nodes(department_id, parent_id, name, slug, node_type, is_locked, folder_kind, metadata)
    VALUES (p_department_id, NULL, v_department.name, 'department-' || lower(regexp_replace(v_department.code, '[^A-Za-z0-9]+', '-', 'g')), 'FOLDER', true, 'DEPARTMENT_ROOT', jsonb_build_object('workspace_template', 'department-governed-v2'))
    RETURNING id INTO v_root;
  END IF;

  FOR v_folder IN SELECT * FROM (VALUES
    ('00 Common Rules, Regulations & Standards', '00-common-rules-regulations-standards', 'DEPARTMENT_STANDARDS'),
    ('01 Internal Projects', '01-internal-projects', 'INTERNAL_PROJECTS'),
    ('02 Client Projects', '02-client-projects', 'CLIENT_PROJECTS')
  ) AS template(name, slug, folder_kind)
  LOOP
    INSERT INTO public.drive_nodes(department_id, parent_id, name, slug, node_type, is_locked, folder_kind, metadata)
    SELECT p_department_id, v_root, v_folder.name, v_folder.slug, 'FOLDER', true, v_folder.folder_kind, jsonb_build_object('workspace_template', 'department-governed-v2')
    WHERE NOT EXISTS (
      SELECT 1 FROM public.drive_nodes
      WHERE parent_id = v_root AND department_id = p_department_id AND folder_kind = v_folder.folder_kind
    );
  END LOOP;

  SELECT id INTO v_common
  FROM public.drive_nodes
  WHERE parent_id = v_root AND department_id = p_department_id AND folder_kind = 'DEPARTMENT_STANDARDS'
  ORDER BY created_at LIMIT 1;
  IF v_common IS NOT NULL THEN
    PERFORM public.provision_drive_category_template(v_common, p_department_id, 'COMMON');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.provision_project_drive_template(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root uuid;
  v_parent uuid;
  v_code text;
  v_name text;
  v_department_id uuid;
  v_class text;
  v_folder record;
BEGIN
  SELECT code, name, department_id, drive_project_class
    INTO v_code, v_name, v_department_id, v_class
  FROM public.projects WHERE id = p_project_id;
  IF v_code IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;

  IF v_department_id IS NOT NULL THEN
    PERFORM public.provision_department_drive_template(v_department_id);
    SELECT id INTO v_parent FROM public.drive_nodes
    WHERE department_id = v_department_id
      AND folder_kind = CASE WHEN v_class = 'CLIENT' THEN 'CLIENT_PROJECTS' ELSE 'INTERNAL_PROJECTS' END
    ORDER BY created_at LIMIT 1;
  END IF;

  SELECT id INTO v_root
  FROM public.drive_nodes
  WHERE project_id = p_project_id AND folder_kind = 'PROJECT_ROOT'
  ORDER BY created_at LIMIT 1;

  IF v_root IS NULL THEN
    SELECT id INTO v_root FROM public.drive_nodes WHERE project_id = p_project_id AND parent_id IS NULL ORDER BY created_at LIMIT 1;
  END IF;

  IF v_root IS NULL THEN
    INSERT INTO public.drive_nodes(project_id, department_id, parent_id, name, slug, node_type, is_locked, folder_kind, metadata)
    VALUES (p_project_id, v_department_id, v_parent, v_code || '_' || v_name, 'project-root', 'FOLDER', true, 'PROJECT_ROOT', jsonb_build_object('workspace_template', 'project-governed-v3'))
    RETURNING id INTO v_root;
  ELSE
    UPDATE public.drive_nodes
      SET department_id = COALESCE(v_department_id, department_id),
          parent_id = COALESCE(v_parent, parent_id),
          folder_kind = 'PROJECT_ROOT',
          is_locked = true,
          metadata = metadata || jsonb_build_object('workspace_template', 'project-governed-v3')
    WHERE id = v_root;
  END IF;

  FOR v_folder IN SELECT * FROM (VALUES
    ('01 Project Management & Administration', '01-project-management-administration'),
    ('02 Requirements & System Engineering', '02-requirements-system-engineering'),
    ('03 Hardware Engineering', '03-hardware-engineering'),
    ('04 Software & Firmware', '04-software-firmware'),
    ('05 Mechanical & Thermal Design', '05-mechanical-thermal-design'),
    ('06 Validation & Testing', '06-validation-testing'),
    ('07 Manufacturing, Quality & Supply Chain', '07-manufacturing-quality-supply-chain'),
    ('08 Deliverables & Client Handover', '08-deliverables-client-handover')
  ) AS template(name, slug)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.drive_nodes WHERE project_id = p_project_id AND parent_id = v_root AND slug = v_folder.slug) THEN
      INSERT INTO public.drive_nodes(project_id, department_id, parent_id, name, slug, node_type, is_locked, folder_kind, metadata)
      VALUES (p_project_id, v_department_id, v_root, v_folder.name, v_folder.slug, 'FOLDER', true, 'STANDARD', jsonb_build_object('workspace_template', 'project-governed-v3'));
    END IF;
  END LOOP;

  IF v_department_id IS NOT NULL THEN
    PERFORM public.provision_drive_category_template(
      v_root,
      v_department_id,
      CASE WHEN v_class = 'CLIENT' THEN 'CLIENT_PROJECT' ELSE 'INTERNAL_PROJECT' END,
      p_project_id
    );
  END IF;
END;
$$;

INSERT INTO public.drive_category_templates(department_id, placement, label, slug, linked_work_area, sort_order)
SELECT d.id, seed.placement, seed.label, seed.slug, seed.linked_work_area, seed.sort_order
FROM public.departments d
JOIN (VALUES
  ('RND', 'COMMON', 'Engineering Standards & Rules', 'engineering-standards-rules', 'engineering', 10),
  ('RND', 'COMMON', 'Engineering Project Tracker', 'engineering-project-tracker', 'projects', 20),
  ('RND', 'COMMON', 'Requirements & Release Evidence', 'requirements-release-evidence', 'requirements', 30),
  ('RND', 'INTERNAL_PROJECT', 'Firmware Only', 'firmware-only', 'firmware', 10),
  ('RND', 'CLIENT_PROJECT', 'Firmware Only', 'firmware-only', 'firmware', 10),
  ('PROC', 'COMMON', 'Supplier & Sourcing Standards', 'supplier-sourcing-standards', 'procurement', 10),
  ('PROC', 'COMMON', 'Incoming Quality (IQC)', 'incoming-quality-iqc', 'incoming-quality', 20),
  ('PROC', 'COMMON', 'Controlled BOM Sourcing', 'controlled-bom-sourcing', 'bom-sourcing', 30),
  ('PROC', 'INTERNAL_PROJECT', 'RFQs, Orders & Incoming Quality', 'rfqs-orders-incoming-quality', 'procurement', 10),
  ('PROC', 'CLIENT_PROJECT', 'RFQs, Orders & Incoming Quality', 'rfqs-orders-incoming-quality', 'procurement', 10),
  ('PROD', 'COMMON', 'Production Standards & Work Instructions', 'production-standards-work-instructions', 'production', 10),
  ('PROD', 'COMMON', 'PPAP, Release & Dispatch Evidence', 'ppap-release-dispatch-evidence', 'ppap', 20),
  ('PROD', 'INTERNAL_PROJECT', 'Assembly, Testing & Release', 'assembly-testing-release', 'production', 10),
  ('PROD', 'CLIENT_PROJECT', 'Assembly, Testing & Release', 'assembly-testing-release', 'production', 10),
  ('FAC', 'COMMON', 'Asset, Maintenance & Safety Standards', 'asset-maintenance-safety-standards', 'facility', 10),
  ('FAC', 'COMMON', 'Utilities, Electrical & Gate Records', 'utilities-electrical-gate-records', 'facility', 20),
  ('FAC', 'INTERNAL_PROJECT', 'Facility Change Records', 'facility-change-records', 'facility', 10),
  ('FAC', 'CLIENT_PROJECT', 'Client Site Records', 'client-site-records', 'facility', 10),
  ('OPS', 'COMMON', 'QMS, Governance & Audit Standards', 'qms-governance-audit-standards', 'qms', 10),
  ('OPS', 'COMMON', 'Audits, CAPA, Risks & KPIs', 'audits-capa-risks-kpis', 'qms', 20),
  ('OPS', 'INTERNAL_PROJECT', 'Quality Release Evidence', 'quality-release-evidence', 'qms', 10),
  ('OPS', 'CLIENT_PROJECT', 'Client Quality Release Evidence', 'client-quality-release-evidence', 'qms', 10),
  ('HR', 'COMMON', 'HR Policies, Standards & Templates', 'hr-policies-standards-templates', 'hr', 10),
  ('HR', 'COMMON', 'Recruitment, Onboarding & Training', 'recruitment-onboarding-training', 'hr', 20),
  ('HR', 'INTERNAL_PROJECT', 'Internal People Program Records', 'internal-people-program-records', 'hr', 10),
  ('HR', 'CLIENT_PROJECT', 'Client Training Records', 'client-training-records', 'hr', 10),
  ('SAL', 'COMMON', 'Sales Standards & Commercial Templates', 'sales-standards-commercial-templates', 'sales', 10),
  ('SAL', 'COMMON', 'Customer Requirements & Quotations', 'customer-requirements-quotations', 'sales', 20),
  ('SAL', 'INTERNAL_PROJECT', 'Commercial Handover Records', 'commercial-handover-records', 'sales', 10),
  ('SAL', 'CLIENT_PROJECT', 'Client Documents & Handover', 'client-documents-handover', 'sales', 10),
  ('FIN', 'COMMON', 'Finance Policies & Commercial Controls', 'finance-policies-commercial-controls', 'finance', 10),
  ('FIN', 'COMMON', 'Payments, Expenses & Finance Records', 'payments-expenses-finance-records', 'finance', 20),
  ('FIN', 'INTERNAL_PROJECT', 'Internal Finance Records', 'internal-finance-records', 'finance', 10),
  ('FIN', 'CLIENT_PROJECT', 'Client Commercial Records', 'client-commercial-records', 'finance', 10)
) AS seed(department_code, placement, label, slug, linked_work_area, sort_order)
  ON d.code = seed.department_code
ON CONFLICT (department_id, placement, slug) DO NOTHING;

DO $$
DECLARE v_department_id uuid;
BEGIN
  FOR v_department_id IN SELECT id FROM public.departments WHERE is_active LOOP
    PERFORM public.provision_department_drive_template(v_department_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_drive_category_template(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_drive_category_template(uuid, uuid, text, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.provision_department_drive_template(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_department_drive_template(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.provision_project_drive_template(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_project_drive_template(uuid) TO service_role;
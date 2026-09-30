ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS drive_project_class text NOT NULL DEFAULT 'INTERNAL' CHECK (drive_project_class IN ('INTERNAL', 'CLIENT'));

ALTER TABLE public.drive_nodes
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS folder_kind text NOT NULL DEFAULT 'STANDARD' CHECK (folder_kind IN ('DEPARTMENT_ROOT', 'DEPARTMENT_STANDARDS', 'INTERNAL_PROJECTS', 'CLIENT_PROJECTS', 'PROJECT_ROOT', 'STANDARD', 'UNASSIGNED_ROOT'));

CREATE INDEX IF NOT EXISTS projects_department_id_idx ON public.projects(department_id);
CREATE INDEX IF NOT EXISTS drive_nodes_department_id_idx ON public.drive_nodes(department_id);
CREATE INDEX IF NOT EXISTS drive_nodes_folder_kind_idx ON public.drive_nodes(folder_kind);

CREATE OR REPLACE FUNCTION public.current_employee_department_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT department_id), ARRAY[]::uuid[])
  FROM public.employee_departments ed
  JOIN public.employees e ON e.id = ed.employee_id
  WHERE e.user_id = _user_id
    AND e.employment_status = 'ACTIVE'
$$;

CREATE OR REPLACE FUNCTION public.can_access_department_drive(_user_id uuid, _department_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR (_department_id IS NOT NULL AND _department_id = ANY(public.current_employee_department_ids(_user_id)))
    OR (_project_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      JOIN public.employees e ON e.id = ptm.employee_id
      WHERE ptm.project_id = _project_id
        AND e.user_id = _user_id
        AND e.employment_status = 'ACTIVE'
    ))
$$;

CREATE OR REPLACE FUNCTION public.provision_department_drive_template(p_department_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root uuid;
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
    VALUES (p_department_id, NULL, v_department.name, 'department-' || lower(regexp_replace(v_department.code, '[^A-Za-z0-9]+', '-', 'g')), 'FOLDER', true, 'DEPARTMENT_ROOT', jsonb_build_object('workspace_template', 'department-governed-v1'))
    RETURNING id INTO v_root;
  END IF;

  FOR v_folder IN SELECT * FROM (VALUES
    ('00 Rules, Regulations & Standards', '00-rules-regulations-standards', 'DEPARTMENT_STANDARDS'),
    ('01 Internal Projects', '01-internal-projects', 'INTERNAL_PROJECTS'),
    ('02 Client Projects', '02-client-projects', 'CLIENT_PROJECTS')
  ) AS template(name, slug, folder_kind)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.drive_nodes
      WHERE parent_id = v_root AND department_id = p_department_id AND folder_kind = v_folder.folder_kind
    ) THEN
      INSERT INTO public.drive_nodes(department_id, parent_id, name, slug, node_type, is_locked, folder_kind, metadata)
      VALUES (p_department_id, v_root, v_folder.name, v_folder.slug, 'FOLDER', true, v_folder.folder_kind, jsonb_build_object('workspace_template', 'department-governed-v1'));
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.provision_department_drive_folders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active THEN PERFORM public.provision_department_drive_template(NEW.id); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provision_department_drive_folders_trigger ON public.departments;
CREATE TRIGGER provision_department_drive_folders_trigger
AFTER INSERT OR UPDATE OF is_active ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.provision_department_drive_folders();

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
    VALUES (p_project_id, v_department_id, v_parent, v_code || '_' || v_name, 'project-root', 'FOLDER', true, 'PROJECT_ROOT', jsonb_build_object('workspace_template', 'project-governed-v2'))
    RETURNING id INTO v_root;
  ELSE
    UPDATE public.drive_nodes
      SET department_id = COALESCE(v_department_id, department_id),
          parent_id = COALESCE(v_parent, parent_id),
          folder_kind = 'PROJECT_ROOT',
          is_locked = true,
          metadata = metadata || jsonb_build_object('workspace_template', 'project-governed-v2')
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
      VALUES (p_project_id, v_department_id, v_root, v_folder.name, v_folder.slug, 'FOLDER', true, 'STANDARD', jsonb_build_object('workspace_template', 'project-governed-v2'));
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_drive_structure()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_locked THEN RAISE EXCEPTION 'Standard document folders cannot be removed'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_locked AND (
    NEW.name IS DISTINCT FROM OLD.name OR NEW.slug IS DISTINCT FROM OLD.slug OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.is_trashed IS DISTINCT FROM OLD.is_trashed OR NEW.folder_kind IS DISTINCT FROM OLD.folder_kind
  ) THEN RAISE EXCEPTION 'Standard document folders cannot be renamed, moved, or removed'; END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_drive_structure_trigger ON public.drive_nodes;
CREATE TRIGGER protect_drive_structure_trigger
BEFORE UPDATE OR DELETE ON public.drive_nodes
FOR EACH ROW EXECUTE FUNCTION public.protect_drive_structure();

UPDATE public.departments
SET is_active = false,
    code = NULL,
    aliases = ARRAY['Administration', 'Admin'],
    description = 'Retired department retained for historical references.'
WHERE code = 'ADM' OR lower(name) IN ('administration', 'administrator');

DO $$
DECLARE v_department_id uuid;
BEGIN
  FOR v_department_id IN SELECT id FROM public.departments WHERE is_active LOOP
    PERFORM public.provision_department_drive_template(v_department_id);
  END LOOP;
END;
$$;

UPDATE public.drive_nodes dn
SET department_id = p.department_id
FROM public.projects p
WHERE dn.project_id = p.id AND dn.department_id IS NULL AND p.department_id IS NOT NULL;

DROP POLICY IF EXISTS "Project teams view drive nodes" ON public.drive_nodes;
DROP POLICY IF EXISTS "Project teams manage drive nodes" ON public.drive_nodes;
DROP POLICY IF EXISTS "Project and engineering managers manage Drive nodes" ON public.drive_nodes;
DROP POLICY IF EXISTS "drive_nodes_insert" ON public.drive_nodes;
DROP POLICY IF EXISTS "drive_nodes_delete" ON public.drive_nodes;

CREATE POLICY "Authorized users view department Drive nodes"
ON public.drive_nodes FOR SELECT TO authenticated
USING (public.can_access_department_drive(auth.uid(), department_id, project_id));

CREATE POLICY "Authorized users add department Drive nodes"
ON public.drive_nodes FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_department_drive(auth.uid(), department_id, project_id)
  AND public.has_any_permission(auth.uid(), ARRAY['projects.manage', 'engineering.manage', 'documents.edit'])
);

CREATE POLICY "Authorized users update department Drive nodes"
ON public.drive_nodes FOR UPDATE TO authenticated
USING (
  public.can_access_department_drive(auth.uid(), department_id, project_id)
  AND public.has_any_permission(auth.uid(), ARRAY['projects.manage', 'engineering.manage', 'documents.edit'])
)
WITH CHECK (
  public.can_access_department_drive(auth.uid(), department_id, project_id)
  AND public.has_any_permission(auth.uid(), ARRAY['projects.manage', 'engineering.manage', 'documents.edit'])
);

CREATE POLICY "Authorized users remove department Drive nodes"
ON public.drive_nodes FOR DELETE TO authenticated
USING (
  is_locked = false
  AND public.can_access_department_drive(auth.uid(), department_id, project_id)
  AND public.has_any_permission(auth.uid(), ARRAY['projects.manage', 'engineering.manage', 'documents.edit'])
);

UPDATE public.access_roles SET name = 'Platform Owner', description = 'Protected platform control access' WHERE name = 'System Admin';
UPDATE public.employees SET default_role_id = (SELECT id FROM public.access_roles WHERE name = 'Platform Owner') WHERE default_role_id = 'd5548bd3-9d47-4c4c-8a79-4c98c054b6ea';

GRANT EXECUTE ON FUNCTION public.current_employee_department_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_department_drive(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provision_department_drive_template(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.provision_project_drive_template(uuid) TO service_role;

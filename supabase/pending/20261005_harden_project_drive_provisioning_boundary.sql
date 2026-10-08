-- REVIEW ONLY — unapplied. This proposal hardens the existing service-only
-- project Drive provisioner without changing role, RLS, or public access.
-- Apply only after managed-backend acceptance verifies existing project roots.

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
  PERFORM pg_advisory_xact_lock(hashtextextended('project-drive:' || p_project_id::text, 0));

  SELECT code, name, department_id, drive_project_class
    INTO v_code, v_name, v_department_id, v_class
  FROM public.projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  IF v_department_id IS NOT NULL THEN
    PERFORM public.provision_department_drive_template(v_department_id);
    SELECT id INTO v_parent
    FROM public.drive_nodes
    WHERE department_id = v_department_id
      AND folder_kind = CASE WHEN v_class = 'CLIENT' THEN 'CLIENT_PROJECTS' ELSE 'INTERNAL_PROJECTS' END
      AND node_type = 'FOLDER'
      AND is_trashed = false
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE;
  END IF;

  SELECT id INTO v_root
  FROM public.drive_nodes
  WHERE project_id = p_project_id
    AND department_id IS NOT DISTINCT FROM v_department_id
    AND folder_kind = 'PROJECT_ROOT'
    AND node_type = 'FOLDER'
    AND is_trashed = false
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_root IS NULL THEN
    SELECT id INTO v_root
    FROM public.drive_nodes
    WHERE project_id = p_project_id
      AND parent_id IS NULL
      AND node_type = 'FOLDER'
      AND is_trashed = false
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE;
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
    WHERE id = v_root
      AND project_id = p_project_id
      AND node_type = 'FOLDER'
      AND is_trashed = false;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Canonical project Drive root is invalid';
    END IF;
  END IF;

  UPDATE public.projects
  SET project_drive_node_id = v_root
  WHERE id = p_project_id
    AND department_id IS NOT DISTINCT FROM v_department_id
    AND (project_drive_node_id IS NULL OR project_drive_node_id = v_root);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project Drive root pointer conflicts with the canonical root';
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
    IF NOT EXISTS (
      SELECT 1 FROM public.drive_nodes
      WHERE project_id = p_project_id
        AND parent_id = v_root
        AND slug = v_folder.slug
        AND is_trashed = false
    ) THEN
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

REVOKE ALL ON FUNCTION public.provision_project_drive_template(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_project_drive_template(uuid) TO service_role;
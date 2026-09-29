CREATE OR REPLACE FUNCTION public.provision_project_drive_template(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root uuid;
  v_code text;
  v_name text;
  v_folder record;
BEGIN
  SELECT code, name INTO v_code, v_name
  FROM public.projects
  WHERE id = p_project_id;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  SELECT id INTO v_root
  FROM public.drive_nodes
  WHERE project_id = p_project_id
    AND parent_id IS NULL
  ORDER BY created_at
  LIMIT 1;

  IF v_root IS NULL THEN
    INSERT INTO public.drive_nodes(project_id, parent_id, name, slug, node_type, is_locked, metadata)
    VALUES (
      p_project_id,
      NULL,
      v_code || '_' || v_name,
      'root',
      'FOLDER',
      true,
      jsonb_build_object('workspace_template', 'project-governed-v1')
    )
    RETURNING id INTO v_root;
  END IF;

  FOR v_folder IN
    SELECT * FROM (VALUES
      ('00 Governance and Document Control', '00-governance-document-control'),
      ('01 Project Management', '01-project-management'),
      ('02 Requirements and System Engineering', '02-requirements-system-engineering'),
      ('03 Hardware and R&D', '03-hardware-rnd'),
      ('04 Software and Firmware', '04-software-firmware'),
      ('05 Mechanical and Thermal', '05-mechanical-thermal'),
      ('06 Validation and Testing', '06-validation-testing'),
      ('07 Procurement, Stores and Incoming Quality', '07-procurement-stores-incoming-quality'),
      ('08 Production and Calibration', '08-production-calibration'),
      ('09 Operations, QMS and Client Handover', '09-operations-qms-client-handover'),
      ('10 After SOP and Archive', '10-after-sop-archive')
    ) AS template(name, slug)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.drive_nodes
      WHERE project_id = p_project_id
        AND parent_id = v_root
        AND slug = v_folder.slug
    ) THEN
      INSERT INTO public.drive_nodes(project_id, parent_id, name, slug, node_type, is_locked, metadata)
      VALUES (
        p_project_id,
        v_root,
        v_folder.name,
        v_folder.slug,
        'FOLDER',
        true,
        jsonb_build_object('workspace_template', 'project-governed-v1')
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_project_drive_template(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_project_drive_template(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.provision_project_drive_folders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.provision_project_drive_template(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_project_drive_folders() FROM PUBLIC, anon, authenticated;
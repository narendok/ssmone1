CREATE OR REPLACE FUNCTION public.ensure_phase5_project_access_catalog()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  INSERT INTO public.application_modules (key, name, group_key, route_path, icon_key, status, sort_order)
  SELECT 'projects', 'Projects', 'work', '/projects', 'folder-kanban', 'ENABLED', 50
  WHERE NOT EXISTS (SELECT 1 FROM public.application_modules WHERE key = 'projects');

  INSERT INTO public.permissions (key, module_key, label, description)
  SELECT v.key, v.module_key, v.label, v.description
  FROM (VALUES
    ('projects.view', 'projects', 'View projects', 'View project workspaces, delivery records and engineering registers.'),
    ('projects.manage', 'projects', 'Manage projects', 'Create and manage project master records, teams and controlled delivery records.')
  ) AS v(key, module_key, label, description)
  WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.key = v.key);

  SELECT id INTO v_role_id FROM public.access_roles WHERE name = 'Project Manager' LIMIT 1;
  IF v_role_id IS NULL THEN
    INSERT INTO public.access_roles (name, description, is_system)
    VALUES ('Project Manager', 'Standard role for project leads and managers', false)
    RETURNING id INTO v_role_id;
  END IF;

  INSERT INTO public.access_role_permissions (role_id, permission_id)
  SELECT v_role_id, p.id
  FROM public.permissions p
  WHERE p.key IN ('projects.view', 'projects.manage')
    AND NOT EXISTS (
      SELECT 1 FROM public.access_role_permissions arp
      WHERE arp.role_id = v_role_id AND arp.permission_id = p.id
    );
END;
$$;
SELECT public.ensure_phase5_project_access_catalog();
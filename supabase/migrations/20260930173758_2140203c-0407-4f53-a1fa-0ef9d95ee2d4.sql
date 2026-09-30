CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.employee_access_roles ear ON ear.employee_id = e.id
    JOIN public.access_roles ar ON ar.id = ear.role_id
    WHERE e.user_id = _user_id
      AND e.employment_status = 'ACTIVE'
      AND ar.name = 'Platform Owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_department_drive(_user_id uuid, _department_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_platform_owner(_user_id)
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

REVOKE EXECUTE ON FUNCTION public.is_platform_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(uuid) TO authenticated, service_role;
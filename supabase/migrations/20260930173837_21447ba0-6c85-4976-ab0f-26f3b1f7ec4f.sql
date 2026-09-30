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

REVOKE EXECUTE ON FUNCTION public.is_platform_owner(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(uuid) TO service_role;
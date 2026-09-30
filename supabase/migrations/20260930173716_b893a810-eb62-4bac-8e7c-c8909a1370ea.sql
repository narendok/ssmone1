REVOKE EXECUTE ON FUNCTION public.current_employee_department_ids(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_department_drive(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.provision_department_drive_template(uuid) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.provision_project_drive_template(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_department_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_department_drive(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provision_department_drive_template(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.provision_project_drive_template(uuid) TO service_role;
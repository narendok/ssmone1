REVOKE EXECUTE ON FUNCTION public.create_department_process_template(uuid,text,text,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_department_process_template_stage(uuid,uuid,text,text,text,integer,uuid,public.department_type,boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.clone_department_process_template(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_department_process_template(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.retire_department_process_template(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_project_lifecycle_draft(uuid,uuid,uuid) FROM authenticated;
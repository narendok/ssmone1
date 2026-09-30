CREATE OR REPLACE FUNCTION public.provision_department_project_drive_folders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.department_id IS NOT NULL AND (
    TG_OP = 'INSERT'
    OR OLD.department_id IS DISTINCT FROM NEW.department_id
    OR OLD.drive_project_class IS DISTINCT FROM NEW.drive_project_class
  ) THEN
    PERFORM public.provision_project_drive_template(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_department_project_drive_folders() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS provision_department_project_drive_folders_trigger ON public.projects;
CREATE TRIGGER provision_department_project_drive_folders_trigger
AFTER INSERT OR UPDATE OF department_id, drive_project_class ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.provision_department_project_drive_folders();
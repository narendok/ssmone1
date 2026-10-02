CREATE OR REPLACE FUNCTION public.lifecycle_stage_project_reassignment_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_linked boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.project_stage_dependencies d
      WHERE d.project_stage_record_id = OLD.id
         OR d.predecessor_stage_record_id = OLD.id
    ) OR OLD.predecessor_record_id IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM public.project_process_stage_records r
        WHERE r.project_id = OLD.project_id
          AND r.predecessor_record_id = OLD.id
      )
    INTO v_linked;

    IF v_linked THEN
      RAISE EXCEPTION 'A linked project stage record cannot be reassigned between projects';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lifecycle_stage_project_reassignment_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER lifecycle_stage_project_reassignment_guard_trigger
BEFORE UPDATE OF project_id ON public.project_process_stage_records
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_stage_project_reassignment_guard();
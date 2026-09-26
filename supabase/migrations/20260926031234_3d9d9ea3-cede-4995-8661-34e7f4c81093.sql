CREATE OR REPLACE FUNCTION public.next_project_bom_number(_project_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _number text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = _project_id
  ) THEN
    RAISE EXCEPTION 'Project not found or unavailable';
  END IF;

  _number := public.next_document_number('BOM');
  RETURN _number;
END;
$$;

REVOKE ALL ON FUNCTION public.next_project_bom_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_project_bom_number(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_public_application_status(_status_token text)
RETURNS TABLE (
  application_id uuid,
  role_title text,
  stage text,
  status text,
  submitted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    a.id AS application_id,
    p.title AS role_title,
    a.stage,
    a.status,
    a.submitted_at
  FROM public.hr_applications a
  JOIN public.hr_job_postings p ON p.id = a.posting_id
  WHERE a.public_status_token = _status_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_application_status(text) TO anon, authenticated, service_role;
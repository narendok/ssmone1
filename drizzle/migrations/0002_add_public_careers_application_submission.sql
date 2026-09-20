CREATE OR REPLACE FUNCTION public.submit_public_job_application(
  _posting_slug text,
  _full_name text,
  _email text,
  _phone text,
  _current_location text,
  _cover_letter text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _posting_id uuid;
  _candidate_id uuid;
  _application_id uuid;
  _status_token text;
BEGIN
  SELECT id INTO _posting_id
  FROM public.hr_job_postings
  WHERE slug = lower(trim(_posting_slug))
    AND is_published = true;

  IF _posting_id IS NULL THEN
    RAISE EXCEPTION 'This opening is not currently accepting applications.';
  END IF;

  INSERT INTO public.hr_candidates (
    full_name,
    email,
    phone,
    current_location,
    source,
    confirmed_profile
  ) VALUES (
    trim(_full_name),
    lower(trim(_email)),
    NULLIF(trim(_phone), ''),
    NULLIF(trim(_current_location), ''),
    'Website',
    jsonb_build_object('full_name', trim(_full_name), 'email', lower(trim(_email)), 'phone', NULLIF(trim(_phone), ''), 'current_location', NULLIF(trim(_current_location), ''))
  )
  ON CONFLICT ((lower(email))) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, public.hr_candidates.phone),
    current_location = COALESCE(EXCLUDED.current_location, public.hr_candidates.current_location),
    confirmed_profile = public.hr_candidates.confirmed_profile || EXCLUDED.confirmed_profile,
    updated_at = now()
  RETURNING id INTO _candidate_id;

  INSERT INTO public.hr_applications (
    candidate_id,
    posting_id,
    submitted_via,
    cover_letter
  ) VALUES (
    _candidate_id,
    _posting_id,
    'PUBLIC',
    NULLIF(trim(_cover_letter), '')
  )
  ON CONFLICT (candidate_id, posting_id) DO NOTHING
  RETURNING id, public_status_token INTO _application_id, _status_token;

  IF _application_id IS NULL THEN
    RAISE EXCEPTION 'An application for this opening already exists for this email address.' USING ERRCODE = '23505';
  END IF;

  RETURN jsonb_build_object(
    'application_id', _application_id,
    'status_token', _status_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_job_application(text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_job_application(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_job_application(text, text, text, text, text, text) TO service_role;
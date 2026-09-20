CREATE OR REPLACE FUNCTION public.submit_public_job_application(
  _posting_slug text,
  _full_name text,
  _email text,
  _phone text,
  _current_location text,
  _cover_letter text,
  _resume_filename text DEFAULT NULL,
  _resume_mime_type text DEFAULT NULL,
  _resume_storage_path text DEFAULT NULL,
  _resume_file_size bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  IF _resume_storage_path IS NOT NULL AND (
    _resume_filename IS NULL
    OR _resume_mime_type NOT IN ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    OR _resume_file_size IS NULL
    OR _resume_file_size < 1
    OR _resume_file_size > 10485760
    OR _resume_storage_path !~ '^public-applications/[0-9a-f-]+/[a-z0-9-]+\.(pdf|doc|docx)$'
  ) THEN
    RAISE EXCEPTION 'The resume attachment is not valid.';
  END IF;

  INSERT INTO public.hr_candidates (
    full_name,
    email,
    phone,
    current_location,
    source,
    resume_filename,
    resume_mime_type,
    resume_storage_path,
    resume_file_size,
    confirmed_profile
  ) VALUES (
    trim(_full_name),
    lower(trim(_email)),
    NULLIF(trim(_phone), ''),
    NULLIF(trim(_current_location), ''),
    'Website',
    NULLIF(trim(_resume_filename), ''),
    NULLIF(trim(_resume_mime_type), ''),
    NULLIF(trim(_resume_storage_path), ''),
    _resume_file_size,
    jsonb_build_object('full_name', trim(_full_name), 'email', lower(trim(_email)), 'phone', NULLIF(trim(_phone), ''), 'current_location', NULLIF(trim(_current_location), ''))
  )
  ON CONFLICT ((lower(email))) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, public.hr_candidates.phone),
    current_location = COALESCE(EXCLUDED.current_location, public.hr_candidates.current_location),
    resume_filename = COALESCE(EXCLUDED.resume_filename, public.hr_candidates.resume_filename),
    resume_mime_type = COALESCE(EXCLUDED.resume_mime_type, public.hr_candidates.resume_mime_type),
    resume_storage_path = COALESCE(EXCLUDED.resume_storage_path, public.hr_candidates.resume_storage_path),
    resume_file_size = COALESCE(EXCLUDED.resume_file_size, public.hr_candidates.resume_file_size),
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

CREATE POLICY "Public applicants may upload resumes"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'project-drive'
  AND name ~ '^public-applications/[0-9a-f-]+/[a-z0-9-]+\.(pdf|doc|docx)$'
  AND octet_length(name) <= 280
  AND (storage.extension(name) = ANY (ARRAY['pdf', 'doc', 'docx']))
);
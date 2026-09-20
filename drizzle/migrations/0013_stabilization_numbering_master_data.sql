ALTER TABLE public.document_numbering_config
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS include_year boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_department boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_project boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS separator text NOT NULL DEFAULT '-',
  ADD COLUMN IF NOT EXISTS starting_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reset_policy text NOT NULL DEFAULT 'yearly',
  ADD COLUMN IF NOT EXISTS current_sequence integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS document_numbering_config_entity_type_unique_idx
  ON public.document_numbering_config (entity_type)
  WHERE entity_type IS NOT NULL;

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.hr_job_requisitions
  ADD COLUMN IF NOT EXISTS requisition_code text;
ALTER TABLE public.hr_job_postings
  ADD COLUMN IF NOT EXISTS job_code text;
ALTER TABLE public.hr_candidates
  ADD COLUMN IF NOT EXISTS candidate_code text;

CREATE UNIQUE INDEX IF NOT EXISTS hr_job_requisitions_requisition_code_unique_idx ON public.hr_job_requisitions (requisition_code) WHERE requisition_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hr_job_postings_job_code_unique_idx ON public.hr_job_postings (job_code) WHERE job_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hr_candidates_candidate_code_unique_idx ON public.hr_candidates (candidate_code) WHERE candidate_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS departments_name_normalized_unique_idx ON public.departments (lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS departments_code_normalized_unique_idx ON public.departments (upper(btrim(code))) WHERE code IS NOT NULL;

CREATE TABLE public.hr_job_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  designation text,
  job_description text,
  responsibilities text,
  required_skills text,
  preferred_skills text,
  education text,
  experience text,
  assessment_template text,
  interview_template text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_job_profiles TO authenticated;
GRANT ALL ON public.hr_job_profiles TO service_role;
ALTER TABLE public.hr_job_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters view job profiles" ON public.hr_job_profiles FOR SELECT TO authenticated USING (public.can_manage_recruitment(auth.uid()));
CREATE POLICY "Recruiters manage job profiles" ON public.hr_job_profiles FOR ALL TO authenticated USING (public.can_manage_recruitment(auth.uid())) WITH CHECK (public.can_manage_recruitment(auth.uid()));
CREATE UNIQUE INDEX hr_job_profiles_name_department_unique_idx ON public.hr_job_profiles (lower(btrim(profile_name)), COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE TRIGGER hr_job_profiles_touch_ssm BEFORE UPDATE ON public.hr_job_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

ALTER TABLE public.hr_job_requisitions ADD COLUMN IF NOT EXISTS job_profile_id uuid REFERENCES public.hr_job_profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.next_business_number(
  _entity_type text,
  _department_code text DEFAULT NULL,
  _project_code text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule record;
  next_sequence integer;
  sequence_part text;
  parts text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO rule
  FROM public.document_numbering_config
  WHERE entity_type = _entity_type AND is_active
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.document_numbering_config (key, label, prefix_template, serial_padding, is_active, entity_type, include_year, include_department, include_project, separator, starting_number, reset_policy, current_sequence)
    VALUES (
      lower(_entity_type), initcap(replace(_entity_type, '_', ' ')), upper(regexp_replace(_entity_type, '_.*$', '')), 4, true, _entity_type, true, false, false, '-', 1, 'yearly', 0
    )
    RETURNING * INTO rule;
  END IF;

  UPDATE public.document_numbering_config
  SET current_sequence = CASE
    WHEN reset_policy = 'yearly' AND COALESCE(metadata->>'sequence_year', '') <> to_char(current_date, 'YYYY') THEN starting_number
    ELSE GREATEST(current_sequence + 1, starting_number)
  END,
  metadata = jsonb_set(metadata, '{sequence_year}', to_jsonb(to_char(current_date, 'YYYY')), true)
  WHERE id = rule.id
  RETURNING current_sequence INTO next_sequence;

  parts := array_append(parts, NULLIF(btrim(rule.prefix_template), ''));
  IF rule.include_department AND NULLIF(btrim(_department_code), '') IS NOT NULL THEN parts := array_append(parts, upper(btrim(_department_code))); END IF;
  IF rule.include_project AND NULLIF(btrim(_project_code), '') IS NOT NULL THEN parts := array_append(parts, upper(btrim(_project_code))); END IF;
  IF rule.include_year THEN parts := array_append(parts, to_char(current_date, 'YYYY')); END IF;
  sequence_part := lpad(next_sequence::text, GREATEST(rule.serial_padding, 1), '0');
  parts := array_append(parts, sequence_part);
  RETURN array_to_string(array_remove(parts, NULL), rule.separator);
END;
$$;
GRANT EXECUTE ON FUNCTION public.next_business_number(text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assign_stabilization_codes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  department_code text;
BEGIN
  IF TG_TABLE_NAME = 'customers' AND (NEW.customer_code IS NULL OR btrim(NEW.customer_code) = '') THEN
    NEW.customer_code := public.next_business_number('customer', NULL, NULL);
  ELSIF TG_TABLE_NAME = 'projects' AND (NEW.code IS NULL OR btrim(NEW.code) = '') THEN
    NEW.code := public.next_business_number('project', NULL, NULL);
  ELSIF TG_TABLE_NAME = 'employees' AND (NEW.employee_code IS NULL OR btrim(NEW.employee_code) = '') THEN
    SELECT code INTO department_code FROM public.departments WHERE id = NEW.primary_department_id;
    NEW.employee_code := public.next_business_number('employee', department_code, NULL);
  ELSIF TG_TABLE_NAME = 'hr_job_requisitions' AND (NEW.requisition_code IS NULL OR btrim(NEW.requisition_code) = '') THEN
    SELECT code INTO department_code FROM public.departments WHERE id = NEW.department_id;
    NEW.requisition_code := public.next_business_number('job_opening', department_code, NULL);
  ELSIF TG_TABLE_NAME = 'hr_job_postings' AND (NEW.job_code IS NULL OR btrim(NEW.job_code) = '') THEN
    SELECT code INTO department_code FROM public.departments WHERE id = NEW.department_id;
    NEW.job_code := public.next_business_number('job_opening', department_code, NULL);
  ELSIF TG_TABLE_NAME = 'hr_candidates' AND (NEW.candidate_code IS NULL OR btrim(NEW.candidate_code) = '') THEN
    NEW.candidate_code := public.next_business_number('candidate', NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_assign_business_code BEFORE INSERT ON public.customers FOR EACH ROW EXECUTE FUNCTION public.assign_stabilization_codes();
CREATE TRIGGER projects_assign_business_code BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.assign_stabilization_codes();
CREATE TRIGGER employees_assign_business_code BEFORE INSERT ON public.employees FOR EACH ROW EXECUTE FUNCTION public.assign_stabilization_codes();
CREATE TRIGGER hr_job_requisitions_assign_business_code BEFORE INSERT ON public.hr_job_requisitions FOR EACH ROW EXECUTE FUNCTION public.assign_stabilization_codes();
CREATE TRIGGER hr_job_postings_assign_business_code BEFORE INSERT ON public.hr_job_postings FOR EACH ROW EXECUTE FUNCTION public.assign_stabilization_codes();
CREATE TRIGGER hr_candidates_assign_business_code BEFORE INSERT ON public.hr_candidates FOR EACH ROW EXECUTE FUNCTION public.assign_stabilization_codes();
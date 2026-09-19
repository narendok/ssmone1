CREATE OR REPLACE FUNCTION public.is_employee_manager(_employee_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = _employee_id
      AND e.reporting_manager_user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_recruitment(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_uid, 'admin')
    OR public.has_permission(_uid, 'recruitment.manage')
$$;

CREATE OR REPLACE FUNCTION public.can_manage_leave(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_uid, 'admin')
    OR public.has_permission(_uid, 'leave.manage')
    OR public.has_permission(_uid, 'leave.approve')
$$;

CREATE OR REPLACE FUNCTION public.can_manage_training(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_uid, 'admin')
    OR public.has_permission(_uid, 'training.manage')
$$;

CREATE TABLE public.hr_job_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  hiring_manager_user_id uuid,
  employment_type text NOT NULL DEFAULT 'Full-time',
  work_mode text NOT NULL DEFAULT 'On-site',
  location text,
  headcount integer NOT NULL DEFAULT 1,
  justification text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','open','on_hold','closed')),
  target_start_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid REFERENCES public.hr_job_requisitions(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  description text NOT NULL,
  location text,
  employment_type text NOT NULL DEFAULT 'Full-time',
  work_mode text NOT NULL DEFAULT 'On-site',
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  current_location text,
  source text NOT NULL DEFAULT 'Website',
  resume_filename text,
  resume_mime_type text,
  resume_storage_path text,
  resume_file_size bigint,
  parsed_resume jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hr_candidates_email_lower_idx ON public.hr_candidates (lower(email));

CREATE TABLE public.hr_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.hr_candidates(id) ON DELETE CASCADE,
  posting_id uuid NOT NULL REFERENCES public.hr_job_postings(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'applied' CHECK (stage IN ('applied','screening','assessment','interview','offer','hired','rejected','withdrawn')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_hold','hired','rejected','withdrawn')),
  submitted_via text NOT NULL DEFAULT 'PUBLIC' CHECK (submitted_via IN ('PUBLIC','INTERNAL')),
  cover_letter text,
  public_status_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex') UNIQUE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(candidate_id, posting_id)
);

CREATE TABLE public.hr_interview_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.hr_applications(id) ON DELETE CASCADE,
  title text NOT NULL,
  interviewer_user_id uuid NOT NULL,
  scheduled_for timestamptz,
  meeting_notes text,
  scorecard jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_interview_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.hr_interview_rounds(id) ON DELETE CASCADE,
  interviewer_user_id uuid NOT NULL,
  rating numeric(4,2),
  recommendation text,
  strengths text,
  concerns text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES public.hr_applications(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','sent','accepted','declined','withdrawn')),
  compensation jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  approved_by uuid,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  annual_quota numeric(6,2) NOT NULL DEFAULT 0,
  color text,
  requires_approval boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.hr_leave_types(id) ON DELETE CASCADE,
  year smallint NOT NULL,
  balance numeric(6,2) NOT NULL DEFAULT 0,
  consumed numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE public.hr_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.hr_leave_types(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days numeric(6,2) NOT NULL DEFAULT 1,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft','pending','approved','rejected','cancelled')),
  approver_user_id uuid,
  approver_note text,
  acted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_training_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  delivery_mode text NOT NULL DEFAULT 'self_paced',
  is_mandatory boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_training_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.hr_training_programs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','completed','overdue')),
  due_date date,
  completed_at timestamptz,
  score numeric(6,2),
  certificate_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, program_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_job_requisitions TO authenticated;
GRANT ALL ON public.hr_job_requisitions TO service_role;
ALTER TABLE public.hr_job_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters view requisitions" ON public.hr_job_requisitions FOR SELECT TO authenticated USING (public.can_manage_recruitment(auth.uid()) OR hiring_manager_user_id = auth.uid());
CREATE POLICY "Recruiters manage requisitions" ON public.hr_job_requisitions FOR ALL TO authenticated USING (public.can_manage_recruitment(auth.uid()) OR hiring_manager_user_id = auth.uid()) WITH CHECK (public.can_manage_recruitment(auth.uid()) OR hiring_manager_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_job_postings TO authenticated;
GRANT ALL ON public.hr_job_postings TO service_role;
GRANT SELECT ON public.hr_job_postings TO anon;
ALTER TABLE public.hr_job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view published jobs" ON public.hr_job_postings FOR SELECT TO anon USING (is_published);
CREATE POLICY "Authenticated can view published jobs" ON public.hr_job_postings FOR SELECT TO authenticated USING (is_published OR public.can_manage_recruitment(auth.uid()) OR EXISTS (SELECT 1 FROM public.hr_job_requisitions req WHERE req.id = requisition_id AND req.hiring_manager_user_id = auth.uid()));
CREATE POLICY "Recruiters manage job postings" ON public.hr_job_postings FOR ALL TO authenticated USING (public.can_manage_recruitment(auth.uid()) OR EXISTS (SELECT 1 FROM public.hr_job_requisitions req WHERE req.id = requisition_id AND req.hiring_manager_user_id = auth.uid())) WITH CHECK (public.can_manage_recruitment(auth.uid()) OR EXISTS (SELECT 1 FROM public.hr_job_requisitions req WHERE req.id = requisition_id AND req.hiring_manager_user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_candidates TO authenticated;
GRANT ALL ON public.hr_candidates TO service_role;
ALTER TABLE public.hr_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters view candidates" ON public.hr_candidates FOR SELECT TO authenticated USING (public.can_manage_recruitment(auth.uid()));
CREATE POLICY "Recruiters manage candidates" ON public.hr_candidates FOR ALL TO authenticated USING (public.can_manage_recruitment(auth.uid())) WITH CHECK (public.can_manage_recruitment(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_applications TO authenticated;
GRANT ALL ON public.hr_applications TO service_role;
ALTER TABLE public.hr_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters and interviewers view applications" ON public.hr_applications FOR SELECT TO authenticated USING (public.can_manage_recruitment(auth.uid()) OR EXISTS (SELECT 1 FROM public.hr_job_postings post JOIN public.hr_job_requisitions req ON req.id = post.requisition_id WHERE post.id = posting_id AND req.hiring_manager_user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.hr_interview_rounds round WHERE round.application_id = id AND round.interviewer_user_id = auth.uid()));
CREATE POLICY "Recruiters manage applications" ON public.hr_applications FOR ALL TO authenticated USING (public.can_manage_recruitment(auth.uid()) OR EXISTS (SELECT 1 FROM public.hr_job_postings post JOIN public.hr_job_requisitions req ON req.id = post.requisition_id WHERE post.id = posting_id AND req.hiring_manager_user_id = auth.uid())) WITH CHECK (public.can_manage_recruitment(auth.uid()) OR EXISTS (SELECT 1 FROM public.hr_job_postings post JOIN public.hr_job_requisitions req ON req.id = post.requisition_id WHERE post.id = posting_id AND req.hiring_manager_user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_interview_rounds TO authenticated;
GRANT ALL ON public.hr_interview_rounds TO service_role;
ALTER TABLE public.hr_interview_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters and interviewers view interview rounds" ON public.hr_interview_rounds FOR SELECT TO authenticated USING (public.can_manage_recruitment(auth.uid()) OR interviewer_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.hr_applications app JOIN public.hr_job_postings post ON post.id = app.posting_id JOIN public.hr_job_requisitions req ON req.id = post.requisition_id WHERE app.id = application_id AND req.hiring_manager_user_id = auth.uid()));
CREATE POLICY "Recruiters manage interview rounds" ON public.hr_interview_rounds FOR ALL TO authenticated USING (public.can_manage_recruitment(auth.uid()) OR EXISTS (SELECT 1 FROM public.hr_applications app JOIN public.hr_job_postings post ON post.id = app.posting_id JOIN public.hr_job_requisitions req ON req.id = post.requisition_id WHERE app.id = application_id AND req.hiring_manager_user_id = auth.uid())) WITH CHECK (public.can_manage_recruitment(auth.uid()) OR EXISTS (SELECT 1 FROM public.hr_applications app JOIN public.hr_job_postings post ON post.id = app.posting_id JOIN public.hr_job_requisitions req ON req.id = post.requisition_id WHERE app.id = application_id AND req.hiring_manager_user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_interview_feedback TO authenticated;
GRANT ALL ON public.hr_interview_feedback TO service_role;
ALTER TABLE public.hr_interview_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters and assigned interviewers view interview feedback" ON public.hr_interview_feedback FOR SELECT TO authenticated USING (public.can_manage_recruitment(auth.uid()) OR interviewer_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.hr_interview_rounds round JOIN public.hr_applications app ON app.id = round.application_id JOIN public.hr_job_postings post ON post.id = app.posting_id JOIN public.hr_job_requisitions req ON req.id = post.requisition_id WHERE round.id = round_id AND req.hiring_manager_user_id = auth.uid()));
CREATE POLICY "Interviewers create their own feedback" ON public.hr_interview_feedback FOR INSERT TO authenticated WITH CHECK (public.can_manage_recruitment(auth.uid()) OR interviewer_user_id = auth.uid());
CREATE POLICY "Recruiters update interview feedback" ON public.hr_interview_feedback FOR UPDATE TO authenticated USING (public.can_manage_recruitment(auth.uid()) OR interviewer_user_id = auth.uid()) WITH CHECK (public.can_manage_recruitment(auth.uid()) OR interviewer_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_offers TO authenticated;
GRANT ALL ON public.hr_offers TO service_role;
ALTER TABLE public.hr_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters and hiring managers view offers" ON public.hr_offers FOR SELECT TO authenticated USING (public.can_manage_recruitment(auth.uid()) OR EXISTS (SELECT 1 FROM public.hr_applications app JOIN public.hr_job_postings post ON post.id = app.posting_id JOIN public.hr_job_requisitions req ON req.id = post.requisition_id WHERE app.id = application_id AND req.hiring_manager_user_id = auth.uid()));
CREATE POLICY "Recruiters manage offers" ON public.hr_offers FOR ALL TO authenticated USING (public.can_manage_recruitment(auth.uid())) WITH CHECK (public.can_manage_recruitment(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_leave_types TO authenticated;
GRANT ALL ON public.hr_leave_types TO service_role;
ALTER TABLE public.hr_leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view leave types" ON public.hr_leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR manage leave types" ON public.hr_leave_types FOR ALL TO authenticated USING (public.can_manage_leave(auth.uid())) WITH CHECK (public.can_manage_leave(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_leave_balances TO authenticated;
GRANT ALL ON public.hr_leave_balances TO service_role;
ALTER TABLE public.hr_leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees and managers view leave balances" ON public.hr_leave_balances FOR SELECT TO authenticated USING (public.can_manage_leave(auth.uid()) OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()) OR public.is_employee_manager(employee_id, auth.uid()));
CREATE POLICY "HR manage leave balances" ON public.hr_leave_balances FOR ALL TO authenticated USING (public.can_manage_leave(auth.uid())) WITH CHECK (public.can_manage_leave(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_leave_requests TO authenticated;
GRANT ALL ON public.hr_leave_requests TO service_role;
ALTER TABLE public.hr_leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees and managers view leave requests" ON public.hr_leave_requests FOR SELECT TO authenticated USING (public.can_manage_leave(auth.uid()) OR approver_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()) OR public.is_employee_manager(employee_id, auth.uid()));
CREATE POLICY "Employees create own leave requests" ON public.hr_leave_requests FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Employees and approvers update leave requests" ON public.hr_leave_requests FOR UPDATE TO authenticated USING (public.can_manage_leave(auth.uid()) OR approver_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid())) WITH CHECK (public.can_manage_leave(auth.uid()) OR approver_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_training_programs TO authenticated;
GRANT ALL ON public.hr_training_programs TO service_role;
ALTER TABLE public.hr_training_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view training programs" ON public.hr_training_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR manage training programs" ON public.hr_training_programs FOR ALL TO authenticated USING (public.can_manage_training(auth.uid())) WITH CHECK (public.can_manage_training(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_training_enrollments TO authenticated;
GRANT ALL ON public.hr_training_enrollments TO service_role;
ALTER TABLE public.hr_training_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees and managers view training enrollments" ON public.hr_training_enrollments FOR SELECT TO authenticated USING (public.can_manage_training(auth.uid()) OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()) OR public.is_employee_manager(employee_id, auth.uid()));
CREATE POLICY "HR manage training enrollments" ON public.hr_training_enrollments FOR ALL TO authenticated USING (public.can_manage_training(auth.uid())) WITH CHECK (public.can_manage_training(auth.uid()));

CREATE TRIGGER hr_job_requisitions_touch_ssm BEFORE UPDATE ON public.hr_job_requisitions FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE TRIGGER hr_job_postings_touch_ssm BEFORE UPDATE ON public.hr_job_postings FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE TRIGGER hr_candidates_touch_ssm BEFORE UPDATE ON public.hr_candidates FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE TRIGGER hr_applications_touch_ssm BEFORE UPDATE ON public.hr_applications FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE TRIGGER hr_interview_rounds_touch_ssm BEFORE UPDATE ON public.hr_interview_rounds FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE TRIGGER hr_offers_touch_ssm BEFORE UPDATE ON public.hr_offers FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE TRIGGER hr_leave_types_touch_ssm BEFORE UPDATE ON public.hr_leave_types FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE TRIGGER hr_leave_balances_touch_ssm BEFORE UPDATE ON public.hr_leave_balances FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE TRIGGER hr_leave_requests_touch_ssm BEFORE UPDATE ON public.hr_leave_requests FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE TRIGGER hr_training_programs_touch_ssm BEFORE UPDATE ON public.hr_training_programs FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE TRIGGER hr_training_enrollments_touch_ssm BEFORE UPDATE ON public.hr_training_enrollments FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
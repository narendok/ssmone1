CREATE TABLE public.project_stage_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  gate_code text NOT NULL,
  title text NOT NULL,
  gate_type text NOT NULL DEFAULT 'ENGINEERING_GATE',
  status text NOT NULL DEFAULT 'NOT_STARTED',
  target_date date,
  completed_at timestamptz,
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  evidence_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, gate_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_stage_gates TO authenticated;
GRANT ALL ON public.project_stage_gates TO service_role;
ALTER TABLE public.project_stage_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project team view stage gates" ON public.project_stage_gates FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.view') OR EXISTS (
    SELECT 1 FROM public.project_team_members membership JOIN public.employees member_employee ON member_employee.id = membership.employee_id
    WHERE membership.project_id = project_stage_gates.project_id AND member_employee.user_id = auth.uid()
  )
);
CREATE POLICY "Project managers manage stage gates" ON public.project_stage_gates FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
);

CREATE TABLE public.project_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  issue_code text NOT NULL,
  title text NOT NULL,
  description text,
  issue_type text NOT NULL DEFAULT 'ENGINEERING',
  severity text NOT NULL DEFAULT 'MEDIUM',
  status text NOT NULL DEFAULT 'OPEN',
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  due_date date,
  resolution text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, issue_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_issues TO authenticated;
GRANT ALL ON public.project_issues TO service_role;
ALTER TABLE public.project_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project team view issues" ON public.project_issues FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.view') OR EXISTS (
    SELECT 1 FROM public.project_team_members membership JOIN public.employees member_employee ON member_employee.id = membership.employee_id
    WHERE membership.project_id = project_issues.project_id AND member_employee.user_id = auth.uid()
  )
);
CREATE POLICY "Project managers manage issues" ON public.project_issues FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
);

CREATE TABLE public.project_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  change_code text NOT NULL,
  title text NOT NULL,
  description text,
  change_type text NOT NULL DEFAULT 'ECR',
  status text NOT NULL DEFAULT 'DRAFT',
  impact_summary text,
  requested_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_at timestamptz,
  implemented_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, change_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_change_requests TO authenticated;
GRANT ALL ON public.project_change_requests TO service_role;
ALTER TABLE public.project_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project team view change requests" ON public.project_change_requests FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.view') OR EXISTS (
    SELECT 1 FROM public.project_team_members membership JOIN public.employees member_employee ON member_employee.id = membership.employee_id
    WHERE membership.project_id = project_change_requests.project_id AND member_employee.user_id = auth.uid()
  )
);
CREATE POLICY "Project managers manage change requests" ON public.project_change_requests FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
);

CREATE INDEX project_stage_gates_project_id_idx ON public.project_stage_gates(project_id);
CREATE INDEX project_issues_project_id_idx ON public.project_issues(project_id);
CREATE INDEX project_change_requests_project_id_idx ON public.project_change_requests(project_id);
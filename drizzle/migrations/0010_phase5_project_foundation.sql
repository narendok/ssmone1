ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type text NOT NULL DEFAULT 'CUSTOM_PROJECT',
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.sales_opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requirement_baseline_id uuid REFERENCES public.requirement_baselines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS engineering_lead_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_stage text NOT NULL DEFAULT 'INITIATION',
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'GREEN',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS planned_start_date date,
  ADD COLUMN IF NOT EXISTS target_sop_date date,
  ADD COLUMN IF NOT EXISTS prototype_quantity integer,
  ADD COLUMN IF NOT EXISTS annual_volume numeric,
  ADD COLUMN IF NOT EXISTS project_drive_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS projects_customer_id_idx ON public.projects(customer_id);
CREATE INDEX IF NOT EXISTS projects_opportunity_id_idx ON public.projects(opportunity_id);
CREATE INDEX IF NOT EXISTS projects_requirement_baseline_id_idx ON public.projects(requirement_baseline_id);

CREATE TABLE public.project_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_role text NOT NULL,
  discipline text,
  access_level text NOT NULL DEFAULT 'CONTRIBUTOR',
  is_lead boolean NOT NULL DEFAULT false,
  added_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_team_members TO authenticated;
GRANT ALL ON public.project_team_members TO service_role;
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members view their project team" ON public.project_team_members FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage') OR EXISTS (
    SELECT 1 FROM public.employees viewer WHERE viewer.user_id = auth.uid() AND viewer.id = project_team_members.employee_id
  ) OR EXISTS (
    SELECT 1 FROM public.project_team_members membership JOIN public.employees member_employee ON member_employee.id = membership.employee_id
    WHERE membership.project_id = project_team_members.project_id AND member_employee.user_id = auth.uid()
  )
);
CREATE POLICY "Project managers manage project team" ON public.project_team_members FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
);

CREATE TABLE public.project_design_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_requirement_id uuid REFERENCES public.customer_requirements(id) ON DELETE SET NULL,
  input_code text NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'GENERAL',
  priority text NOT NULL DEFAULT 'MEDIUM',
  verification_method text,
  acceptance_criteria text,
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'OPEN',
  source_revision_id uuid REFERENCES public.customer_requirement_revisions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, input_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_design_inputs TO authenticated;
GRANT ALL ON public.project_design_inputs TO service_role;
ALTER TABLE public.project_design_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project team view design inputs" ON public.project_design_inputs FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.view') OR EXISTS (
    SELECT 1 FROM public.project_team_members membership JOIN public.employees member_employee ON member_employee.id = membership.employee_id
    WHERE membership.project_id = project_design_inputs.project_id AND member_employee.user_id = auth.uid()
  )
);
CREATE POLICY "Project managers manage design inputs" ON public.project_design_inputs FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
);

CREATE TABLE public.project_research_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  research_type text NOT NULL DEFAULT 'TECHNICAL',
  summary text,
  conclusion text,
  recommendation text,
  component_id uuid REFERENCES public.components(id) ON DELETE SET NULL,
  drive_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE SET NULL,
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  decision_status text NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_research_records TO authenticated;
GRANT ALL ON public.project_research_records TO service_role;
ALTER TABLE public.project_research_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project team view research records" ON public.project_research_records FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.view') OR EXISTS (
    SELECT 1 FROM public.project_team_members membership JOIN public.employees member_employee ON member_employee.id = membership.employee_id
    WHERE membership.project_id = project_research_records.project_id AND member_employee.user_id = auth.uid()
  )
);
CREATE POLICY "Project managers manage research records" ON public.project_research_records FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
);

CREATE TABLE public.project_engineering_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  register_type text NOT NULL,
  reference_code text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  revision text,
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  drive_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, register_type, reference_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_engineering_registers TO authenticated;
GRANT ALL ON public.project_engineering_registers TO service_role;
ALTER TABLE public.project_engineering_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project team view engineering registers" ON public.project_engineering_registers FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.view') OR EXISTS (
    SELECT 1 FROM public.project_team_members membership JOIN public.employees member_employee ON member_employee.id = membership.employee_id
    WHERE membership.project_id = project_engineering_registers.project_id AND member_employee.user_id = auth.uid()
  )
);
CREATE POLICY "Project managers manage engineering registers" ON public.project_engineering_registers FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'projects.manage')
);
CREATE INDEX project_team_members_project_id_idx ON public.project_team_members(project_id);
CREATE INDEX project_team_members_employee_id_idx ON public.project_team_members(employee_id);
CREATE INDEX project_design_inputs_project_id_idx ON public.project_design_inputs(project_id);
CREATE INDEX project_research_records_project_id_idx ON public.project_research_records(project_id);
CREATE INDEX project_engineering_registers_project_id_idx ON public.project_engineering_registers(project_id);
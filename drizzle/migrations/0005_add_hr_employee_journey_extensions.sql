CREATE OR REPLACE FUNCTION public.can_manage_onboarding(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin') OR public.has_permission(_uid, 'training.manage')
$$;

CREATE TABLE public.hr_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.hr_applications(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','submitted','reviewed','expired','cancelled')),
  score numeric(6,2),
  reviewer_notes text,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_assessments TO authenticated;
GRANT ALL ON public.hr_assessments TO service_role;
ALTER TABLE public.hr_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage assessments" ON public.hr_assessments FOR ALL TO authenticated USING (public.can_manage_recruitment(auth.uid())) WITH CHECK (public.can_manage_recruitment(auth.uid()));
CREATE TRIGGER hr_assessments_touch_ssm BEFORE UPDATE ON public.hr_assessments FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.hr_onboarding_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_onboarding_plans TO authenticated;
GRANT ALL ON public.hr_onboarding_plans TO service_role;
ALTER TABLE public.hr_onboarding_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view onboarding plans" ON public.hr_onboarding_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR manages onboarding plans" ON public.hr_onboarding_plans FOR ALL TO authenticated USING (public.can_manage_onboarding(auth.uid())) WITH CHECK (public.can_manage_onboarding(auth.uid()));
CREATE TRIGGER hr_onboarding_plans_touch_ssm BEFORE UPDATE ON public.hr_onboarding_plans FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.hr_onboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.hr_onboarding_plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  owner_kind text NOT NULL DEFAULT 'employee' CHECK (owner_kind IN ('employee','manager','hr','it')),
  due_offset_days integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_onboarding_items TO authenticated;
GRANT ALL ON public.hr_onboarding_items TO service_role;
ALTER TABLE public.hr_onboarding_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view onboarding items" ON public.hr_onboarding_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR manages onboarding items" ON public.hr_onboarding_items FOR ALL TO authenticated USING (public.can_manage_onboarding(auth.uid())) WITH CHECK (public.can_manage_onboarding(auth.uid()));
CREATE TRIGGER hr_onboarding_items_touch_ssm BEFORE UPDATE ON public.hr_onboarding_items FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.hr_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_code text NOT NULL,
  title text NOT NULL,
  summary text,
  version text NOT NULL DEFAULT '1.0',
  document_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(policy_code, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_policies TO authenticated;
GRANT ALL ON public.hr_policies TO service_role;
ALTER TABLE public.hr_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view active policies" ON public.hr_policies FOR SELECT TO authenticated USING (is_active = true OR public.can_manage_training(auth.uid()));
CREATE POLICY "HR manages policies" ON public.hr_policies FOR ALL TO authenticated USING (public.can_manage_training(auth.uid())) WITH CHECK (public.can_manage_training(auth.uid()));
CREATE TRIGGER hr_policies_touch_ssm BEFORE UPDATE ON public.hr_policies FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.hr_policy_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.hr_policies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(policy_id, employee_id)
);
GRANT SELECT, INSERT, DELETE ON public.hr_policy_acknowledgements TO authenticated;
GRANT ALL ON public.hr_policy_acknowledgements TO service_role;
ALTER TABLE public.hr_policy_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees and managers view policy acknowledgements" ON public.hr_policy_acknowledgements FOR SELECT TO authenticated USING (public.can_manage_training(auth.uid()) OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()) OR public.is_employee_manager(employee_id, auth.uid()));
CREATE POLICY "Employees acknowledge own policies" ON public.hr_policy_acknowledgements FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE POLICY "HR removes policy acknowledgements" ON public.hr_policy_acknowledgements FOR DELETE TO authenticated USING (public.can_manage_training(auth.uid()));
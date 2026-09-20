CREATE TABLE public.hr_employee_onboardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid UNIQUE REFERENCES public.hr_applications(id) ON DELETE SET NULL,
  employee_id uuid UNIQUE NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.hr_onboarding_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  welcome_kit_status text NOT NULL DEFAULT 'not_required' CHECK (welcome_kit_status IN ('not_required','pending','prepared','issued')),
  welcome_kit_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employee_onboardings TO authenticated;
GRANT ALL ON public.hr_employee_onboardings TO service_role;
ALTER TABLE public.hr_employee_onboardings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees and managers view employee onboarding" ON public.hr_employee_onboardings FOR SELECT TO authenticated USING (
  public.can_manage_onboarding(auth.uid())
  OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
  OR public.is_employee_manager(employee_id, auth.uid())
);
CREATE POLICY "HR manages employee onboarding" ON public.hr_employee_onboardings FOR ALL TO authenticated USING (public.can_manage_onboarding(auth.uid())) WITH CHECK (public.can_manage_onboarding(auth.uid()));
CREATE TRIGGER hr_employee_onboardings_touch_ssm BEFORE UPDATE ON public.hr_employee_onboardings FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.hr_employee_onboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES public.hr_employee_onboardings(id) ON DELETE CASCADE,
  source_item_id uuid REFERENCES public.hr_onboarding_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  owner_kind text NOT NULL DEFAULT 'employee' CHECK (owner_kind IN ('employee','manager','hr','it')),
  owner_user_id uuid,
  due_date date,
  is_required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped')),
  completed_at timestamptz,
  completed_by_user_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employee_onboarding_items TO authenticated;
GRANT ALL ON public.hr_employee_onboarding_items TO service_role;
ALTER TABLE public.hr_employee_onboarding_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees and owners view employee onboarding items" ON public.hr_employee_onboarding_items FOR SELECT TO authenticated USING (
  owner_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.hr_employee_onboardings onboarding JOIN public.employees e ON e.id = onboarding.employee_id WHERE onboarding.id = onboarding_id AND e.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.hr_employee_onboardings onboarding WHERE onboarding.id = onboarding_id AND public.is_employee_manager(onboarding.employee_id, auth.uid()))
  OR public.can_manage_onboarding(auth.uid())
);
CREATE POLICY "Owners update assigned onboarding items" ON public.hr_employee_onboarding_items FOR UPDATE TO authenticated USING (
  owner_user_id = auth.uid() OR public.can_manage_onboarding(auth.uid())
) WITH CHECK (
  owner_user_id = auth.uid() OR public.can_manage_onboarding(auth.uid())
);
CREATE POLICY "HR manages employee onboarding items" ON public.hr_employee_onboarding_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_onboarding(auth.uid()));
CREATE POLICY "HR deletes employee onboarding items" ON public.hr_employee_onboarding_items FOR DELETE TO authenticated USING (public.can_manage_onboarding(auth.uid()));
CREATE TRIGGER hr_employee_onboarding_items_touch_ssm BEFORE UPDATE ON public.hr_employee_onboarding_items FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();
CREATE TABLE public.sales_nda_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text NOT NULL DEFAULT '1.0',
  content_summary text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_nda_templates TO authenticated;
GRANT ALL ON public.sales_nda_templates TO service_role;
ALTER TABLE public.sales_nda_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales users view NDA templates" ON public.sales_nda_templates FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users manage NDA templates" ON public.sales_nda_templates FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sales_nda_templates_touch_ssm BEFORE UPDATE ON public.sales_nda_templates FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.sales_nda_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.sales_opportunities(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.sales_nda_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'not_required' CHECK (status IN ('not_required','draft','sent','signed','expired','declined')),
  signed_by_name text,
  signed_by_email text,
  signed_at timestamptz,
  expiry_date date,
  secure_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_nda_records TO authenticated;
GRANT ALL ON public.sales_nda_records TO service_role;
ALTER TABLE public.sales_nda_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales users view NDA records" ON public.sales_nda_records FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users manage NDA records" ON public.sales_nda_records FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sales_nda_records_touch_ssm BEFORE UPDATE ON public.sales_nda_records FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.customer_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_number text NOT NULL UNIQUE,
  opportunity_id uuid NOT NULL REFERENCES public.sales_opportunities(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','clarification_required','under_review','feasibility','commercial_review','customer_review','approved','baselined','changed','archived')),
  current_revision integer NOT NULL DEFAULT 1,
  customer_reference text,
  requirement_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_requirements TO authenticated;
GRANT ALL ON public.customer_requirements TO service_role;
ALTER TABLE public.customer_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales users view requirements" ON public.customer_requirements FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_permission(auth.uid(), 'engineering.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users manage requirements" ON public.customer_requirements FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER customer_requirements_touch_ssm BEFORE UPDATE ON public.customer_requirements FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.customer_requirement_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.customer_requirements(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  change_summary text NOT NULL,
  requirement_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'working' CHECK (status IN ('working','submitted','approved','superseded')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requirement_id, revision_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_requirement_revisions TO authenticated;
GRANT ALL ON public.customer_requirement_revisions TO service_role;
ALTER TABLE public.customer_requirement_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales users view requirement revisions" ON public.customer_requirement_revisions FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_permission(auth.uid(), 'engineering.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users manage requirement revisions" ON public.customer_requirement_revisions FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.requirement_feasibility_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.customer_requirements(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  reviewer_user_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','feasible','feasible_with_conditions','not_feasible')),
  findings text,
  assumptions text,
  risks text,
  reviewed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requirement_id, department_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirement_feasibility_reviews TO authenticated;
GRANT ALL ON public.requirement_feasibility_reviews TO service_role;
ALTER TABLE public.requirement_feasibility_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view feasibility reviews" ON public.requirement_feasibility_reviews FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_permission(auth.uid(), 'engineering.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users manage feasibility reviews" ON public.requirement_feasibility_reviews FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER requirement_feasibility_reviews_touch_ssm BEFORE UPDATE ON public.requirement_feasibility_reviews FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.sales_commercial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.customer_requirements(id) ON DELETE CASCADE,
  quotation_reference text,
  currency text NOT NULL DEFAULT 'INR',
  quoted_amount numeric(14,2),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','internal_review','sent','customer_authorized','declined','expired')),
  customer_authorized_at timestamptz,
  authorization_reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requirement_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_commercial_records TO authenticated;
GRANT ALL ON public.sales_commercial_records TO service_role;
ALTER TABLE public.sales_commercial_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales users view commercial records" ON public.sales_commercial_records FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users manage commercial records" ON public.sales_commercial_records FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sales_commercial_records_touch_ssm BEFORE UPDATE ON public.sales_commercial_records FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.requirement_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.customer_requirements(id) ON DELETE RESTRICT,
  baseline_number text NOT NULL UNIQUE,
  revision_number integer NOT NULL,
  requirement_snapshot jsonb NOT NULL,
  commercial_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','project_initiated')),
  approved_by uuid,
  approved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requirement_id, revision_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirement_baselines TO authenticated;
GRANT ALL ON public.requirement_baselines TO service_role;
ALTER TABLE public.requirement_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales users view baselines" ON public.requirement_baselines FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_permission(auth.uid(), 'engineering.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users create baselines" ON public.requirement_baselines FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.requirement_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.customer_requirements(id) ON DELETE CASCADE,
  baseline_id uuid NOT NULL REFERENCES public.requirement_baselines(id) ON DELETE RESTRICT,
  change_number text NOT NULL UNIQUE,
  summary text NOT NULL,
  requested_by text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','approved','rejected','implemented')),
  impact_summary text,
  resolution_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirement_change_requests TO authenticated;
GRANT ALL ON public.requirement_change_requests TO service_role;
ALTER TABLE public.requirement_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales users view change requests" ON public.requirement_change_requests FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_permission(auth.uid(), 'engineering.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users manage change requests" ON public.requirement_change_requests FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER requirement_change_requests_touch_ssm BEFORE UPDATE ON public.requirement_change_requests FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.customer_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  access_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  label text NOT NULL,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_portal_access TO authenticated;
GRANT ALL ON public.customer_portal_access TO service_role;
ALTER TABLE public.customer_portal_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales users view portal access" ON public.customer_portal_access FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users manage portal access" ON public.customer_portal_access FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.customer_portal_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_access_id uuid NOT NULL REFERENCES public.customer_portal_access(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('requirement','baseline','commercial_record','drive_node')),
  entity_id uuid NOT NULL,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view','comment')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(portal_access_id, entity_type, entity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_portal_shares TO authenticated;
GRANT ALL ON public.customer_portal_shares TO service_role;
ALTER TABLE public.customer_portal_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales users view portal shares" ON public.customer_portal_shares FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users manage portal shares" ON public.customer_portal_shares FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.sales_project_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id uuid NOT NULL REFERENCES public.requirement_baselines(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','initiated','completed','cancelled')),
  handover_notes text,
  initiated_by uuid,
  initiated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(baseline_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_project_handovers TO authenticated;
GRANT ALL ON public.sales_project_handovers TO service_role;
ALTER TABLE public.sales_project_handovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view sales handovers" ON public.sales_project_handovers FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'sales.view') OR public.has_permission(auth.uid(), 'projects.view') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales users manage sales handovers" ON public.sales_project_handovers FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sales_project_handovers_touch_ssm BEFORE UPDATE ON public.sales_project_handovers FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE INDEX sales_nda_records_opportunity_idx ON public.sales_nda_records(opportunity_id);
CREATE INDEX customer_requirements_opportunity_idx ON public.customer_requirements(opportunity_id);
CREATE INDEX requirement_feasibility_reviews_requirement_idx ON public.requirement_feasibility_reviews(requirement_id);
CREATE INDEX customer_portal_access_customer_idx ON public.customer_portal_access(customer_id);
CREATE INDEX sales_project_handovers_baseline_idx ON public.sales_project_handovers(baseline_id);
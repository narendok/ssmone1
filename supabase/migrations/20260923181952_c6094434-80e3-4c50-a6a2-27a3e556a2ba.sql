CREATE TABLE public.qms_quality_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  owner_user_id uuid,
  metric_summary text,
  target_value numeric,
  baseline_value numeric,
  frequency text NOT NULL DEFAULT 'MONTHLY',
  start_date date,
  end_date date,
  action_plan text,
  status text NOT NULL DEFAULT 'DRAFT',
  evidence_reference text,
  review_notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_quality_objectives TO authenticated;
GRANT ALL ON public.qms_quality_objectives TO service_role;
ALTER TABLE public.qms_quality_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_quality_objectives_read ON public.qms_quality_objectives FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_quality_objectives_manage ON public.qms_quality_objectives FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  unit text,
  direction text NOT NULL DEFAULT 'HIGHER_IS_BETTER',
  target_value numeric,
  warning_threshold numeric,
  critical_threshold numeric,
  frequency text NOT NULL DEFAULT 'MONTHLY',
  source_type text NOT NULL DEFAULT 'AUTOMATIC_DATABASE',
  calculation_method text,
  source_reference text,
  owner_user_id uuid,
  reviewer_user_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_kpis TO authenticated;
GRANT ALL ON public.qms_kpis TO service_role;
ALTER TABLE public.qms_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_kpis_read ON public.qms_kpis FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_kpis_manage ON public.qms_kpis FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_kpi_formula_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES public.qms_kpis(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  effective_date date NOT NULL DEFAULT current_date,
  calculation_method text NOT NULL,
  source_reference text,
  change_reason text,
  changed_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(kpi_id, version_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_kpi_formula_versions TO authenticated;
GRANT ALL ON public.qms_kpi_formula_versions TO service_role;
ALTER TABLE public.qms_kpi_formula_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_kpi_formula_versions_read ON public.qms_kpi_formula_versions FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_kpi_formula_versions_manage ON public.qms_kpi_formula_versions FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES public.qms_kpis(id) ON DELETE CASCADE,
  formula_version_id uuid REFERENCES public.qms_kpi_formula_versions(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  value numeric,
  target_value numeric,
  status text NOT NULL DEFAULT 'NOT_AVAILABLE',
  source_data_timestamp timestamptz,
  data_quality_status text NOT NULL DEFAULT 'COMPLETE',
  data_quality_reason text,
  evidence_reference text,
  entered_by uuid DEFAULT auth.uid(),
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(kpi_id, period_start, period_end)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_kpi_snapshots TO authenticated;
GRANT ALL ON public.qms_kpi_snapshots TO service_role;
ALTER TABLE public.qms_kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_kpi_snapshots_read ON public.qms_kpi_snapshots FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_kpi_snapshots_manage ON public.qms_kpi_snapshots FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_objective_kpis (
  objective_id uuid NOT NULL REFERENCES public.qms_quality_objectives(id) ON DELETE CASCADE,
  kpi_id uuid NOT NULL REFERENCES public.qms_kpis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (objective_id, kpi_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_objective_kpis TO authenticated;
GRANT ALL ON public.qms_objective_kpis TO service_role;
ALTER TABLE public.qms_objective_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_objective_kpis_read ON public.qms_objective_kpis FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_objective_kpis_manage ON public.qms_objective_kpis FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_code text NOT NULL UNIQUE,
  record_kind text NOT NULL DEFAULT 'RISK',
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  process_name text,
  source_type text,
  source_record_id uuid,
  description text NOT NULL,
  cause text,
  potential_impact text,
  existing_controls text,
  likelihood numeric,
  severity numeric,
  risk_evaluation numeric,
  action_plan text,
  owner_user_id uuid,
  due_date date,
  residual_risk numeric,
  status text NOT NULL DEFAULT 'OPEN',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_risks TO authenticated;
GRANT ALL ON public.qms_risks TO service_role;
ALTER TABLE public.qms_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_risks_read ON public.qms_risks FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_risks_manage ON public.qms_risks FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_contingency_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL UNIQUE,
  scenario text NOT NULL,
  affected_process text,
  risk_id uuid REFERENCES public.qms_risks(id) ON DELETE SET NULL,
  response_plan text NOT NULL,
  responsible_roles text,
  communication_plan text,
  backup_resource text,
  recovery_steps text,
  customer_impact text,
  recovery_validation text,
  last_review_date date,
  last_test_date date,
  next_review_date date,
  status text NOT NULL DEFAULT 'DRAFT',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_contingency_plans TO authenticated;
GRANT ALL ON public.qms_contingency_plans TO service_role;
ALTER TABLE public.qms_contingency_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_contingency_plans_read ON public.qms_contingency_plans FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_contingency_plans_manage ON public.qms_contingency_plans FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_contingency_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.qms_contingency_plans(id) ON DELETE CASCADE,
  test_date date NOT NULL,
  participants text,
  observed_result text,
  gap_summary text,
  action_summary text,
  evidence_reference text,
  effectiveness text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_contingency_tests TO authenticated;
GRANT ALL ON public.qms_contingency_tests TO service_role;
ALTER TABLE public.qms_contingency_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_contingency_tests_read ON public.qms_contingency_tests FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_contingency_tests_manage ON public.qms_contingency_tests FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_code text NOT NULL UNIQUE,
  audit_type text NOT NULL,
  scope text,
  criteria text,
  process_name text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  risk_basis text,
  planned_date date,
  auditor_user_id uuid,
  auditee_user_id uuid,
  checklist_reference text,
  status text NOT NULL DEFAULT 'PLANNED',
  summary text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_audits TO authenticated;
GRANT ALL ON public.qms_audits TO service_role;
ALTER TABLE public.qms_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_audits_read ON public.qms_audits FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_audits_manage ON public.qms_audits FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_code text NOT NULL UNIQUE,
  audit_id uuid NOT NULL REFERENCES public.qms_audits(id) ON DELETE CASCADE,
  finding_type text NOT NULL DEFAULT 'NONCONFORMITY',
  severity text NOT NULL DEFAULT 'MINOR',
  description text NOT NULL,
  requirement_reference text,
  evidence_reference text,
  owner_user_id uuid,
  due_date date,
  status text NOT NULL DEFAULT 'OPEN',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_audit_findings TO authenticated;
GRANT ALL ON public.qms_audit_findings TO service_role;
ALTER TABLE public.qms_audit_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_audit_findings_read ON public.qms_audit_findings FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_audit_findings_manage ON public.qms_audit_findings FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_capas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_code text NOT NULL UNIQUE,
  source_type text,
  source_record_id uuid,
  title text NOT NULL,
  problem_statement text NOT NULL,
  containment_action text,
  root_cause_method text,
  root_cause_summary text,
  correction_action text,
  corrective_action text,
  owner_user_id uuid,
  target_date date,
  status text NOT NULL DEFAULT 'DRAFT',
  effectiveness_due_date date,
  effectiveness_review text,
  effectiveness_reviewer_id uuid,
  closed_at timestamptz,
  closed_by uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_capas TO authenticated;
GRANT ALL ON public.qms_capas TO service_role;
ALTER TABLE public.qms_capas ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_capas_read ON public.qms_capas FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_capas_manage ON public.qms_capas FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_improvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  improvement_code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  source_type text,
  source_record_id uuid,
  owner_user_id uuid,
  target_date date,
  benefit_summary text,
  status text NOT NULL DEFAULT 'OPEN',
  evidence_reference text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_improvements TO authenticated;
GRANT ALL ON public.qms_improvements TO service_role;
ALTER TABLE public.qms_improvements ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_improvements_read ON public.qms_improvements FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_improvements_manage ON public.qms_improvements FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_lessons_learned (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_code text NOT NULL UNIQUE,
  title text NOT NULL,
  context text,
  lesson text NOT NULL,
  recommendation text,
  source_type text,
  source_record_id uuid,
  applicability text,
  status text NOT NULL DEFAULT 'DRAFT',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_lessons_learned TO authenticated;
GRANT ALL ON public.qms_lessons_learned TO service_role;
ALTER TABLE public.qms_lessons_learned ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_lessons_learned_read ON public.qms_lessons_learned FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_lessons_learned_manage ON public.qms_lessons_learned FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_management_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_code text NOT NULL UNIQUE,
  planned_date date NOT NULL,
  meeting_date date,
  scope text,
  performance_summary text,
  decisions text,
  action_summary text,
  next_review_date date,
  status text NOT NULL DEFAULT 'PLANNED',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_management_reviews TO authenticated;
GRANT ALL ON public.qms_management_reviews TO service_role;
ALTER TABLE public.qms_management_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_management_reviews_read ON public.qms_management_reviews FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_management_reviews_manage ON public.qms_management_reviews FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.qms_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL UNIQUE,
  retention_duration_months integer NOT NULL,
  retention_trigger text NOT NULL,
  owner_user_id uuid,
  legal_customer_basis text,
  archive_method text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qms_retention_policies TO authenticated;
GRANT ALL ON public.qms_retention_policies TO service_role;
ALTER TABLE public.qms_retention_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY qms_retention_policies_read ON public.qms_retention_policies FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY qms_retention_policies_manage ON public.qms_retention_policies FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.customer_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_code text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  production_unit_id uuid REFERENCES public.production_units(id) ON DELETE SET NULL,
  dispatch_id uuid REFERENCES public.production_dispatches(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'MEDIUM',
  status text NOT NULL DEFAULT 'OPEN',
  owner_user_id uuid,
  response_due_date date,
  closure_due_date date,
  customer_visible_update text,
  internal_analysis text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_complaints TO authenticated;
GRANT ALL ON public.customer_complaints TO service_role;
ALTER TABLE public.customer_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_complaints_read ON public.customer_complaints FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'customer_service.view') OR public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY customer_complaints_manage ON public.customer_complaints FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'customer_service.edit') OR public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'customer_service.edit') OR public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.customer_warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_code text NOT NULL UNIQUE,
  complaint_id uuid REFERENCES public.customer_complaints(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  production_unit_id uuid REFERENCES public.production_units(id) ON DELETE SET NULL,
  claim_summary text NOT NULL,
  eligibility_status text NOT NULL DEFAULT 'REVIEW_REQUIRED',
  eligibility_notes text,
  status text NOT NULL DEFAULT 'OPEN',
  owner_user_id uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_warranty_claims TO authenticated;
GRANT ALL ON public.customer_warranty_claims TO service_role;
ALTER TABLE public.customer_warranty_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_warranty_claims_read ON public.customer_warranty_claims FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'customer_service.view') OR public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY customer_warranty_claims_manage ON public.customer_warranty_claims FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'customer_service.edit') OR public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'customer_service.edit') OR public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.customer_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_code text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  complaint_id uuid REFERENCES public.customer_complaints(id) ON DELETE SET NULL,
  warranty_claim_id uuid REFERENCES public.customer_warranty_claims(id) ON DELETE SET NULL,
  production_unit_id uuid REFERENCES public.production_units(id) ON DELETE SET NULL,
  received_date date,
  return_reason text,
  disposition text,
  status text NOT NULL DEFAULT 'EXPECTED',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_returns TO authenticated;
GRANT ALL ON public.customer_returns TO service_role;
ALTER TABLE public.customer_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_returns_read ON public.customer_returns FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'customer_service.view') OR public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY customer_returns_manage ON public.customer_returns FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'customer_service.edit') OR public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'customer_service.edit') OR public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.customer_field_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  failure_code text NOT NULL UNIQUE,
  complaint_id uuid REFERENCES public.customer_complaints(id) ON DELETE SET NULL,
  return_id uuid REFERENCES public.customer_returns(id) ON DELETE SET NULL,
  production_unit_id uuid REFERENCES public.production_units(id) ON DELETE SET NULL,
  failure_summary text NOT NULL,
  failure_mode text,
  confirmed_at timestamptz,
  analysis_status text NOT NULL DEFAULT 'OPEN',
  analysis_summary text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_field_failures TO authenticated;
GRANT ALL ON public.customer_field_failures TO service_role;
ALTER TABLE public.customer_field_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_field_failures_read ON public.customer_field_failures FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'customer_service.view') OR public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY customer_field_failures_manage ON public.customer_field_failures FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'customer_service.edit') OR public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'customer_service.edit') OR public.phase8_can(auth.uid(), 'qms.edit'));

CREATE TABLE public.customer_satisfaction_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_code text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  period_start date,
  period_end date,
  score numeric,
  feedback text,
  evidence_reference text,
  status text NOT NULL DEFAULT 'DRAFT',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_satisfaction_surveys TO authenticated;
GRANT ALL ON public.customer_satisfaction_surveys TO service_role;
ALTER TABLE public.customer_satisfaction_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_satisfaction_surveys_read ON public.customer_satisfaction_surveys FOR SELECT TO authenticated USING (public.phase8_can(auth.uid(), 'customer_service.view') OR public.phase8_can(auth.uid(), 'qms.view'));
CREATE POLICY customer_satisfaction_surveys_manage ON public.customer_satisfaction_surveys FOR ALL TO authenticated USING (public.phase8_can(auth.uid(), 'customer_service.edit') OR public.phase8_can(auth.uid(), 'qms.edit')) WITH CHECK (public.phase8_can(auth.uid(), 'customer_service.edit') OR public.phase8_can(auth.uid(), 'qms.edit'));

CREATE OR REPLACE FUNCTION public.phase9_assign_identifiers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix text;
  sequence_value bigint;
BEGIN
  IF NEW.id IS NULL THEN NEW.id := gen_random_uuid(); END IF;
  IF TG_TABLE_NAME = 'qms_quality_objectives' AND COALESCE(NEW.objective_code, '') = '' THEN prefix := 'QOBJ'; ELSIF TG_TABLE_NAME = 'qms_kpis' AND COALESCE(NEW.kpi_code, '') = '' THEN prefix := 'KPI'; ELSIF TG_TABLE_NAME = 'qms_risks' AND COALESCE(NEW.risk_code, '') = '' THEN prefix := CASE WHEN NEW.record_kind = 'OPPORTUNITY' THEN 'OPP' ELSE 'RISK' END; ELSIF TG_TABLE_NAME = 'qms_contingency_plans' AND COALESCE(NEW.plan_code, '') = '' THEN prefix := 'CONT'; ELSIF TG_TABLE_NAME = 'qms_audits' AND COALESCE(NEW.audit_code, '') = '' THEN prefix := 'AUD'; ELSIF TG_TABLE_NAME = 'qms_audit_findings' AND COALESCE(NEW.finding_code, '') = '' THEN prefix := 'FIND'; ELSIF TG_TABLE_NAME = 'qms_capas' AND COALESCE(NEW.capa_code, '') = '' THEN prefix := 'CAPA'; ELSIF TG_TABLE_NAME = 'qms_improvements' AND COALESCE(NEW.improvement_code, '') = '' THEN prefix := 'IMPR'; ELSIF TG_TABLE_NAME = 'qms_lessons_learned' AND COALESCE(NEW.lesson_code, '') = '' THEN prefix := 'LESS'; ELSIF TG_TABLE_NAME = 'qms_management_reviews' AND COALESCE(NEW.review_code, '') = '' THEN prefix := 'MR'; ELSIF TG_TABLE_NAME = 'customer_complaints' AND COALESCE(NEW.complaint_code, '') = '' THEN prefix := 'COMP'; ELSIF TG_TABLE_NAME = 'customer_warranty_claims' AND COALESCE(NEW.claim_code, '') = '' THEN prefix := 'WARR'; ELSIF TG_TABLE_NAME = 'customer_returns' AND COALESCE(NEW.return_code, '') = '' THEN prefix := 'RMA'; ELSIF TG_TABLE_NAME = 'customer_field_failures' AND COALESCE(NEW.failure_code, '') = '' THEN prefix := 'FAIL'; ELSIF TG_TABLE_NAME = 'customer_satisfaction_surveys' AND COALESCE(NEW.survey_code, '') = '' THEN prefix := 'CSAT'; ELSE RETURN NEW; END IF;
  sequence_value := nextval('public.qms_phase9_identifier_seq');
  IF TG_TABLE_NAME = 'qms_quality_objectives' THEN NEW.objective_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'qms_kpis' THEN NEW.kpi_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'qms_risks' THEN NEW.risk_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'qms_contingency_plans' THEN NEW.plan_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'qms_audits' THEN NEW.audit_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'qms_audit_findings' THEN NEW.finding_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'qms_capas' THEN NEW.capa_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'qms_improvements' THEN NEW.improvement_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'qms_lessons_learned' THEN NEW.lesson_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'qms_management_reviews' THEN NEW.review_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'customer_complaints' THEN NEW.complaint_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'customer_warranty_claims' THEN NEW.claim_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'customer_returns' THEN NEW.return_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSIF TG_TABLE_NAME = 'customer_field_failures' THEN NEW.failure_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); ELSE NEW.survey_code := prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(sequence_value::text, 5, '0'); END IF;
  RETURN NEW;
END;
$$;
CREATE SEQUENCE IF NOT EXISTS public.qms_phase9_identifier_seq;

CREATE OR REPLACE FUNCTION public.phase9_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER qms_quality_objectives_identifier BEFORE INSERT ON public.qms_quality_objectives FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER qms_kpis_identifier BEFORE INSERT ON public.qms_kpis FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER qms_risks_identifier BEFORE INSERT ON public.qms_risks FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER qms_contingency_plans_identifier BEFORE INSERT ON public.qms_contingency_plans FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER qms_audits_identifier BEFORE INSERT ON public.qms_audits FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER qms_audit_findings_identifier BEFORE INSERT ON public.qms_audit_findings FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER qms_capas_identifier BEFORE INSERT ON public.qms_capas FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER qms_improvements_identifier BEFORE INSERT ON public.qms_improvements FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER qms_lessons_learned_identifier BEFORE INSERT ON public.qms_lessons_learned FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER qms_management_reviews_identifier BEFORE INSERT ON public.qms_management_reviews FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER customer_complaints_identifier BEFORE INSERT ON public.customer_complaints FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER customer_warranty_claims_identifier BEFORE INSERT ON public.customer_warranty_claims FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER customer_returns_identifier BEFORE INSERT ON public.customer_returns FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER customer_field_failures_identifier BEFORE INSERT ON public.customer_field_failures FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();
CREATE TRIGGER customer_satisfaction_surveys_identifier BEFORE INSERT ON public.customer_satisfaction_surveys FOR EACH ROW EXECUTE FUNCTION public.phase9_assign_identifiers();

CREATE TRIGGER qms_quality_objectives_touch BEFORE UPDATE ON public.qms_quality_objectives FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER qms_kpis_touch BEFORE UPDATE ON public.qms_kpis FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER qms_risks_touch BEFORE UPDATE ON public.qms_risks FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER qms_contingency_plans_touch BEFORE UPDATE ON public.qms_contingency_plans FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER qms_audits_touch BEFORE UPDATE ON public.qms_audits FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER qms_audit_findings_touch BEFORE UPDATE ON public.qms_audit_findings FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER qms_capas_touch BEFORE UPDATE ON public.qms_capas FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER qms_improvements_touch BEFORE UPDATE ON public.qms_improvements FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER qms_lessons_learned_touch BEFORE UPDATE ON public.qms_lessons_learned FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER qms_management_reviews_touch BEFORE UPDATE ON public.qms_management_reviews FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER qms_retention_policies_touch BEFORE UPDATE ON public.qms_retention_policies FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER customer_complaints_touch BEFORE UPDATE ON public.customer_complaints FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER customer_warranty_claims_touch BEFORE UPDATE ON public.customer_warranty_claims FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER customer_returns_touch BEFORE UPDATE ON public.customer_returns FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER customer_field_failures_touch BEFORE UPDATE ON public.customer_field_failures FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();
CREATE TRIGGER customer_satisfaction_surveys_touch BEFORE UPDATE ON public.customer_satisfaction_surveys FOR EACH ROW EXECUTE FUNCTION public.phase9_touch_updated_at();

INSERT INTO public.application_modules(key, name, group_key, route_path, status, sort_order)
VALUES ('qms', 'QMS', 'Operations', '/qms', 'ENABLED', 86), ('customer_service', 'Customer Service', 'Operations', '/customer-service', 'ENABLED', 87)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, group_key = EXCLUDED.group_key, route_path = EXCLUDED.route_path, status = EXCLUDED.status, sort_order = EXCLUDED.sort_order;

INSERT INTO public.permissions(key, module_key, label, description)
VALUES
 ('qms.view','qms','qms view','Allows viewing QMS governance records.'), ('qms.edit','qms','qms edit','Allows managing QMS governance records.'), ('qms.approve','qms','qms approve','Allows approving QMS reviews and closures.'),
 ('customer_service.view','customer_service','customer service view','Allows viewing customer service records.'), ('customer_service.edit','customer_service','customer service edit','Allows managing customer service records.'), ('customer_service.approve','customer_service','customer service approve','Allows approving customer service closures.')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description;

INSERT INTO public.access_roles(name, description, is_system)
VALUES ('QMS Manager', 'QMS governance, audit and CAPA operations', true), ('Customer Service', 'Customer complaint, warranty and return operations', true)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_system = EXCLUDED.is_system;

INSERT INTO public.access_role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.access_roles r CROSS JOIN public.permissions p
WHERE (r.name = 'System Admin' AND p.key IN ('qms.view','qms.edit','qms.approve','customer_service.view','customer_service.edit','customer_service.approve'))
   OR (r.name = 'QMS Manager' AND p.key IN ('qms.view','qms.edit','qms.approve','customer_service.view'))
   OR (r.name = 'QA' AND p.key IN ('qms.view','qms.edit','customer_service.view'))
   OR (r.name = 'Management' AND p.key IN ('qms.view','qms.approve','customer_service.view','customer_service.approve'))
   OR (r.name = 'Customer Service' AND p.key IN ('customer_service.view','customer_service.edit','customer_service.approve','qms.view'))
   OR (r.name = 'Sales' AND p.key IN ('customer_service.view','customer_service.edit'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.automation_rules(rule_key, name, description, trigger_key, execution_mode, is_enabled)
VALUES
 ('phase9_kpi_exception','QMS KPI exception review','Highlights off-target KPI periods for owner review.','qms.kpi.exception','review_required',true),
 ('phase9_overdue_capa','QMS CAPA overdue review','Highlights CAPA records past their target date.','qms.capa.overdue','review_required',true),
 ('phase9_high_risk_review','QMS high-risk review','Highlights high-risk organization risks requiring review.','qms.risk.high','review_required',true),
 ('phase9_contingency_review','QMS contingency review','Highlights contingency plans due for review or testing.','qms.contingency.review','review_required',true),
 ('phase9_critical_complaint','Customer critical complaint review','Highlights critical customer complaints for cross-functional review.','customer.complaint.critical','review_required',true)
ON CONFLICT (rule_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, execution_mode = EXCLUDED.execution_mode, is_enabled = EXCLUDED.is_enabled;

REVOKE ALL ON FUNCTION public.phase9_assign_identifiers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phase9_assign_identifiers() TO service_role;
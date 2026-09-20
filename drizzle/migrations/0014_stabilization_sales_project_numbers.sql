ALTER TABLE public.sales_enquiries ALTER COLUMN enquiry_number DROP NOT NULL;
ALTER TABLE public.sales_opportunities ALTER COLUMN opportunity_number DROP NOT NULL;
ALTER TABLE public.customer_requirements ALTER COLUMN requirement_number DROP NOT NULL;
ALTER TABLE public.requirement_baselines ALTER COLUMN baseline_number DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS projects_code_normalized_unique_idx ON public.projects (upper(btrim(code)));

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
  ELSIF TG_TABLE_NAME = 'sales_enquiries' AND (NEW.enquiry_number IS NULL OR btrim(NEW.enquiry_number) = '') THEN
    NEW.enquiry_number := public.next_business_number('enquiry', NULL, NULL);
  ELSIF TG_TABLE_NAME = 'sales_opportunities' AND (NEW.opportunity_number IS NULL OR btrim(NEW.opportunity_number) = '') THEN
    NEW.opportunity_number := public.next_business_number('opportunity', NULL, NULL);
  ELSIF TG_TABLE_NAME = 'customer_requirements' AND (NEW.requirement_number IS NULL OR btrim(NEW.requirement_number) = '') THEN
    NEW.requirement_number := public.next_business_number('customer_requirement', NULL, NULL);
  ELSIF TG_TABLE_NAME = 'requirement_baselines' AND (NEW.baseline_number IS NULL OR btrim(NEW.baseline_number) = '') THEN
    NEW.baseline_number := public.next_business_number('baseline', NULL, NULL);
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

CREATE TRIGGER sales_enquiries_assign_business_code BEFORE INSERT ON public.sales_enquiries FOR EACH ROW EXECUTE FUNCTION public.assign_stabilization_codes();
CREATE TRIGGER sales_opportunities_assign_business_code BEFORE INSERT ON public.sales_opportunities FOR EACH ROW EXECUTE FUNCTION public.assign_stabilization_codes();
CREATE TRIGGER customer_requirements_assign_business_code BEFORE INSERT ON public.customer_requirements FOR EACH ROW EXECUTE FUNCTION public.assign_stabilization_codes();
CREATE TRIGGER requirement_baselines_assign_business_code BEFORE INSERT ON public.requirement_baselines FOR EACH ROW EXECUTE FUNCTION public.assign_stabilization_codes();
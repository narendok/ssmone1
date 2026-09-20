CREATE OR REPLACE FUNCTION public.assign_stabilization_codes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  department_code text;
BEGIN
  IF TG_TABLE_NAME = 'customers' THEN
    IF NEW.customer_code IS NULL OR btrim(NEW.customer_code) = '' THEN
      NEW.customer_code := public.next_business_number('customer', NULL, NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'sales_enquiries' THEN
    IF NEW.enquiry_number IS NULL OR btrim(NEW.enquiry_number) = '' THEN
      NEW.enquiry_number := public.next_business_number('enquiry', NULL, NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'sales_opportunities' THEN
    IF NEW.opportunity_number IS NULL OR btrim(NEW.opportunity_number) = '' THEN
      NEW.opportunity_number := public.next_business_number('opportunity', NULL, NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'customer_requirements' THEN
    IF NEW.requirement_number IS NULL OR btrim(NEW.requirement_number) = '' THEN
      NEW.requirement_number := public.next_business_number('customer_requirement', NULL, NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'requirement_baselines' THEN
    IF NEW.baseline_number IS NULL OR btrim(NEW.baseline_number) = '' THEN
      NEW.baseline_number := public.next_business_number('baseline', NULL, NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'projects' THEN
    IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
      NEW.code := public.next_business_number('project', NULL, NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'employees' THEN
    IF NEW.employee_code IS NULL OR btrim(NEW.employee_code) = '' THEN
      SELECT code INTO department_code FROM public.departments WHERE id = NEW.primary_department_id;
      NEW.employee_code := public.next_business_number('employee', department_code, NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'hr_job_requisitions' THEN
    IF NEW.requisition_code IS NULL OR btrim(NEW.requisition_code) = '' THEN
      SELECT code INTO department_code FROM public.departments WHERE id = NEW.department_id;
      NEW.requisition_code := public.next_business_number('job_opening', department_code, NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'hr_job_postings' THEN
    IF NEW.job_code IS NULL OR btrim(NEW.job_code) = '' THEN
      SELECT code INTO department_code FROM public.departments WHERE id = NEW.department_id;
      NEW.job_code := public.next_business_number('job_opening', department_code, NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'hr_candidates' THEN
    IF NEW.candidate_code IS NULL OR btrim(NEW.candidate_code) = '' THEN
      NEW.candidate_code := public.next_business_number('candidate', NULL, NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_stabilization_codes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_stabilization_codes() FROM anon;
REVOKE ALL ON FUNCTION public.assign_stabilization_codes() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assign_stabilization_codes() TO postgres;
GRANT EXECUTE ON FUNCTION public.assign_stabilization_codes() TO service_role;
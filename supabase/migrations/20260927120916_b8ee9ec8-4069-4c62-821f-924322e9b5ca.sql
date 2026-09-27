CREATE OR REPLACE FUNCTION public.assign_qms_quality_objective_identifier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.objective_code, '') = '' THEN
    NEW.objective_code := public.next_document_number('QOBJ');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_qms_audit_identifier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.audit_code, '') = '' THEN
    NEW.audit_code := public.next_document_number('AUD');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qms_quality_objectives_identifier ON public.qms_quality_objectives;
CREATE TRIGGER qms_quality_objectives_identifier
BEFORE INSERT ON public.qms_quality_objectives
FOR EACH ROW EXECUTE FUNCTION public.assign_qms_quality_objective_identifier();

DROP TRIGGER IF EXISTS qms_audits_identifier ON public.qms_audits;
CREATE TRIGGER qms_audits_identifier
BEFORE INSERT ON public.qms_audits
FOR EACH ROW EXECUTE FUNCTION public.assign_qms_audit_identifier();
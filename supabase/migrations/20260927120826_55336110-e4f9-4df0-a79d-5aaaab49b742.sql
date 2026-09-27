CREATE OR REPLACE FUNCTION public.phase9_assign_identifiers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'qms_quality_objectives' AND COALESCE(NEW.objective_code, '') = '' THEN
    NEW.objective_code := public.next_document_number('QOBJ');
  ELSIF TG_TABLE_NAME = 'qms_audits' AND COALESCE(NEW.audit_code, '') = '' THEN
    NEW.audit_code := public.next_document_number('AUD');
  ELSIF TG_TABLE_NAME = 'qms_audit_findings' AND COALESCE(NEW.finding_code, '') = '' THEN
    NEW.finding_code := public.next_document_number('FND');
  ELSIF TG_TABLE_NAME = 'qms_capas' AND COALESCE(NEW.capa_code, '') = '' THEN
    NEW.capa_code := public.next_document_number('CAPA');
  ELSIF TG_TABLE_NAME = 'qms_improvements' AND COALESCE(NEW.improvement_code, '') = '' THEN
    NEW.improvement_code := public.next_document_number('IMP');
  ELSIF TG_TABLE_NAME = 'qms_lessons_learned' AND COALESCE(NEW.lesson_code, '') = '' THEN
    NEW.lesson_code := public.next_document_number('LL');
  END IF;
  RETURN NEW;
END;
$$;
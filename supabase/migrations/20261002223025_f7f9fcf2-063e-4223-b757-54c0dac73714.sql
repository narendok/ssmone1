CREATE OR REPLACE FUNCTION public.lifecycle_template_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_transition_target text := current_setting('lifecycle.template_transition_target', true);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Template actor provenance is server-owned'; END IF;
    NEW.created_at := now();
    RETURN NEW;
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Template provenance is immutable';
  END IF;

  IF TG_OP = 'DELETE' AND OLD.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only DRAFT template versions may be deleted';
  END IF;

  IF (OLD.status IN ('ACTIVE','RETIRED') OR OLD.status IS DISTINCT FROM NEW.status)
     AND v_transition_target IS DISTINCT FROM OLD.id::text THEN
    RAISE EXCEPTION 'Template state changes require a protected lifecycle contract';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_department_process_template(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := public.lifecycle_actor();
DECLARE v_template public.department_process_templates%ROWTYPE;
BEGIN
  SELECT * INTO v_template FROM public.department_process_templates WHERE id = p_template_id FOR UPDATE;
  IF NOT FOUND OR NOT public.lifecycle_can_manage_department(v_actor, v_template.department_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_template.status <> 'DRAFT' THEN RAISE EXCEPTION 'Only DRAFT templates can be activated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.department_process_template_stages s JOIN public.company_process_stages c ON c.id=s.source_company_process_stage_id WHERE s.template_id=v_template.id AND c.is_active) THEN
    RAISE EXCEPTION 'At least one active company process stage is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.department_process_template_stages s JOIN public.company_process_stages c ON c.id=s.source_company_process_stage_id WHERE s.template_id=v_template.id AND c.is_active IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'Inactive company process stages cannot be activated';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_template.department_id::text || '|' || v_template.template_key, 0));
  IF EXISTS (SELECT 1 FROM public.department_process_templates WHERE department_id=v_template.department_id AND template_key=v_template.template_key AND status='ACTIVE') THEN
    RAISE EXCEPTION 'Retire the active template version before activating a successor';
  END IF;
  PERFORM set_config('lifecycle.template_transition_target', v_template.id::text, true);
  UPDATE public.department_process_templates SET status='ACTIVE', activated_at=now() WHERE id=v_template.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.retire_department_process_template(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := public.lifecycle_actor();
DECLARE v_template public.department_process_templates%ROWTYPE;
BEGIN
  SELECT * INTO v_template FROM public.department_process_templates WHERE id=p_template_id FOR UPDATE;
  IF NOT FOUND OR NOT public.lifecycle_can_manage_department(v_actor, v_template.department_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_template.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Only ACTIVE templates can be retired'; END IF;
  PERFORM set_config('lifecycle.template_transition_target', v_template.id::text, true);
  UPDATE public.department_process_templates SET status='RETIRED', retired_at=now() WHERE id=v_template.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.lifecycle_generation_receipt_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.requested_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Generation receipt actor provenance is server-owned'; END IF;
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Generation receipts are immutable';
END;
$$;

REVOKE ALL ON FUNCTION public.lifecycle_generation_receipt_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER lifecycle_generation_receipt_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.project_lifecycle_generation_requests
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_generation_receipt_guard();
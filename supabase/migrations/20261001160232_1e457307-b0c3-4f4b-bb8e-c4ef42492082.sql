CREATE TABLE public.company_process_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code text NOT NULL UNIQUE CHECK (stage_code ~ '^HW_([0-9]{2}|3[0-7])$'),
  title text NOT NULL,
  description text,
  owning_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  reviewer_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  sort_order integer NOT NULL,
  requires_gated_handover boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_process_stages TO authenticated;
GRANT ALL ON public.company_process_stages TO service_role;
ALTER TABLE public.company_process_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view company process stages" ON public.company_process_stages FOR SELECT TO authenticated USING (true);

CREATE TABLE public.project_process_stage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_process_stage_id uuid NOT NULL REFERENCES public.company_process_stages(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED','IN_PROGRESS','IN_REVIEW','BLOCKED','HANDED_OVER','COMPLETE','REDESIGN_REQUIRED')),
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewer_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  predecessor_record_id uuid REFERENCES public.project_process_stage_records(id) ON DELETE SET NULL,
  linked_task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  evidence_drive_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE SET NULL,
  change_request_id uuid REFERENCES public.project_change_requests(id) ON DELETE SET NULL,
  handover_note text,
  completed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, company_process_stage_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_process_stage_records TO authenticated;
GRANT ALL ON public.project_process_stage_records TO service_role;
ALTER TABLE public.project_process_stage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project teams view company process records" ON public.project_process_stage_records FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.can_access_department_drive(auth.uid(), p.department_id, p.id))
);
CREATE POLICY "Authorized users manage company process records" ON public.project_process_stage_records FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.can_access_department_drive(auth.uid(), p.department_id, p.id))
  AND public.has_any_permission(auth.uid(), ARRAY['projects.manage','engineering.manage','documents.edit'])
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.can_access_department_drive(auth.uid(), p.department_id, p.id))
  AND public.has_any_permission(auth.uid(), ARRAY['projects.manage','engineering.manage','documents.edit'])
);

CREATE TABLE public.document_control_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key uuid NOT NULL UNIQUE,
  register_id uuid NOT NULL REFERENCES public.document_control_registers(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('SUBMIT_REVIEW','REVIEW_APPROVE','REVIEW_REJECT','APPROVE','RELEASE','SUPERSEDE')),
  requested_by uuid NOT NULL,
  payload_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.document_control_action_requests TO authenticated;
GRANT ALL ON public.document_control_action_requests TO service_role;
ALTER TABLE public.document_control_action_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Actors view their document action receipts" ON public.document_control_action_requests FOR SELECT TO authenticated USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER TABLE public.document_control_registers
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_revision_id uuid REFERENCES public.drive_node_revisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_revision_number integer,
  ADD COLUMN IF NOT EXISTS owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_decision text CHECK (reviewer_decision IN ('APPROVED','REJECTED')),
  ADD COLUMN IF NOT EXISTS reviewer_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS approver_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by_register_id uuid REFERENCES public.document_control_registers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_drive_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE SET NULL;

ALTER TABLE public.document_control_events
  ADD COLUMN IF NOT EXISTS revision_id uuid REFERENCES public.drive_node_revisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action_request_key uuid,
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS change_reason text;

ALTER TABLE public.project_boms
  ADD COLUMN IF NOT EXISTS source_drive_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_drive_revision_id uuid REFERENCES public.drive_node_revisions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS document_control_registers_project_id_idx ON public.document_control_registers(project_id);
CREATE INDEX IF NOT EXISTS document_control_registers_source_revision_id_idx ON public.document_control_registers(source_revision_id);
CREATE INDEX IF NOT EXISTS project_process_stage_records_project_id_idx ON public.project_process_stage_records(project_id);

CREATE OR REPLACE FUNCTION public.touch_company_process_stages()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER touch_company_process_stages_updated_at BEFORE UPDATE ON public.company_process_stages FOR EACH ROW EXECUTE FUNCTION public.touch_company_process_stages();

CREATE OR REPLACE FUNCTION public.touch_project_process_stage_records()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER touch_project_process_stage_records_updated_at BEFORE UPDATE ON public.project_process_stage_records FOR EACH ROW EXECUTE FUNCTION public.touch_project_process_stage_records();

CREATE OR REPLACE FUNCTION public.enforce_document_control_revision_link()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE revision_row public.drive_node_revisions%ROWTYPE;
BEGIN
  IF NEW.source_revision_id IS NOT NULL THEN
    SELECT * INTO revision_row FROM public.drive_node_revisions WHERE id = NEW.source_revision_id;
    IF NOT FOUND OR revision_row.node_id <> NEW.drive_node_id THEN
      RAISE EXCEPTION 'Controlled revision must belong to the registered Drive file';
    END IF;
    NEW.source_revision_number := revision_row.version;
    NEW.controlled_version := revision_row.version;
  ELSIF NEW.source_revision_number IS NOT NULL AND NEW.source_revision_number <> NEW.controlled_version THEN
    RAISE EXCEPTION 'Controlled version must match its source revision number';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_document_control_revision_link_trigger BEFORE INSERT OR UPDATE ON public.document_control_registers FOR EACH ROW EXECUTE FUNCTION public.enforce_document_control_revision_link();

CREATE OR REPLACE FUNCTION public.resolve_document_control_revision(p_node_id uuid, p_revision_number integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result_id uuid;
BEGIN
  IF p_revision_number IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO result_id FROM public.drive_node_revisions WHERE node_id = p_node_id AND version = p_revision_number;
  RETURN result_id;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_document_control_revision(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_document_control_revision(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.transition_document_control(
  p_register_id uuid,
  p_action text,
  p_expected_status text,
  p_note text,
  p_change_reason text,
  p_request_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_register public.document_control_registers%ROWTYPE;
  v_result jsonb;
  v_payload_hash text;
  v_employee_id uuid;
  v_can_manage boolean;
  v_target_status text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_request_key IS NULL THEN RAISE EXCEPTION 'A request key is required'; END IF;
  IF p_action NOT IN ('SUBMIT_REVIEW','REVIEW_APPROVE','REVIEW_REJECT','APPROVE','RELEASE','SUPERSEDE') THEN RAISE EXCEPTION 'Unsupported document action'; END IF;
  v_payload_hash := md5(coalesce(p_register_id::text,'') || '|' || p_action || '|' || coalesce(p_expected_status,'') || '|' || coalesce(p_note,'') || '|' || coalesce(p_change_reason,''));
  SELECT result INTO v_result FROM public.document_control_action_requests WHERE request_key = p_request_key;
  IF FOUND THEN
    IF EXISTS (SELECT 1 FROM public.document_control_action_requests WHERE request_key = p_request_key AND payload_hash = v_payload_hash AND requested_by = v_actor) THEN RETURN v_result; END IF;
    RAISE EXCEPTION 'Request key was already used for another document action';
  END IF;
  SELECT * INTO v_register FROM public.document_control_registers WHERE id = p_register_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Controlled document not found'; END IF;
  IF v_register.document_status <> p_expected_status THEN RAISE EXCEPTION 'Document status changed; refresh and try again'; END IF;
  SELECT id INTO v_employee_id FROM public.employees WHERE user_id = v_actor AND employment_status = 'ACTIVE' ORDER BY created_at LIMIT 1;
  v_can_manage := public.has_role(v_actor, 'admin'::public.app_role) OR public.has_any_permission(v_actor, ARRAY['documents.edit','projects.manage','engineering.manage','qms.edit','quality.edit']);
  IF NOT public.can_access_department_drive(v_actor, v_register.department_id, v_register.project_id) OR NOT v_can_manage THEN
    RAISE EXCEPTION 'You do not have permission to progress this controlled document';
  END IF;
  IF p_action IN ('REVIEW_APPROVE','REVIEW_REJECT') AND v_register.reviewer_employee_id IS NOT NULL AND v_register.reviewer_employee_id <> v_employee_id AND NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only the assigned reviewer can decide this review';
  END IF;
  IF p_action IN ('APPROVE','RELEASE') AND v_register.approver_employee_id IS NOT NULL AND v_register.approver_employee_id <> v_employee_id AND NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only the assigned approver can progress this document';
  END IF;
  CASE p_action
    WHEN 'SUBMIT_REVIEW' THEN
      IF v_register.document_status <> 'DRAFT' THEN RAISE EXCEPTION 'Only drafts can enter review'; END IF;
      v_target_status := 'IN_REVIEW';
    WHEN 'REVIEW_APPROVE' THEN
      IF v_register.document_status <> 'IN_REVIEW' THEN RAISE EXCEPTION 'Only documents in review can be approved by a reviewer'; END IF;
      v_target_status := 'IN_REVIEW';
    WHEN 'REVIEW_REJECT' THEN
      IF v_register.document_status <> 'IN_REVIEW' THEN RAISE EXCEPTION 'Only documents in review can be rejected'; END IF;
      v_target_status := 'DRAFT';
    WHEN 'APPROVE' THEN
      IF v_register.document_status <> 'IN_REVIEW' OR v_register.reviewer_decision IS DISTINCT FROM 'APPROVED' THEN RAISE EXCEPTION 'An approved review is required before approval'; END IF;
      v_target_status := 'APPROVED';
    WHEN 'RELEASE' THEN
      IF v_register.document_status <> 'APPROVED' THEN RAISE EXCEPTION 'Only approved documents can be released'; END IF;
      v_target_status := 'APPROVED';
    WHEN 'SUPERSEDE' THEN
      IF v_register.document_status <> 'APPROVED' THEN RAISE EXCEPTION 'Only approved documents can be superseded'; END IF;
      v_target_status := 'OBSOLETE';
  END CASE;
  UPDATE public.document_control_registers
  SET document_status = v_target_status,
      approval_note = coalesce(p_note, approval_note),
      change_reason = coalesce(p_change_reason, change_reason),
      reviewer_decision = CASE WHEN p_action = 'REVIEW_APPROVE' THEN 'APPROVED' WHEN p_action = 'REVIEW_REJECT' THEN 'REJECTED' ELSE reviewer_decision END,
      reviewer_decided_at = CASE WHEN p_action IN ('REVIEW_APPROVE','REVIEW_REJECT') THEN now() ELSE reviewer_decided_at END,
      approved_by = CASE WHEN p_action = 'APPROVE' THEN v_actor ELSE approved_by END,
      approved_at = CASE WHEN p_action = 'APPROVE' THEN now() ELSE approved_at END,
      released_at = CASE WHEN p_action = 'RELEASE' THEN now() ELSE released_at END
  WHERE id = p_register_id;
  INSERT INTO public.document_control_events(register_id,event_type,from_status,to_status,version,note,actor_id,revision_id,action_request_key,decision,change_reason)
  VALUES (p_register_id, p_action, v_register.document_status, v_target_status, v_register.controlled_version, p_note, v_actor, v_register.source_revision_id, p_request_key,
    CASE WHEN p_action = 'REVIEW_APPROVE' THEN 'APPROVED' WHEN p_action = 'REVIEW_REJECT' THEN 'REJECTED' WHEN p_action IN ('APPROVE','RELEASE') THEN 'APPROVED' ELSE NULL END, p_change_reason);
  v_result := jsonb_build_object('register_id',p_register_id,'action',p_action,'status',v_target_status,'controlled_version',v_register.controlled_version,'processed_at',now());
  INSERT INTO public.document_control_action_requests(request_key,register_id,action,requested_by,payload_hash,result) VALUES (p_request_key,p_register_id,p_action,v_actor,v_payload_hash,v_result);
  INSERT INTO public.activity_log(actor_user_id,module_key,entity_type,entity_id,action,summary,after_data,reason)
  VALUES (v_actor,'document_control','document_control_register',p_register_id,lower(p_action),concat(p_action,' controlled document ',v_register.document_number),v_result,p_change_reason);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.transition_document_control(uuid,text,text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_document_control(uuid,text,text,text,text,uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.controlled_document_audit_gaps WITH (security_invoker = true) AS
SELECT
  r.id AS register_id, r.document_number, r.title, r.document_status, r.controlled_version,
  r.department_id, r.project_id, r.drive_node_id, r.source_revision_id, r.linked_task_id, r.evidence_drive_node_id,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN r.source_revision_id IS NULL THEN 'SOURCE_REVISION_MISSING' END,
    CASE WHEN r.owner_employee_id IS NULL THEN 'OWNER_MISSING' END,
    CASE WHEN r.reviewer_employee_id IS NULL THEN 'REVIEWER_MISSING' END,
    CASE WHEN r.approver_employee_id IS NULL THEN 'APPROVER_MISSING' END,
    CASE WHEN r.change_reason IS NULL OR btrim(r.change_reason) = '' THEN 'CHANGE_REASON_MISSING' END,
    CASE WHEN r.linked_task_id IS NULL THEN 'LINKED_TASK_MISSING' END,
    CASE WHEN r.evidence_drive_node_id IS NULL THEN 'EVIDENCE_MISSING' END
  ], NULL) AS gap_codes,
  r.updated_at
FROM public.document_control_registers r;
GRANT SELECT ON public.controlled_document_audit_gaps TO authenticated, service_role;

CREATE OR REPLACE VIEW public.controlled_document_audit_timeline WITH (security_invoker = true) AS
SELECT e.id, e.register_id, e.event_type, e.from_status, e.to_status, e.version, e.note, e.actor_id, e.revision_id, e.decision, e.change_reason, e.created_at,
       r.document_number, r.title, r.department_id, r.project_id, r.drive_node_id
FROM public.document_control_events e
JOIN public.document_control_registers r ON r.id = e.register_id;
GRANT SELECT ON public.controlled_document_audit_timeline TO authenticated, service_role;

INSERT INTO public.company_process_stages(stage_code,title,description,sort_order,requires_gated_handover)
SELECT 'HW_' || lpad(n::text, 2, '0'), 'Company hardware process stage HW_' || lpad(n::text, 2, '0'), 'Company-specific hardware process taxonomy; customer applicability and required evidence must be set per project.', n, n IN (8,16,24,32,37)
FROM generate_series(1,37) AS n
ON CONFLICT (stage_code) DO NOTHING;

GRANT EXECUTE ON FUNCTION public.touch_company_process_stages() TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_project_process_stage_records() TO service_role;
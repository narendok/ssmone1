CREATE TABLE public.department_workspace_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  drive_default_filter text NOT NULL DEFAULT 'all' CHECK (drive_default_filter IN ('all', 'common', 'internal', 'client', 'ppap', 'starred', 'boms')),
  show_dashboard_documents boolean NOT NULL DEFAULT true,
  project_tracker_view text NOT NULL DEFAULT 'cards' CHECK (project_tracker_view IN ('cards', 'table')),
  lead_digest_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_workspace_preferences TO authenticated;
GRANT ALL ON public.department_workspace_preferences TO service_role;
ALTER TABLE public.department_workspace_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own department workspace preferences"
ON public.department_workspace_preferences FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.can_access_department_drive(auth.uid(), department_id, NULL))
WITH CHECK (user_id = auth.uid() AND public.can_access_department_drive(auth.uid(), department_id, NULL));

CREATE TABLE public.document_control_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_node_id uuid NOT NULL UNIQUE REFERENCES public.drive_nodes(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  document_number text NOT NULL UNIQUE,
  title text NOT NULL,
  document_status text NOT NULL DEFAULT 'DRAFT' CHECK (document_status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'OBSOLETE')),
  controlled_version integer NOT NULL DEFAULT 1 CHECK (controlled_version > 0),
  approval_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_control_registers TO authenticated;
GRANT ALL ON public.document_control_registers TO service_role;
ALTER TABLE public.document_control_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Department members view controlled documents"
ON public.document_control_registers FOR SELECT TO authenticated
USING (public.can_access_department_drive(auth.uid(), department_id, NULL));
CREATE POLICY "Platform Owners manage controlled documents"
ON public.document_control_registers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.document_control_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL REFERENCES public.document_control_registers(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('REGISTERED', 'STATUS_CHANGED', 'APPROVED', 'VERSION_UPDATED')),
  from_status text,
  to_status text,
  version integer,
  note text,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_control_events TO authenticated;
GRANT ALL ON public.document_control_events TO service_role;
ALTER TABLE public.document_control_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Department members view controlled document history"
ON public.document_control_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.document_control_registers r
  WHERE r.id = register_id
    AND public.can_access_department_drive(auth.uid(), r.department_id, NULL)
));
CREATE POLICY "Platform Owners manage controlled document history"
ON public.document_control_events FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.touch_department_workspace_preferences()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER touch_department_workspace_preferences_updated_at
BEFORE UPDATE ON public.department_workspace_preferences
FOR EACH ROW EXECUTE FUNCTION public.touch_department_workspace_preferences();

CREATE OR REPLACE FUNCTION public.touch_document_control_registers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER touch_document_control_registers_updated_at
BEFORE UPDATE ON public.document_control_registers
FOR EACH ROW EXECUTE FUNCTION public.touch_document_control_registers();

CREATE OR REPLACE FUNCTION public.log_document_control_register_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.document_control_events(register_id, event_type, to_status, version, note, actor_id)
    VALUES (NEW.id, 'REGISTERED', NEW.document_status, NEW.controlled_version, NEW.approval_note, auth.uid());
  ELSIF NEW.document_status IS DISTINCT FROM OLD.document_status THEN
    INSERT INTO public.document_control_events(register_id, event_type, from_status, to_status, version, note, actor_id)
    VALUES (NEW.id, CASE WHEN NEW.document_status = 'APPROVED' THEN 'APPROVED' ELSE 'STATUS_CHANGED' END, OLD.document_status, NEW.document_status, NEW.controlled_version, NEW.approval_note, auth.uid());
  ELSIF NEW.controlled_version IS DISTINCT FROM OLD.controlled_version THEN
    INSERT INTO public.document_control_events(register_id, event_type, from_status, to_status, version, note, actor_id)
    VALUES (NEW.id, 'VERSION_UPDATED', OLD.document_status, NEW.document_status, NEW.controlled_version, NEW.approval_note, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER log_document_control_register_event_trigger
AFTER INSERT OR UPDATE ON public.document_control_registers
FOR EACH ROW EXECUTE FUNCTION public.log_document_control_register_event();

REVOKE ALL ON FUNCTION public.log_document_control_register_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_document_control_register_event() TO service_role;
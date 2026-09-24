ALTER TABLE public.external_api_clients
  ADD COLUMN IF NOT EXISTS client_secret_hash text,
  ADD COLUMN IF NOT EXISTS client_secret_rotated_at timestamptz;
ALTER TABLE public.external_webhook_subscriptions
  ADD COLUMN IF NOT EXISTS signing_secret_hash text,
  ADD COLUMN IF NOT EXISTS signing_secret_rotated_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE public.external_webhook_deliveries
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

CREATE OR REPLACE FUNCTION public.external_is_staff_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','documents.manage','projects.manage','quality.manage','procurement.manage'])
$$;

CREATE OR REPLACE FUNCTION public.external_snapshot_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.share_mode = 'FROZEN_SNAPSHOT' AND (
    NEW.manifest IS DISTINCT FROM OLD.manifest
    OR NEW.checksum IS DISTINCT FROM OLD.checksum
    OR NEW.source_entity_type IS DISTINCT FROM OLD.source_entity_type
    OR NEW.source_entity_id IS DISTINCT FROM OLD.source_entity_id
    OR NEW.external_party_id IS DISTINCT FROM OLD.external_party_id
    OR NEW.permission IS DISTINCT FROM OLD.permission
    OR NEW.recipient_email IS DISTINCT FROM OLD.recipient_email
  ) THEN
    RAISE EXCEPTION 'Frozen share snapshots are immutable; create a new revision instead';
  END IF;
  IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR NEW.revoked_by IS DISTINCT FROM OLD.revoked_by THEN
    IF NOT public.external_is_staff_manager() THEN
      RAISE EXCEPTION 'Only an authorized internal manager can revoke a share';
    END IF;
    IF OLD.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'A revoked share cannot be reactivated';
    END IF;
    NEW.revoked_at := now();
    NEW.revoked_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS external_snapshot_guard_trigger ON public.external_share_snapshots;
CREATE TRIGGER external_snapshot_guard_trigger
BEFORE UPDATE ON public.external_share_snapshots
FOR EACH ROW EXECUTE FUNCTION public.external_snapshot_guard();

CREATE OR REPLACE FUNCTION public.external_transmittal_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.external_is_staff_manager() THEN
    IF NEW.status NOT IN ('RECEIVED','UNDER_REVIEW','RESPONSE_RECEIVED')
      OR NEW.external_party_id IS DISTINCT FROM OLD.external_party_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.document_manifest IS DISTINCT FROM OLD.document_manifest
      OR NEW.purpose IS DISTINCT FROM OLD.purpose THEN
      RAISE EXCEPTION 'External users may only acknowledge their issued transmittal';
    END IF;
    NEW.received_at := COALESCE(OLD.received_at, now());
    NEW.acknowledged_by_contact_id := public.external_current_contact_id(auth.uid());
  ELSIF NEW.status = 'ISSUED' AND OLD.status = 'DRAFT' THEN
    NEW.issued_at := COALESCE(NEW.issued_at, now());
  ELSIF NEW.status = 'DRAFT' AND OLD.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Issued transmittals cannot return to draft';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS external_transmittal_guard_trigger ON public.external_transmittals;
CREATE TRIGGER external_transmittal_guard_trigger
BEFORE UPDATE ON public.external_transmittals
FOR EACH ROW EXECUTE FUNCTION public.external_transmittal_guard();

CREATE OR REPLACE FUNCTION public.external_action_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.external_is_staff_manager() THEN
    IF NEW.external_party_id IS DISTINCT FROM OLD.external_party_id
      OR NEW.external_contact_id IS DISTINCT FROM OLD.external_contact_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.source_entity_type IS DISTINCT FROM OLD.source_entity_type
      OR NEW.source_entity_id IS DISTINCT FROM OLD.source_entity_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.status NOT IN ('VIEWED','IN_PROGRESS','CLARIFICATION_REQUIRED','RESPONDED') THEN
      RAISE EXCEPTION 'External users may only respond to their assigned action';
    END IF;
    IF NEW.status IN ('CLARIFICATION_REQUIRED','RESPONDED') AND NULLIF(trim(COALESCE(NEW.response,'')), '') IS NULL THEN
      RAISE EXCEPTION 'A response is required for this status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS external_action_guard_trigger ON public.external_actions;
CREATE TRIGGER external_action_guard_trigger
BEFORE UPDATE ON public.external_actions
FOR EACH ROW EXECUTE FUNCTION public.external_action_guard();

CREATE OR REPLACE FUNCTION public.external_upload_request_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.external_is_staff_manager() THEN
    RAISE EXCEPTION 'Only internal staff can change upload requests';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS external_upload_request_guard_trigger ON public.external_upload_requests;
CREATE TRIGGER external_upload_request_guard_trigger
BEFORE UPDATE ON public.external_upload_requests
FOR EACH ROW EXECUTE FUNCTION public.external_upload_request_guard();

CREATE OR REPLACE FUNCTION public.external_upload_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.external_is_staff_manager() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status <> 'PENDING_REVIEW'
        OR NEW.external_party_id IS DISTINCT FROM public.external_current_party_id()
        OR NEW.external_contact_id IS DISTINCT FROM public.external_current_contact_id(auth.uid()) THEN
        RAISE EXCEPTION 'External uploads must be submitted to the current party pending review';
      END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status
      OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
      OR NEW.external_party_id IS DISTINCT FROM OLD.external_party_id
      OR NEW.external_contact_id IS DISTINCT FROM OLD.external_contact_id
      OR NEW.request_id IS DISTINCT FROM OLD.request_id THEN
      RAISE EXCEPTION 'External uploads cannot be replaced or reviewed by the submitter';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'LINKED_TO_RECORD' AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Linked uploads are final';
    END IF;
    IF NEW.status IN ('ACCEPTED','REJECTED','REPLACEMENT_REQUESTED','LINKED_TO_RECORD') AND NEW.reviewed_at IS NULL THEN
      NEW.reviewed_at := now();
      NEW.reviewed_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS external_upload_guard_trigger ON public.external_uploads;
CREATE TRIGGER external_upload_guard_trigger
BEFORE INSERT OR UPDATE ON public.external_uploads
FOR EACH ROW EXECUTE FUNCTION public.external_upload_guard();

DROP POLICY IF EXISTS external_uploads_partner_submit ON public.external_uploads;
CREATE POLICY external_uploads_partner_submit ON public.external_uploads
FOR INSERT TO authenticated
WITH CHECK (
  external_party_id = public.external_current_party_id()
  AND external_contact_id = public.external_current_contact_id(auth.uid())
  AND status = 'PENDING_REVIEW'
  AND (request_id IS NULL OR EXISTS (
    SELECT 1 FROM public.external_upload_requests eur
    WHERE eur.id = request_id
      AND eur.external_party_id = public.external_current_party_id()
      AND (eur.external_contact_id IS NULL OR eur.external_contact_id = public.external_current_contact_id(auth.uid()))
      AND eur.status IN ('OPEN','IN_PROGRESS')
  ))
);

GRANT EXECUTE ON FUNCTION public.external_is_staff_manager() TO authenticated, service_role;

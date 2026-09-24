REVOKE EXECUTE ON FUNCTION public.external_current_contact_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.external_contact_has_access(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.external_is_current_contact(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.external_current_party_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.external_log_access(text, uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.external_current_contact_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.external_contact_has_access(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.external_is_current_contact(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.external_current_party_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.external_log_access(text, uuid, text, uuid, jsonb) TO authenticated, service_role;

DROP POLICY IF EXISTS external_staging_no_direct_access ON storage.objects;
CREATE POLICY external_staging_no_direct_access ON storage.objects
AS RESTRICTIVE FOR ALL TO authenticated
USING (bucket_id <> 'external-staging')
WITH CHECK (bucket_id <> 'external-staging');

ALTER TABLE public.external_share_snapshots
  DROP CONSTRAINT IF EXISTS external_share_snapshots_frozen_manifest_check;
ALTER TABLE public.external_share_snapshots
  ADD CONSTRAINT external_share_snapshots_frozen_manifest_check
  CHECK (share_mode <> 'FROZEN_SNAPSHOT' OR jsonb_array_length(manifest) > 0);

CREATE OR REPLACE FUNCTION public.external_review_response_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND NOT public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','projects.manage','quality.manage','procurement.manage'])
  THEN
    IF NEW.external_party_id IS DISTINCT FROM OLD.external_party_id
      OR NEW.external_contact_id IS DISTINCT FROM OLD.external_contact_id
      OR NEW.source_entity_type IS DISTINCT FROM OLD.source_entity_type
      OR NEW.source_entity_id IS DISTINCT FROM OLD.source_entity_id
      OR NEW.revision_reference IS DISTINCT FROM OLD.revision_reference
      OR NEW.request_type IS DISTINCT FROM OLD.request_type
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.status NOT IN ('VIEWED','IN_PROGRESS','CLARIFICATION_REQUIRED','RESPONDED')
    THEN
      RAISE EXCEPTION 'External users may only submit a response to their own review request';
    END IF;
    IF NEW.status IN ('RESPONDED','CLARIFICATION_REQUIRED') AND NEW.response IS NULL THEN
      RAISE EXCEPTION 'A response is required for this status';
    END IF;
    IF NEW.status IN ('RESPONDED','CLARIFICATION_REQUIRED') AND NEW.responded_at IS NULL THEN
      NEW.responded_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS external_review_response_guard_trigger ON public.external_review_requests;
CREATE TRIGGER external_review_response_guard_trigger
BEFORE UPDATE ON public.external_review_requests
FOR EACH ROW EXECUTE FUNCTION public.external_review_response_guard();
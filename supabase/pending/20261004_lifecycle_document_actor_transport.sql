-- UNAPPLIED REVIEW PROPOSAL. Requires the document-draft proposal and full
-- isolated Supabase/Storage/RLS acceptance before either route is enabled.
-- The trusted web server verifies the user JWT with requireSupabaseAuth, then
-- supplies only that verified subject. This endpoint is service-only; browsers
-- cannot call it. It does not sign JWTs, change credentials, grant authenticated
-- execution or replace business permission checks with a service-role bypass.

CREATE OR REPLACE FUNCTION public.execute_lifecycle_document_action(
  p_verified_actor_id uuid, p_operation text, p_arguments jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_expected text[];
  v_result jsonb;
  v_previous_sub text := current_setting('request.jwt.claim.sub', true);
  v_previous_role text := current_setting('request.jwt.claim.role', true);
  v_previous_claims text := current_setting('request.jwt.claims', true);
  v_previous_transition text := current_setting('lifecycle.template_transition', true);
  v_previous_transition_target text := current_setting('lifecycle.template_transition_target', true);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Lifecycle actor transport requires the trusted server role';
  END IF;
  IF p_verified_actor_id IS NULL THEN RAISE EXCEPTION 'Verified actor is required'; END IF;
  IF p_arguments IS NULL OR jsonb_typeof(p_arguments) <> 'object' THEN
    RAISE EXCEPTION 'Lifecycle arguments must be an object';
  END IF;

  CASE p_operation
    WHEN 'create_lifecycle_document_template_revision' THEN
      v_expected := ARRAY['p_template_id','p_content'];
    WHEN 'activate_lifecycle_document_template' THEN
      v_expected := ARRAY['p_template_id','p_template_document_revision_id'];
    WHEN 'retire_lifecycle_document_template' THEN
      v_expected := ARRAY['p_template_id'];
    WHEN 'authorize_lifecycle_document_draft' THEN
      v_expected := ARRAY['p_project_id','p_template_key','p_template_version','p_template_document_revision_id','p_request_key'];
    WHEN 'register_lifecycle_document_storage_attempt' THEN
      v_expected := ARRAY['p_project_id','p_template_key','p_template_version','p_template_document_revision_id','p_request_key','p_storage_bucket','p_storage_path','p_sha256_checksum','p_size_bytes'];
    WHEN 'find_lifecycle_document_draft_receipt' THEN
      v_expected := ARRAY['p_project_id','p_target_folder_id','p_template_key','p_template_version','p_template_document_revision_id','p_request_key'];
    WHEN 'commit_lifecycle_document_draft' THEN
      v_expected := ARRAY['p_project_id','p_target_folder_id','p_request_key','p_template_key','p_template_version','p_template_document_revision_id','p_file_name','p_mime_type','p_storage_bucket','p_storage_path','p_sha256_checksum','p_size_bytes'];
    WHEN 'can_discard_lifecycle_document_object' THEN
      v_expected := ARRAY['p_project_id','p_request_key','p_storage_bucket','p_storage_path'];
    ELSE RAISE EXCEPTION 'Unsupported lifecycle server operation';
  END CASE;
  IF NOT (p_arguments ?& v_expected) OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_arguments) argument(key)
    WHERE NOT (argument.key = ANY(v_expected))
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_expected) argument(key)
    WHERE p_arguments -> argument.key = 'null'::jsonb
  ) THEN
    RAISE EXCEPTION 'Lifecycle arguments do not match the protected operation';
  END IF;

  -- Request-local database identity, not a new token. Each underlying routine
  -- rechecks the actor's actual department/project permissions and provenance.
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', p_verified_actor_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', (
      coalesce(nullif(v_previous_claims, ''), '{}')::jsonb
      || jsonb_build_object('sub', p_verified_actor_id::text, 'role', 'authenticated')
    )::text, true);
    CASE p_operation
      WHEN 'create_lifecycle_document_template_revision' THEN
        SELECT coalesce(jsonb_agg(to_jsonb(receipt)), '[]'::jsonb) INTO v_result
        FROM public.create_lifecycle_document_template_revision(
          (p_arguments->>'p_template_id')::uuid, p_arguments->>'p_content'
        ) receipt;
      WHEN 'activate_lifecycle_document_template' THEN
        PERFORM public.activate_lifecycle_document_template(
          (p_arguments->>'p_template_id')::uuid, (p_arguments->>'p_template_document_revision_id')::uuid
        );
        v_result := 'null'::jsonb;
      WHEN 'retire_lifecycle_document_template' THEN
        PERFORM public.retire_lifecycle_document_template((p_arguments->>'p_template_id')::uuid);
        v_result := 'null'::jsonb;
      WHEN 'authorize_lifecycle_document_draft' THEN
        PERFORM public.authorize_lifecycle_document_draft(
          (p_arguments->>'p_project_id')::uuid, p_arguments->>'p_template_key',
          (p_arguments->>'p_template_version')::integer, (p_arguments->>'p_template_document_revision_id')::uuid,
          (p_arguments->>'p_request_key')::uuid
        );
        v_result := 'null'::jsonb;
      WHEN 'register_lifecycle_document_storage_attempt' THEN
        v_result := to_jsonb(public.register_lifecycle_document_storage_attempt(
          (p_arguments->>'p_project_id')::uuid, p_arguments->>'p_template_key',
          (p_arguments->>'p_template_version')::integer, (p_arguments->>'p_template_document_revision_id')::uuid,
          (p_arguments->>'p_request_key')::uuid, p_arguments->>'p_storage_bucket',
          p_arguments->>'p_storage_path', p_arguments->>'p_sha256_checksum', (p_arguments->>'p_size_bytes')::bigint
        ));
      WHEN 'find_lifecycle_document_draft_receipt' THEN
        SELECT coalesce(jsonb_agg(to_jsonb(receipt)), '[]'::jsonb) INTO v_result
        FROM public.find_lifecycle_document_draft_receipt(
          (p_arguments->>'p_project_id')::uuid, (p_arguments->>'p_target_folder_id')::uuid,
          p_arguments->>'p_template_key', (p_arguments->>'p_template_version')::integer,
          (p_arguments->>'p_template_document_revision_id')::uuid, (p_arguments->>'p_request_key')::uuid
        ) receipt;
      WHEN 'commit_lifecycle_document_draft' THEN
        SELECT coalesce(jsonb_agg(to_jsonb(receipt)), '[]'::jsonb) INTO v_result
        FROM public.commit_lifecycle_document_draft(
          (p_arguments->>'p_project_id')::uuid, (p_arguments->>'p_target_folder_id')::uuid,
          (p_arguments->>'p_request_key')::uuid, p_arguments->>'p_template_key',
          (p_arguments->>'p_template_version')::integer, (p_arguments->>'p_template_document_revision_id')::uuid,
          p_arguments->>'p_file_name', p_arguments->>'p_mime_type', p_arguments->>'p_storage_bucket',
          p_arguments->>'p_storage_path', p_arguments->>'p_sha256_checksum', (p_arguments->>'p_size_bytes')::bigint
        ) receipt;
      WHEN 'can_discard_lifecycle_document_object' THEN
        v_result := to_jsonb(public.can_discard_lifecycle_document_object(
          (p_arguments->>'p_project_id')::uuid, (p_arguments->>'p_request_key')::uuid,
          p_arguments->>'p_storage_bucket', p_arguments->>'p_storage_path'
        ));
    END CASE;
    PERFORM set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
    PERFORM set_config('request.jwt.claim.role', coalesce(v_previous_role, ''), true);
    PERFORM set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);
    PERFORM set_config('lifecycle.template_transition', coalesce(v_previous_transition, ''), true);
    PERFORM set_config('lifecycle.template_transition_target', coalesce(v_previous_transition_target, ''), true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
    PERFORM set_config('request.jwt.claim.role', coalesce(v_previous_role, ''), true);
    PERFORM set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);
    PERFORM set_config('lifecycle.template_transition', coalesce(v_previous_transition, ''), true);
    PERFORM set_config('lifecycle.template_transition_target', coalesce(v_previous_transition_target, ''), true);
    RAISE;
  END;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.execute_lifecycle_document_action(uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_lifecycle_document_action(uuid,text,jsonb)
  TO service_role;

-- ISOLATED-ENVIRONMENT ONLY — executable psql acceptance fixture.
-- Required variables: manager_user_id, outsider_user_id, project_id,
-- target_folder_id, template_key, template_version, template_revision_id,
-- request_key, conflict_target_folder_id, file_name, mime_type, storage_path,
-- sha256_checksum, size_bytes. The project/template/folder must be dedicated
-- isolated fixtures. Do not point this file at production or shared preview.
--
-- Usage example (isolated DB only):
-- psql "$ISOLATED_DATABASE_URL" -v manager_user_id=... -v outsider_user_id=... \
--   -v project_id=... -v target_folder_id=... -v template_key=... -v template_version=1 \
--   -v template_revision_id=... -v request_key=... -v conflict_target_folder_id=... \
--   -v file_name=... -v mime_type=text/plain -v storage_path=... -v sha256_checksum=... \
--   -v size_bytes=... -f supabase/pending/tests/lifecycle_document_draft_acceptance.sql

BEGIN;
SELECT set_config('lifecycle_test.sha256_checksum', :'sha256_checksum', false);
SELECT set_config('lifecycle_test.conflict_target_folder_id', :'conflict_target_folder_id', false);
SELECT set_config('lifecycle_test.file_name', :'file_name', false);
SELECT set_config('lifecycle_test.manager_user_id', :'manager_user_id', false);
SELECT set_config('lifecycle_test.mime_type', :'mime_type', false);
SELECT set_config('lifecycle_test.outsider_user_id', :'outsider_user_id', false);
SELECT set_config('lifecycle_test.project_id', :'project_id', false);
SELECT set_config('lifecycle_test.request_key', :'request_key', false);
SELECT set_config('lifecycle_test.size_bytes', :'size_bytes', false);
SELECT set_config('lifecycle_test.storage_path', :'storage_path', false);
SELECT set_config('lifecycle_test.target_folder_id', :'target_folder_id', false);
SELECT set_config('lifecycle_test.template_key', :'template_key', false);
SELECT set_config('lifecycle_test.template_revision_id', :'template_revision_id', false);
SELECT set_config('lifecycle_test.template_version', :'template_version', false);
SELECT set_config('request.jwt.claim.sub', :'manager_user_id', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

-- The server-owned upload receipt must be present before commit.
SELECT public.register_lifecycle_document_storage_attempt(
  :'project_id'::uuid, :'template_key', :'template_version'::integer, :'template_revision_id'::uuid,
  :'request_key'::uuid, 'project-drive', :'storage_path', :'sha256_checksum', :'size_bytes'::bigint
);

-- Authorization and deterministic first create. This result must contain one
-- FILE node, revision 1, DRAFT register, document-control REGISTERED event,
-- activity audit, and immutable receipt.
CREATE TEMP TABLE lifecycle_acceptance_first AS
SELECT * FROM public.commit_lifecycle_document_draft(
  :'project_id'::uuid, :'target_folder_id'::uuid, :'request_key'::uuid,
  :'template_key', :'template_version'::integer, :'template_revision_id'::uuid,
  :'file_name', :'mime_type', 'project-drive', :'storage_path',
  :'sha256_checksum', :'size_bytes'::bigint
);
DO $$
BEGIN
  IF (SELECT count(*) FROM lifecycle_acceptance_first) <> 1 THEN RAISE EXCEPTION 'Expected exactly one first-create receipt'; END IF;
END;
$$;

-- Same actor + exact payload must replay without additional Drive/register rows.
CREATE TEMP TABLE lifecycle_acceptance_replay AS
SELECT * FROM public.commit_lifecycle_document_draft(
  :'project_id'::uuid, :'target_folder_id'::uuid, :'request_key'::uuid,
  :'template_key', :'template_version'::integer, :'template_revision_id'::uuid,
  :'file_name', :'mime_type', 'project-drive', :'storage_path',
  :'sha256_checksum', :'size_bytes'::bigint
);
DO $$
BEGIN
  IF (SELECT node_id FROM lifecycle_acceptance_first) IS DISTINCT FROM (SELECT node_id FROM lifecycle_acceptance_replay) THEN RAISE EXCEPTION 'Replay created a second node'; END IF;
  IF (SELECT uses_staged_object FROM lifecycle_acceptance_replay) THEN RAISE EXCEPTION 'Replay retained a second staged object'; END IF;
END;
$$;

-- A semantic conflict uses the same project request key against another target.
DO $fixture$
DECLARE
  v_project_id uuid := current_setting('lifecycle_test.project_id')::uuid;
  v_conflict_target_folder_id uuid := current_setting('lifecycle_test.conflict_target_folder_id')::uuid;
  v_request_key uuid := current_setting('lifecycle_test.request_key')::uuid;
  v_template_key text := current_setting('lifecycle_test.template_key');
  v_template_version integer := current_setting('lifecycle_test.template_version')::integer;
  v_template_revision_id uuid := current_setting('lifecycle_test.template_revision_id')::uuid;
  v_file_name text := current_setting('lifecycle_test.file_name');
  v_mime_type text := current_setting('lifecycle_test.mime_type');
  v_storage_path text := current_setting('lifecycle_test.storage_path');
  v_sha256_checksum text := current_setting('lifecycle_test.sha256_checksum');
  v_size_bytes bigint := current_setting('lifecycle_test.size_bytes')::bigint;
BEGIN
  BEGIN
    PERFORM * FROM public.commit_lifecycle_document_draft(
      v_project_id, v_conflict_target_folder_id, v_request_key,
      v_template_key, v_template_version, v_template_revision_id,
      v_file_name, v_mime_type, 'project-drive', v_storage_path,
      v_sha256_checksum, v_size_bytes
    );
    RAISE EXCEPTION 'Expected request-key semantic conflict';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Request key conflicts with a different document draft payload' THEN RAISE; END IF;
  END;
END;
$fixture$;

-- An out-of-scope identity cannot read the bound receipt or discard its object.
SELECT set_config('request.jwt.claim.sub', :'outsider_user_id', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $fixture$
DECLARE
  v_project_id uuid := current_setting('lifecycle_test.project_id')::uuid;
  v_target_folder_id uuid := current_setting('lifecycle_test.target_folder_id')::uuid;
  v_template_key text := current_setting('lifecycle_test.template_key');
  v_template_version integer := current_setting('lifecycle_test.template_version')::integer;
  v_template_revision_id uuid := current_setting('lifecycle_test.template_revision_id')::uuid;
  v_request_key uuid := current_setting('lifecycle_test.request_key')::uuid;
  v_storage_path text := current_setting('lifecycle_test.storage_path');
  v_sha256_checksum text := current_setting('lifecycle_test.sha256_checksum');
  v_size_bytes bigint := current_setting('lifecycle_test.size_bytes')::bigint;
BEGIN
  BEGIN
    PERFORM * FROM public.find_lifecycle_document_draft_receipt(
      v_project_id, v_target_folder_id, v_template_key, v_template_version,
      v_template_revision_id, v_request_key
    );
    RAISE EXCEPTION 'Out-of-scope identity received a receipt';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Not authorized' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.register_lifecycle_document_storage_attempt(
      v_project_id, v_template_key, v_template_version, v_template_revision_id,
      gen_random_uuid(), 'project-drive', v_project_id::text || '/outsider-draft.txt', v_sha256_checksum, v_size_bytes
    );
    RAISE EXCEPTION 'Out-of-scope identity registered an attempt';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Not authorized' THEN RAISE; END IF;
  END;
  IF public.can_discard_lifecycle_document_object(
    v_project_id, v_request_key, 'project-drive', v_storage_path
  ) THEN
    RAISE EXCEPTION 'Out-of-scope identity may discard an object';
  END IF;
END;
$fixture$;

-- Roll back the fixture rows; an independent storage runner must remove the
-- staged object only after can_discard confirms every Drive reference is absent.
ROLLBACK;

-- This same psql connection now starts a fresh transaction. It proves the
-- rollback did not retain a receipt and returns true only for exact manager
-- cleanup of the no-longer-referenced staged object.
SELECT set_config('request.jwt.claim.sub', :'manager_user_id', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $fixture$
DECLARE
  v_project_id uuid := current_setting('lifecycle_test.project_id')::uuid;
  v_request_key uuid := current_setting('lifecycle_test.request_key')::uuid;
  v_storage_path text := current_setting('lifecycle_test.storage_path');
BEGIN
  IF EXISTS (SELECT 1 FROM public.project_lifecycle_document_drafts WHERE project_id = v_project_id AND request_key = v_request_key) THEN
    RAISE EXCEPTION 'ROLLBACK retained a lifecycle draft receipt';
  END IF;
  IF NOT public.can_discard_lifecycle_document_object(v_project_id, v_request_key, 'project-drive', v_storage_path) THEN
    RAISE EXCEPTION 'ROLLBACK did not leave the exact staged object eligible for verified cleanup';
  END IF;
END;
$fixture$;

-- The independent concurrency runner commits two distinct staged paths using
-- one request key and asserts one canonical receipt and losing-path cleanup.

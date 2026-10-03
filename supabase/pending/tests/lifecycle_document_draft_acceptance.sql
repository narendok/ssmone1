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
BEGIN
  BEGIN
    PERFORM * FROM public.commit_lifecycle_document_draft(
      :'project_id'::uuid, :'conflict_target_folder_id'::uuid, :'request_key'::uuid,
      :'template_key', :'template_version'::integer, :'template_revision_id'::uuid,
      :'file_name', :'mime_type', 'project-drive', :'storage_path',
      :'sha256_checksum', :'size_bytes'::bigint
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
BEGIN
  BEGIN
    PERFORM * FROM public.find_lifecycle_document_draft_receipt(
      :'project_id'::uuid, :'target_folder_id'::uuid, :'template_key', :'template_version'::integer,
      :'template_revision_id'::uuid, :'request_key'::uuid
    );
    RAISE EXCEPTION 'Out-of-scope identity received a receipt';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Not authorized' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.register_lifecycle_document_storage_attempt(
      :'project_id'::uuid, :'template_key', :'template_version'::integer, :'template_revision_id'::uuid,
      gen_random_uuid(), 'project-drive', :'project_id' || '/outsider-draft.txt', :'sha256_checksum', :'size_bytes'::bigint
    );
    RAISE EXCEPTION 'Out-of-scope identity registered an attempt';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Not authorized' THEN RAISE; END IF;
  END;
  IF public.can_discard_lifecycle_document_object(
    :'project_id'::uuid, :'request_key'::uuid, 'project-drive', :'storage_path'
  ) THEN
    RAISE EXCEPTION 'Out-of-scope identity may discard an object';
  END IF;
END;
$fixture$;

-- Roll back the fixture rows; an independent storage runner must remove the
-- staged object only after can_discard confirms every Drive reference is absent.
ROLLBACK;

-- Rollback proof: this outer transaction leaves no receipt, node, revision,
-- register, audit record, or consumed attempt after ROLLBACK. The runner must
-- call can_discard as the manager after rollback, then remove the isolated
-- object only when it returns true.
-- Concurrency is provided by lifecycle_document_draft_concurrency.sh, which
-- executes two psql sessions with distinct staged objects and asserts one
-- semantic receipt plus cleanup permission only for the losing path.
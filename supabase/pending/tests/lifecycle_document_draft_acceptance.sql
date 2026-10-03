-- ISOLATED-ENVIRONMENT ONLY — executable psql acceptance fixture.
-- Required variables: manager_user_id, outsider_user_id, project_id,
-- target_folder_id, template_key, template_version, template_revision_id,
-- request_key, source_fingerprint, file_name, mime_type, storage_path,
-- sha256_checksum, size_bytes. The project/template/folder must be dedicated
-- isolated fixtures. Do not point this file at production or shared preview.
--
-- Usage example (isolated DB only):
-- psql "$ISOLATED_DATABASE_URL" -v manager_user_id=... -v outsider_user_id=... \
--   -v project_id=... -v target_folder_id=... -v template_key=... -v template_version=1 \
--   -v template_revision_id=... -v request_key=... -v source_fingerprint=... \
--   -v file_name=... -v mime_type=text/plain -v storage_path=... -v sha256_checksum=... \
--   -v size_bytes=... -f supabase/pending/tests/lifecycle_document_draft_acceptance.sql

BEGIN;
SELECT set_config('request.jwt.claim.sub', :'manager_user_id', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- Authorization and deterministic first create. This result must contain one
-- FILE node, revision 1, DRAFT register, document-control REGISTERED event,
-- activity audit, and immutable receipt.
CREATE TEMP TABLE lifecycle_acceptance_first AS
SELECT * FROM public.commit_lifecycle_document_draft(
  :'project_id'::uuid, :'target_folder_id'::uuid, :'request_key'::uuid,
  :'source_fingerprint', :'template_key', :'template_version'::integer,
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
  :'source_fingerprint', :'template_key', :'template_version'::integer,
  :'file_name', :'mime_type', 'project-drive', :'storage_path',
  :'sha256_checksum', :'size_bytes'::bigint
);
DO $$
BEGIN
  IF (SELECT node_id FROM lifecycle_acceptance_first) IS DISTINCT FROM (SELECT node_id FROM lifecycle_acceptance_replay) THEN RAISE EXCEPTION 'Replay created a second node'; END IF;
  IF (SELECT uses_staged_object FROM lifecycle_acceptance_replay) THEN RAISE EXCEPTION 'Replay retained a second staged object'; END IF;
END;
$$;

-- A changed fingerprint with the same project key must conflict.
DO $$
BEGIN
  BEGIN
    PERFORM public.commit_lifecycle_document_draft(
      :'project_id'::uuid, :'target_folder_id'::uuid, :'request_key'::uuid,
      :'source_fingerprint' || '-conflict', :'template_key', :'template_version'::integer,
      :'file_name', :'mime_type', 'project-drive', :'storage_path', :'sha256_checksum', :'size_bytes'::bigint);
    RAISE EXCEPTION 'Expected conflicting replay rejection';
  EXCEPTION WHEN others THEN
    IF position('conflicts' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END;
$$;

-- An out-of-scope identity cannot read the bound receipt or discard its object.
SELECT set_config('request.jwt.claim.sub', :'outsider_user_id', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.find_lifecycle_document_draft_receipt(
    :'project_id'::uuid, :'target_folder_id'::uuid, :'template_key', :'template_version'::integer,
    :'template_revision_id'::uuid, :'request_key'::uuid, :'source_fingerprint')) THEN
    RAISE EXCEPTION 'Out-of-scope identity received a receipt';
  END IF;
  IF public.can_discard_lifecycle_document_object(:'project_id'::uuid, :'request_key'::uuid, 'project-drive', :'storage_path') THEN
    RAISE EXCEPTION 'Out-of-scope identity may discard an object';
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  -- Service-only RPC denial is the expected least-privilege result.
  NULL;
END;
$$;

-- Roll back the fixture rows; an independent storage runner must remove the
-- staged object only after can_discard confirms every Drive reference is absent.
ROLLBACK;

-- CONCURRENCY: run this same file in two isolated psql sessions with the same
-- manager identity, request_key, and payload. Assert exactly one receipt and
-- one Drive FILE/revision/register after both sessions finish. Re-run one
-- session with the same project/request_key but a different fingerprint and
-- assert a conflict. This requires two database connections and cannot be
-- faithfully simulated inside one SQL transaction.
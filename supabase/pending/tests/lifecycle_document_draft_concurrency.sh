#!/usr/bin/env bash
set -euo pipefail

# ISOLATED ENVIRONMENT ONLY. Required environment variables match the SQL
# fixture plus ISOLATED_DATABASE_URL, REQUEST_KEY_A, REQUEST_KEY_B,
# STORAGE_PATH_A and STORAGE_PATH_B. Both request keys must be the same to
# prove semantic replay; paths must differ to prove losing-attempt cleanup.
: "${ISOLATED_DATABASE_URL:?}" "${MANAGER_USER_ID:?}" "${PROJECT_ID:?}"
: "${TARGET_FOLDER_ID:?}" "${TEMPLATE_KEY:?}" "${TEMPLATE_VERSION:?}"
: "${TEMPLATE_REVISION_ID:?}" "${REQUEST_KEY_A:?}" "${REQUEST_KEY_B:?}"
: "${FILE_NAME:?}" "${SHA256_CHECKSUM:?}" "${SIZE_BYTES:?}"
: "${STORAGE_PATH_A:?}" "${STORAGE_PATH_B:?}"

run_attempt() {
  local request_key="$1" storage_path="$2"
  psql "$ISOLATED_DATABASE_URL" --set=ON_ERROR_STOP=1 \
    -v manager_user_id="$MANAGER_USER_ID" -v project_id="$PROJECT_ID" \
    -v target_folder_id="$TARGET_FOLDER_ID" -v template_key="$TEMPLATE_KEY" \
    -v template_version="$TEMPLATE_VERSION" -v template_revision_id="$TEMPLATE_REVISION_ID" \
    -v request_key="$request_key" -v file_name="$FILE_NAME" -v mime_type=text/plain \
    -v storage_path="$storage_path" -v sha256_checksum="$SHA256_CHECKSUM" -v size_bytes="$SIZE_BYTES" <<'SQL'
BEGIN;
SELECT set_config('request.jwt.claim.sub', :'manager_user_id', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT public.register_lifecycle_document_storage_attempt(
  :'project_id'::uuid, :'template_key', :'template_version'::integer, :'template_revision_id'::uuid,
  :'request_key'::uuid, 'project-drive', :'storage_path', :'sha256_checksum', :'size_bytes'::bigint
);
SELECT * FROM public.commit_lifecycle_document_draft(
  :'project_id'::uuid, :'target_folder_id'::uuid, :'request_key'::uuid,
  :'template_key', :'template_version'::integer, :'template_revision_id'::uuid,
  :'file_name', :'mime_type', 'project-drive', :'storage_path', :'sha256_checksum', :'size_bytes'::bigint
);
COMMIT;
SQL
}

run_attempt "$REQUEST_KEY_A" "$STORAGE_PATH_A" & first=$!
run_attempt "$REQUEST_KEY_B" "$STORAGE_PATH_B" & second=$!
wait "$first"; wait "$second"

psql "$ISOLATED_DATABASE_URL" --set=ON_ERROR_STOP=1 \
  -v project_id="$PROJECT_ID" -v request_key="$REQUEST_KEY_A" <<'SQL'
DO $assert$
BEGIN
  IF (SELECT count(*) FROM public.project_lifecycle_document_drafts
      WHERE project_id = :'project_id'::uuid AND request_key = :'request_key'::uuid) <> 1 THEN
    RAISE EXCEPTION 'Concurrent replay did not converge to exactly one receipt';
  END IF;
END;
$assert$;
SQL
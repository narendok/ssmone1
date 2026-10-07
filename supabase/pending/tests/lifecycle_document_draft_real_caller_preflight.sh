#!/usr/bin/env bash
set -euo pipefail

# READ-ONLY, FAIL-CLOSED PREFLIGHT. This script does not upload, call SaveDraft,
# invoke an RPC, write SQL, or create fixtures. Run only after an approved
# operator supplies a local, redacted acceptance manifest for the isolated remix.
#
# Usage:
#   ACCEPTANCE_MANIFEST=/secure/path/lifecycle-save-draft-isolated.env \
#     bash supabase/pending/tests/lifecycle_document_draft_real_caller_preflight.sh
#
# The manifest is deliberately not stored in this repository. It may contain
# identifiers but must not contain a password, bearer token, connection string,
# service key, or email address.

: "${ACCEPTANCE_MANIFEST:?Set ACCEPTANCE_MANIFEST to the approved local manifest path.}"
if [[ ! -r "$ACCEPTANCE_MANIFEST" ]]; then
  echo "FAIL: acceptance manifest is absent or unreadable; no check was run." >&2
  exit 2
fi

# shellcheck disable=SC1090
source "$ACCEPTANCE_MANIFEST"

required=(
  ACCEPTANCE_BACKEND_REF
  MANAGER_CALLER_APPROVED
  MANAGER_CALLER_LOGIN_CAPABLE
  MANAGER_CALLER_NON_ADMIN
  OUTSIDER_CALLER_APPROVED
  OUTSIDER_CALLER_LOGIN_CAPABLE
  OUTSIDER_CALLER_NON_ADMIN
  AUTHENTICATED_APP_TRANSPORT_READY
  ISOLATED_PROJECT_READY
  ISOLATED_TARGET_FOLDER_READY
  ACTIVE_TEMPLATE_PIN_READY
  PROJECT_DRIVE_STORAGE_POLICY_READY
  PHYSICAL_STORAGE_UPLOAD_DOWNLOAD_READY
  OBSERVABILITY_READBACK_READY
)

for key in "${required[@]}"; do
  if [[ "${!key-}" != "yes" ]]; then
    echo "FAIL: $key must be exactly yes; no caller acceptance was run." >&2
    exit 3
  fi
done

if [[ "$ACCEPTANCE_BACKEND_REF" != "egjotuxqguifnvdnflan" ]]; then
  echo "FAIL: target is not the isolated remix; refusing to continue." >&2
  exit 4
fi

if [[ "${ORIGINAL_BACKEND_REF-}" == "yyrvduosyyaluifqvwkr" ]]; then
  echo "FAIL: manifest names the original backend; refusing to continue." >&2
  exit 5
fi

echo "PASS: isolated real-caller prerequisites are declared complete."
echo "NEXT: run the authenticated application cases in lifecycle_document_draft_real_caller_acceptance.md."
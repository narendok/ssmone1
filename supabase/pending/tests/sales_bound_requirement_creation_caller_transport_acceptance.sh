#!/usr/bin/env bash
# REAL CALLER-TRANSPORT ACCEPTANCE SPECIFICATION — intentionally non-executable until
# an approved isolated target and two independently authenticated non-service callers
# are supplied. This script refuses every unspecified/original target; it never sets
# request.jwt.claim.* and never connects with a service-role credential.
set -euo pipefail

: "${ISOLATED_TARGET_NAME:?Name the approved isolated target}"
: "${APPROVED_ISOLATED_TARGET_NAME:?Expected approved isolated target name}"
: "${SALES_CALLER_TRANSPORT:?Executable that sends one authenticated Sales RPC call}"
: "${SOURCE_EDITOR_TRANSPORT:?Executable that sends one authenticated controlled source-save call}"
: "${OPPORTUNITY_ID:?}" "${CUSTOMER_ID:?}" "${MASTER_VERSION_ID:?}" "${SPECIFICATION_ID:?}"
: "${REQUEST_KEY:?}" "${REQUEST_KEY_B:?}" "${EXPECTED_VERSION:?}"

if [[ "$ISOLATED_TARGET_NAME" != "$APPROVED_ISOLATED_TARGET_NAME" ]]; then
  echo "Refusing unapproved isolated target" >&2
  exit 64
fi
if [[ "${ORIGINAL_TARGET_NAME:-}" == "$ISOLATED_TARGET_NAME" ]]; then
  echo "Refusing original target" >&2
  exit 64
fi

# Transport wrappers must take JSON on stdin, return JSON on stdout, and use their
# caller's own authenticated application/session transport. They must not interpolate
# SQL, set JWT GUCs, use database superuser credentials, or use service_role.
call_sales() { "$SALES_CALLER_TRANSPORT"; }
call_editor() { "$SOURCE_EDITOR_TRANSPORT"; }

create_payload() {
  local key="$1" version="$2" title="$3"
  jq -cn --arg opportunityId "$OPPORTUNITY_ID" --arg customerId "$CUSTOMER_ID" \
    --arg masterSpecificationVersionId "$version" --arg requestKey "$key" --arg title "$title" \
    '{opportunityId:$opportunityId,customerId:$customerId,masterSpecificationVersionId:$masterSpecificationVersionId,requestKey:$requestKey,title:$title,customerReference:"TRANSPORT-ACCEPT",summary:"Isolated acceptance only."}'
}

first="$(create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Transport acceptance requirement" | call_sales)"
first_id="$(jq -er '.id' <<<"$first")"
retry="$(create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Transport acceptance requirement" | call_sales)"
test "$first_id" = "$(jq -er '.id' <<<"$retry")"

# Changed payload must fail; the wrapper's nonzero status is asserted without SQL text.
if create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Changed title" | call_sales >/dev/null 2>&1; then
  echo "Changed-payload replay unexpectedly succeeded" >&2; exit 1
fi

# The controlled editor advances the source with the current expected version.
# A fresh key intentionally reuses the historical MASTER_VERSION_ID and must fail.
jq -cn --arg specificationId "$SPECIFICATION_ID" --arg opportunityId "$OPPORTUNITY_ID" \
  --arg customerId "$CUSTOMER_ID" --argjson expectedVersion "$EXPECTED_VERSION" \
  '{specificationId:$specificationId,opportunityId:$opportunityId,customerId:$customerId,expectedVersion:$expectedVersion}' | call_editor >/dev/null
replay="$(create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Transport acceptance requirement" | call_sales)"
test "$first_id" = "$(jq -er '.id' <<<"$replay")"
if create_payload "$REQUEST_KEY_B" "$MASTER_VERSION_ID" "Fresh stale version" | call_sales >/dev/null 2>&1; then
  echo "Fresh stale-version creation unexpectedly succeeded" >&2; exit 1
fi

# The approved runner must additionally perform exact count/rollback assertions and
# overlap two wrapper invocations: protected create first, protected source update
# second. Capture timestamps plus returned IDs and prove the update waits for the
# create instead of reproducing locks with direct SQL.
echo "MANUAL RUNNER STEP REQUIRED: assert audited counts, forced-audit rollback, and protected-create/source-update overlap through caller transport."

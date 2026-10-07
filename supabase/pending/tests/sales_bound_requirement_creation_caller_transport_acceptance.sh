#!/usr/bin/env bash
# REAL CALLER-TRANSPORT ACCEPTANCE HARNESS — intentionally refuses execution until an
# approved isolated target and authenticated non-service wrappers are supplied. It never
# sets request.jwt.claim.* and never connects with a service-role credential. The caller
# wrappers must expose protected requirement, source editor, baseline, commercial, and
# controlled review-transition operations over authenticated application transport.
set -euo pipefail

: "${ISOLATED_TARGET_NAME:?Name the approved isolated target}"
: "${APPROVED_ISOLATED_TARGET_NAME:?Expected approved isolated target name}"
: "${SALES_CALLER_TRANSPORT:?Executable that sends one authenticated Sales RPC call}"
: "${SOURCE_EDITOR_TRANSPORT:?Executable that sends one authenticated controlled source-save call}"
: "${BASELINE_CALLER_TRANSPORT:?Executable that sends one authenticated baseline RPC call}"
: "${COMMERCIAL_EDITOR_TRANSPORT:?Executable that sends one authenticated protected commercial-save call}"
: "${REVIEW_TRANSITION_TRANSPORT:?Executable that sends one authenticated protected review transition}"
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
call_baseline() { "$BASELINE_CALLER_TRANSPORT"; }
call_commercial() { "$COMMERCIAL_EDITOR_TRANSPORT"; }
call_review_transition() { "$REVIEW_TRANSITION_TRANSPORT"; }

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

# The approved runner must additionally use the wrappers above (never direct SQL) to:
# - assert exact baseline/audit/receipt counts and forced-audit rollback;
# - run the protected-create/source-update overlap, proving the editor waits;
# - overlap baseline approval with reviewer response/reassignment and protected commercial
#   authorization update, proving each waits and the baseline snapshot is coherent;
# - repeat a successful baseline call after a permitted source advance, asserting the
#   same authenticated actor/key/payload receives the historical ID while changed actor
#   or payload rejects; and
# - overlap two authenticated baseline calls with one key and prove exactly one result.
printf '%s\n' "MANUAL RUNNER STEP REQUIRED: complete protected transport count, rollback, replay, and overlap assertions."

# Commercial contract assertions are deliberately executable only through the supplied
# authenticated wrapper. The wrapper must return a JSON object containing `id` and
# `revisionNumber`; it must not use SQL transport or service credentials.
commercial_payload() {
  local key="$1" expected_revision="$2" amount="$3"
  jq -cn --arg requirementId "$REQUIREMENT_ID" --arg requestKey "$key" \
    --argjson expectedRevisionNumber "$expected_revision" --argjson quotedAmount "$amount" \
    '{requirementId:$requirementId,requestKey:$requestKey,expectedRevisionNumber:$expectedRevisionNumber,quotationReference:"TRANSPORT-COMMERCIAL",currency:"INR",quotedAmount:$quotedAmount,status:"sent",authorizationReference:null,notes:"Isolated acceptance only."}'
}

: "${REQUEST_KEY_COMMERCIAL:?}" "${REQUEST_KEY_COMMERCIAL_B:?}" "${REQUIREMENT_ID:?}" "${COMMERCIAL_EXPECTED_REVISION:?}"
commercial_first="$(commercial_payload "$REQUEST_KEY_COMMERCIAL" "$COMMERCIAL_EXPECTED_REVISION" 100 | call_commercial)"
commercial_id="$(jq -er '.id' <<<"$commercial_first")"
commercial_revision="$(jq -er '.revisionNumber' <<<"$commercial_first")"
commercial_retry="$(commercial_payload "$REQUEST_KEY_COMMERCIAL" "$COMMERCIAL_EXPECTED_REVISION" 100 | call_commercial)"
test "$commercial_id" = "$(jq -er '.id' <<<"$commercial_retry")"
test "$commercial_revision" = "$(jq -er '.revisionNumber' <<<"$commercial_retry")"
if commercial_payload "$REQUEST_KEY_COMMERCIAL" "$COMMERCIAL_EXPECTED_REVISION" 101 | call_commercial >/dev/null 2>&1; then
  echo "Changed commercial replay unexpectedly succeeded" >&2; exit 1
fi
if commercial_payload "$REQUEST_KEY_COMMERCIAL_B" "$COMMERCIAL_EXPECTED_REVISION" 102 | call_commercial >/dev/null 2>&1; then
  echo "Stale commercial revision unexpectedly succeeded" >&2; exit 1
fi

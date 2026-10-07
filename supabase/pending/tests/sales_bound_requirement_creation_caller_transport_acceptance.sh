#!/usr/bin/env bash
# REAL CALLER-TRANSPORT ACCEPTANCE HARNESS — intentionally refuses execution until an
# approved isolated target, authenticated non-service wrappers, and read-only assertion
# transport are supplied. It never sets request.jwt.claim.* and never connects with a
# service-role credential. Each wrapper must expose one protected operation over its own
# authenticated application/session transport and return JSON on stdout.
set -euo pipefail

: "${ISOLATED_TARGET_NAME:?Name the approved isolated target}"
: "${APPROVED_ISOLATED_TARGET_NAME:?Expected approved isolated target name}"
: "${SALES_CALLER_TRANSPORT:?Executable that sends one authenticated Sales RPC call}"
: "${SOURCE_EDITOR_TRANSPORT:?Executable that sends one authenticated controlled source-save call}"
: "${BASELINE_CALLER_TRANSPORT:?Executable that sends one authenticated baseline RPC call}"
: "${COMMERCIAL_EDITOR_TRANSPORT:?Executable that sends one authenticated protected commercial-save call}"
: "${REVIEW_TRANSITION_TRANSPORT:?Executable that sends one authenticated protected review transition}"
: "${READ_ASSERT_TRANSPORT:?Executable that performs approved read-only persisted-state assertions}"
: "${SALES_SECOND_CALLER_TRANSPORT:?Executable that sends one authenticated Sales call as a second approved caller}"
: "${REVIEWER_CALLER_TRANSPORT:?Executable that sends one authenticated reviewer decision as the assigned reviewer}"
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
read_assert() { "$READ_ASSERT_TRANSPORT"; }
call_sales_second() { "$SALES_SECOND_CALLER_TRANSPORT"; }
call_reviewer() { "$REVIEWER_CALLER_TRANSPORT"; }

assert_count() {
  local entity="$1" expected="$2" where="$3"
  local actual
  actual="$(jq -cn --arg entity "$entity" --arg where "$where" '{kind:"count",entity:$entity,where:$where}' | read_assert | jq -er '.count')"
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected $entity count $expected, got $actual for $where" >&2
    exit 1
  fi
}

assert_id() {
  local entity="$1" expected="$2" where="$3"
  local actual
  actual="$(jq -cn --arg entity "$entity" --arg where "$where" '{kind:"id",entity:$entity,where:$where}' | read_assert | jq -er '.id')"
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected $entity ID $expected, got $actual for $where" >&2
    exit 1
  fi
}

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
assert_id "sales_requirement_creation_requests" "$first_id" "request_key=$REQUEST_KEY"
assert_count "customer_requirements" 1 "request_key=$REQUEST_KEY"
assert_count "customer_requirement_revisions" 1 "requirement_id=$first_id;revision_number=1"
assert_count "activity_log" 1 "entity_id=$first_id;action=source_bound_created"
assert_count "sales_requirement_creation_requests" 1 "request_key=$REQUEST_KEY"

# Changed payload must fail; the wrapper's nonzero status is asserted without SQL text.
if create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Changed title" | call_sales >/dev/null 2>&1; then
  echo "Changed-payload replay unexpectedly succeeded" >&2; exit 1
fi
if create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Wrong customer" | call_sales_second >/dev/null 2>&1; then
  echo "Wrong actor/customer replay unexpectedly succeeded" >&2; exit 1
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

# The runner supplies a deliberately rejected operation with an approved isolated
# failure-injection key. Every mutation must roll back, including its receipt/audit.
: "${ROLLBACK_REQUEST_KEY:?}" "${FAILURE_INJECTION_TOKEN:?}"
rollback_payload="$(create_payload "$ROLLBACK_REQUEST_KEY" "$MASTER_VERSION_ID" "Forced rollback")"
if jq --arg failureInjection "$FAILURE_INJECTION_TOKEN" '. + {failureInjection:$failureInjection}' <<<"$rollback_payload" | call_sales >/dev/null 2>&1; then
  echo "Forced requirement audit rollback unexpectedly succeeded" >&2; exit 1
fi
assert_count "customer_requirements" 0 "request_key=$ROLLBACK_REQUEST_KEY"
assert_count "customer_requirement_revisions" 0 "request_key=$ROLLBACK_REQUEST_KEY"
assert_count "activity_log" 0 "request_key=$ROLLBACK_REQUEST_KEY"
assert_count "sales_requirement_creation_requests" 0 "request_key=$ROLLBACK_REQUEST_KEY"

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
assert_count "sales_commercial_records" 1 "requirement_id=$REQUIREMENT_ID"
assert_count "sales_commercial_record_revisions" 1 "commercial_record_id=$commercial_id;revision_number=$commercial_revision"
assert_count "sales_commercial_save_requests" 1 "request_key=$REQUEST_KEY_COMMERCIAL"
assert_count "activity_log" 1 "entity_id=$commercial_id;action=saved"
if commercial_payload "$REQUEST_KEY_COMMERCIAL" "$COMMERCIAL_EXPECTED_REVISION" 101 | call_commercial >/dev/null 2>&1; then
  echo "Changed commercial replay unexpectedly succeeded" >&2; exit 1
fi
if commercial_payload "$REQUEST_KEY_COMMERCIAL_B" "$COMMERCIAL_EXPECTED_REVISION" 102 | call_commercial >/dev/null 2>&1; then
  echo "Stale commercial revision unexpectedly succeeded" >&2; exit 1
fi

# Prerequisite feasibility decision is exercised as the assigned reviewer, never the
# Sales caller. Wrong reviewer/version/requirement-customer pairing must be rejected.
: "${REVIEW_ID:?}" "${REVIEWER_REQUEST_KEY:?}" "${BASELINE_REQUEST_KEY:?}"
review_payload="$(jq -cn --arg reviewId "$REVIEW_ID" --arg requestKey "$REVIEWER_REQUEST_KEY" '{reviewId:$reviewId,requestKey:$requestKey,status:"feasible",findings:"Isolated acceptance decision",assumptions:null,risks:null}')"
review_result="$(printf '%s' "$review_payload" | call_reviewer)"
test "$REVIEW_ID" = "$(jq -er '.id' <<<"$review_result")"
assert_count "activity_log" 1 "entity_id=$REVIEW_ID;action=responded"
if jq '.reviewId = "00000000-0000-0000-0000-000000000000"' <<<"$review_payload" | call_reviewer >/dev/null 2>&1; then
  echo "Wrong review/version decision unexpectedly succeeded" >&2; exit 1
fi

baseline_payload="$(jq -cn --arg requirementId "$REQUIREMENT_ID" --arg requestKey "$BASELINE_REQUEST_KEY" --argjson expectedRevisionNumber 1 '{requirementId:$requirementId,requestKey:$requestKey,expectedRevisionNumber:$expectedRevisionNumber}')"
baseline_first="$(printf '%s' "$baseline_payload" | call_baseline)"
baseline_id="$(jq -er '.id' <<<"$baseline_first")"
baseline_retry="$(printf '%s' "$baseline_payload" | call_baseline)"
test "$baseline_id" = "$(jq -er '.id' <<<"$baseline_retry")"
assert_count "requirement_baselines" 1 "id=$baseline_id"
assert_count "sales_baseline_approval_requests" 1 "request_key=$BASELINE_REQUEST_KEY"
assert_count "activity_log" 1 "entity_id=$baseline_id;action=approved"

# A real two-session barrier is mandatory: wrappers must accept the test barrier field,
# wait until both requests are present, and return only after the protected transaction.
: "${CONCURRENCY_BARRIER_ID:?}" "${CONCURRENT_REQUEST_KEY:?}" "${CONCURRENT_REQUEST_KEY_B:?}"
concurrent_payload="$(create_payload "$CONCURRENT_REQUEST_KEY" "$MASTER_VERSION_ID" "Two-session concurrency" | jq --arg barrier "$CONCURRENCY_BARRIER_ID" '. + {barrier:$barrier}')"
concurrent_payload_b="$(create_payload "$CONCURRENT_REQUEST_KEY_B" "$MASTER_VERSION_ID" "Two-session concurrency B" | jq --arg barrier "$CONCURRENCY_BARRIER_ID" '. + {barrier:$barrier}')"
printf '%s' "$concurrent_payload" | call_sales >"${TMPDIR:-/tmp}/sales-create-a.json" & pid_a=$!
printf '%s' "$concurrent_payload_b" | call_sales_second >"${TMPDIR:-/tmp}/sales-create-b.json" & pid_b=$!
wait "$pid_a"; wait "$pid_b"
concurrent_a="$(jq -er '.id' "${TMPDIR:-/tmp}/sales-create-a.json")"
concurrent_b="$(jq -er '.id' "${TMPDIR:-/tmp}/sales-create-b.json")"
if [[ "$concurrent_a" == "$concurrent_b" ]]; then
  echo "Distinct concurrent request keys unexpectedly returned one requirement" >&2; exit 1
fi
assert_count "customer_requirements" 2 "barrier=$CONCURRENCY_BARRIER_ID"
assert_count "sales_requirement_creation_requests" 2 "barrier=$CONCURRENCY_BARRIER_ID"

#!/usr/bin/env bash
# ISOLATED ACCEPTANCE ONLY. Do not run against production and never use service-role impersonation.
# Required environment: DATABASE_URL, SALES_MANAGER_ID, OPPORTUNITY_ID, CUSTOMER_ID,
# MASTER_VERSION_ID, REQUEST_KEY, ADVANCE_EXPECTED_VERSION, ADVANCE_TITLE,
# ADVANCE_SUMMARY, ADVANCE_SPECIFICATION_DATA. The runner supplies a dedicated isolated tuple.
set -euo pipefail

: "${DATABASE_URL:?}" "${SALES_MANAGER_ID:?}" "${OPPORTUNITY_ID:?}" "${CUSTOMER_ID:?}"
: "${MASTER_VERSION_ID:?}" "${REQUEST_KEY:?}" "${ADVANCE_EXPECTED_VERSION:?}"
: "${ADVANCE_TITLE:?}" "${ADVANCE_SUMMARY:?}" "${ADVANCE_SPECIFICATION_DATA:?}"

tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT

caller_prelude="SET LOCAL request.jwt.claim.sub = '${SALES_MANAGER_ID}'; SET LOCAL role = authenticated;"
create_call="SELECT public.create_sales_bound_customer_requirement('${OPPORTUNITY_ID}'::uuid, '${CUSTOMER_ID}'::uuid, '${MASTER_VERSION_ID}'::uuid, 'Concurrency acceptance requirement', 'LOCK-ACCEPT', 'Acceptance-only summary.', '${REQUEST_KEY}'::uuid);"

# Replay after Master version advance: the first committed write is created on an isolated source.
printf "BEGIN; %s %s COMMIT;" "$caller_prelude" "$create_call" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/created-id"
created_id="$(tail -n 3 "$tmp_dir/created-id" | head -n 1 | tr -d '[:space:]')"

# Advance via the existing caller-authenticated controlled save. This must make MASTER_VERSION_ID historical.
printf "BEGIN; %s SELECT * FROM public.save_master_specification_version(NULL, '${OPPORTUNITY_ID}'::uuid, '${CUSTOMER_ID}'::uuid, '${ADVANCE_TITLE}', ${ADVANCE_EXPECTED_VERSION}, '${ADVANCE_SUMMARY}', '${ADVANCE_SPECIFICATION_DATA}'::jsonb); COMMIT;" "$caller_prelude" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null
printf "BEGIN; %s %s COMMIT;" "$caller_prelude" "$create_call" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/replayed-id"
replayed_id="$(tail -n 3 "$tmp_dir/replayed-id" | head -n 1 | tr -d '[:space:]')"
test "$created_id" = "$replayed_id" || { echo "Replay after Master version advance returned a different requirement" >&2; exit 1; }

# Changed-payload conflict must reject and leave the receipt result unchanged.
if printf "BEGIN; %s SELECT public.create_sales_bound_customer_requirement('${OPPORTUNITY_ID}'::uuid, '${CUSTOMER_ID}'::uuid, '${MASTER_VERSION_ID}'::uuid, 'Changed title', 'LOCK-ACCEPT', 'Acceptance-only summary.', '${REQUEST_KEY}'::uuid); ROLLBACK;" "$caller_prelude" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/conflict" 2>&1; then
  echo "Changed-payload conflict unexpectedly succeeded" >&2; exit 1
fi
grep -q "Request key conflicts with a different caller or payload" "$tmp_dir/conflict"

# Concurrent source update blocks: hold the same opportunity/specification locks in session A.
# This test performs no source mutation: B uses lock_timeout and only proves it cannot pass the lock.
printf "BEGIN; %s SELECT 1 FROM public.sales_opportunities WHERE id = '${OPPORTUNITY_ID}'::uuid FOR UPDATE; SELECT 1 FROM public.master_specifications WHERE opportunity_id = '${OPPORTUNITY_ID}'::uuid FOR UPDATE; SELECT pg_sleep(8); ROLLBACK;" "$caller_prelude" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/holder" 2>&1 &
holder_pid=$!
sleep 1

# Concurrent source update blocks: a source editor cannot update current_version while A holds the source locks.
if printf "BEGIN; %s SET LOCAL lock_timeout = '500ms'; UPDATE public.master_specifications SET current_version = current_version WHERE opportunity_id = '${OPPORTUNITY_ID}'::uuid; ROLLBACK;" "$caller_prelude" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/blocker" 2>&1; then
  echo "Concurrent source update blocks: expected lock timeout" >&2; exit 1
fi
grep -Eq "canceling statement due to lock timeout|Lock" "$tmp_dir/blocker"

# The server must show a lock wait while B is attempted. The lock_timeout result above is the assertion;
# observability runners may additionally inspect pg_stat_activity.wait_event_type = 'Lock' during the interval.
wait "$holder_pid"
echo "PASS: replay-after-version-advance, changed-payload conflict, and concurrent source update blocking"
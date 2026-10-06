#!/usr/bin/env bash
# ISOLATED ACCEPTANCE ONLY. Do not run against production and never use service-role impersonation.
# Required environment: DATABASE_URL, SALES_MANAGER_ID, OPPORTUNITY_ID, CUSTOMER_ID,
# MASTER_VERSION_ID, SPECIFICATION_ID, REQUEST_KEY, REQUEST_KEY_B, ADVANCE_EXPECTED_VERSION,
# ADVANCE_TITLE, ADVANCE_SUMMARY, ADVANCE_SPECIFICATION_DATA. The runner supplies a dedicated
# isolated tuple. It must use an authenticated Sales caller and never service-role impersonation.
set -euo pipefail

: "${DATABASE_URL:?}" "${SALES_MANAGER_ID:?}" "${OPPORTUNITY_ID:?}" "${CUSTOMER_ID:?}"
: "${MASTER_VERSION_ID:?}" "${SPECIFICATION_ID:?}" "${REQUEST_KEY:?}" "${REQUEST_KEY_B:?}" "${ADVANCE_EXPECTED_VERSION:?}"
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
printf "BEGIN; %s SELECT * FROM public.save_master_specification_version('${SPECIFICATION_ID}'::uuid, '${OPPORTUNITY_ID}'::uuid, '${CUSTOMER_ID}'::uuid, '${ADVANCE_TITLE}', ${ADVANCE_EXPECTED_VERSION}, '${ADVANCE_SUMMARY}', '${ADVANCE_SPECIFICATION_DATA}'::jsonb); COMMIT;" "$caller_prelude" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null
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
printf "BEGIN; %s SET LOCAL lock_timeout = '5000ms'; SELECT pg_backend_pid(); UPDATE public.master_specifications SET current_version = current_version WHERE opportunity_id = '${OPPORTUNITY_ID}'::uuid; ROLLBACK;" "$caller_prelude" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/blocker" 2>&1 &
blocker_pid=$!
sleep 1
blocker_backend_pid="$(awk '/^[[:space:]]*[0-9]+[[:space:]]*$/ { gsub(/[[:space:]]/, ""); print; exit }' "$tmp_dir/blocker")"
test -n "$blocker_backend_pid" || { echo "Could not read the blocker backend PID" >&2; exit 1; }
if ! psql "$DATABASE_URL" -X -tAc "SELECT wait_event_type = 'Lock' FROM pg_stat_activity WHERE pid = ${blocker_backend_pid};" | grep -qx "t"; then
  echo "Concurrent source update did not expose the expected lock wait" >&2; exit 1
fi
if wait "$blocker_pid"; then
  echo "Concurrent source update blocks: expected lock timeout" >&2; exit 1
fi
grep -Eq "canceling statement due to lock timeout|Lock" "$tmp_dir/blocker"

wait "$holder_pid"

# Distinct request keys must allocate distinct nonblank business numbers without relying on a
# browser-callable numbering function. This also proves the protected insert does not cause a
# second trigger allocation when it supplies next_business_number itself.
second_key_call="SELECT public.create_sales_bound_customer_requirement('${OPPORTUNITY_ID}'::uuid, '${CUSTOMER_ID}'::uuid, '${MASTER_VERSION_ID}'::uuid, 'Concurrent number acceptance requirement', 'NUMBER-ACCEPT', 'Second acceptance-only summary.', '${REQUEST_KEY_B}'::uuid);"
printf "BEGIN; %s %s COMMIT;" "$caller_prelude" "$second_key_call" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/second-id"
second_id="$(tail -n 3 "$tmp_dir/second-id" | head -n 1 | tr -d '[:space:]')"
test -n "$second_id" || { echo "Second request did not create a requirement" >&2; exit 1; }
numbers="$(psql "$DATABASE_URL" -X -Atc "SELECT requirement_number FROM public.customer_requirements WHERE id IN ('${created_id}'::uuid, '${second_id}'::uuid) ORDER BY id;")"
first_number="$(printf '%s\n' "$numbers" | sed -n '1p')"
second_number="$(printf '%s\n' "$numbers" | sed -n '2p')"
test -n "$first_number" && test -n "$second_number" && test "$first_number" != "$second_number" || { echo "Protected calls did not allocate two distinct nonblank requirement numbers" >&2; exit 1; }

echo "PASS: replay-after-version-advance, changed-payload conflict, concurrent source update blocking, and distinct protected business numbers"
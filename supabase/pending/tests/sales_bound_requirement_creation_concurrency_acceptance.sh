#!/usr/bin/env bash
# RETIRED STRUCTURAL HARNESS. Direct psql/JWT-GUC simulation cannot demonstrate real
# authenticated caller transport, and direct SQL locks cannot prove protected routine
# behavior. Use sales_bound_requirement_creation_caller_transport_acceptance.sh only
# after an approved isolated caller-transport runner supplies exact count, rollback,
# concurrency, and source-lock assertions.
set -euo pipefail
echo "Refusing structural simulation. Run the approved real caller-transport harness instead." >&2
exit 64

#!/usr/bin/env bash
set -euo pipefail

# SOURCE-ONLY, READ-ONLY PREFLIGHT RUNNER. It is intentionally hard-locked to
# the unpublished isolated acceptance backend and refuses the original backend.
# It never reads tokens, never sets JWT/GUC caller identity, never uses a
# service role, and never applies the pending proposal. Mutation execution is
# deliberately unavailable until approved scoped caller sessions exist.

readonly ISOLATED_PROJECT_REF="egjotuxqguifnvdnflan"
readonly ORIGINAL_PROJECT_REF="yyrvduosyyaluifqvwkr"

: "${LOVABLE_CLOUD_PROJECT_REF:?Set the inspected backend project reference.}"

if [[ "$LOVABLE_CLOUD_PROJECT_REF" == "$ORIGINAL_PROJECT_REF" ]]; then
  printf '%s\n' "REFUSED: original backend is never an acceptance target." >&2
  exit 64
fi
if [[ "$LOVABLE_CLOUD_PROJECT_REF" != "$ISOLATED_PROJECT_REF" ]]; then
  printf '%s\n' "REFUSED: backend is not the allowlisted isolated acceptance backend." >&2
  exit 64
fi

cat <<'REPORT'
READ-ONLY ISOLATED ACCEPTANCE PREFLIGHT
target: egjotuxqguifnvdnflan
proposal: supabase/pending/20261005_client_requirement_intake.sql
fixture: supabase/pending/tests/client_requirement_intake_acceptance.sql
status: BLOCKED — no mutation was attempted

required before executable caller acceptance:
- approved scoped external-contact authenticated identity;
- approved assigned engineering-reviewer authenticated identity;
- authenticated application-RPC runner for the isolated backend;
- disposable audit-failure boundary;
- two independent approved caller sessions for replay and expected-version concurrency.

not accepted as evidence:
- service-role execution;
- sandbox/bypass-RLS execution;
- synthetic JWT/GUC impersonation;
- original-backend execution.

planned cases once unblocked:
- exact retry/replay; canonical-payload collision/key conflict; legacy signature absence;
- terminal source/department/reviewer reassignment denial; audit-failure rollback;
- concurrent same-key replay; concurrent expected-version race.
REPORT
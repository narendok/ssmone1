#!/usr/bin/env bash
set -euo pipefail

# SOURCE-ONLY, READ-ONLY PREFLIGHT RUNNER. It is intentionally hard-locked to
# the unpublished isolated acceptance backend and refuses the original backend.
# It never reads tokens, never sets JWT/GUC caller identity, never uses a
# service role, and never applies the pending proposal. Mutation execution is
# deliberately unavailable until approved scoped caller sessions exist.

readonly ISOLATED_PROJECT_REF="egjotuxqguifnvdnflan"
readonly ORIGINAL_PROJECT_REF="yyrvduosyyaluifqvwkr"

: "${ISOLATED_DATABASE_URL:?Set the isolated acceptance connection target.}"

if [[ "$ISOLATED_DATABASE_URL" == *"$ORIGINAL_PROJECT_REF"* ]]; then
  printf '%s\n' "REFUSED: original backend is never an acceptance target." >&2
  exit 64
fi
if [[ "$ISOLATED_DATABASE_URL" != *"$ISOLATED_PROJECT_REF"* ]]; then
  printf '%s\n' "REFUSED: backend is not the allowlisted isolated acceptance backend." >&2
  exit 64
fi

cat <<'REPORT'
READ-ONLY ISOLATED ACCEPTANCE PREFLIGHT
target: egjotuxqguifnvdnflan (connection target verified without printing it)
proposal: supabase/pending/20261005_client_requirement_intake.sql
fixture: supabase/pending/tests/client_requirement_intake_acceptance.sql
status: BLOCKED — no mutation or database query was attempted

required before executable caller acceptance:
- approved scoped external-contact authenticated identity;
- approved assigned engineering-reviewer authenticated identity;
- pending application RPCs installed on the isolated backend; the normal
  caller-authenticated server-function transport is verified separately;
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
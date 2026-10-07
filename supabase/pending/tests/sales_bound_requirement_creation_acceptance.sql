-- STRUCTURAL-ONLY SOURCE CHECK. This file is not caller-authenticated database
-- acceptance. SET LOCAL request.jwt.claim.sub can only model function branch shape
-- from a privileged psql connection; it cannot prove JWT verification, transport,
-- RLS, grants, or non-admin caller behavior. Do not run it as evidence of acceptance.
--
-- Real caller transport acceptance is specified in
-- sales_bound_requirement_creation_caller_transport_acceptance.sh and must use two
-- independently authenticated non-service callers against an explicitly approved
-- isolated target. No target is selected by this source file.
\set ON_ERROR_STOP on

-- This preflight is structural only: all values must be false except the protected
-- function execute privilege. A real caller transport runner repeats these checks
-- through authenticated application transport and asserts the returned booleans.
SELECT NOT has_table_privilege('PUBLIC', 'public.sales_requirement_creation_requests', 'SELECT') AS no_public_receipt_read;
SELECT NOT has_table_privilege('PUBLIC', 'public.sales_requirement_creation_requests', 'INSERT') AS no_public_receipt_insert;
SELECT NOT has_table_privilege('anon', 'public.sales_requirement_creation_requests', 'SELECT') AS no_anon_receipt_read;
SELECT NOT has_table_privilege('anon', 'public.sales_requirement_creation_requests', 'INSERT') AS no_anon_receipt_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_requirement_creation_requests', 'SELECT') AS no_authenticated_receipt_read;
SELECT NOT has_table_privilege('authenticated', 'public.sales_requirement_creation_requests', 'INSERT') AS no_authenticated_receipt_insert;
SELECT has_function_privilege('authenticated', 'public.create_sales_bound_customer_requirement(uuid, uuid, uuid, text, text, text, uuid)', 'EXECUTE') AS protected_create_callable;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirements', 'INSERT') AS no_authenticated_requirement_insert;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirements', 'UPDATE') AS no_authenticated_requirement_update;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirement_revisions', 'INSERT') AS no_authenticated_revision_insert;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirement_revisions', 'UPDATE') AS no_authenticated_revision_update;

-- Pending baseline-approval structural preflight. This is not database acceptance.
SELECT NOT has_table_privilege('PUBLIC', 'public.sales_baseline_approval_requests', 'SELECT') AS no_public_baseline_receipt_read;
SELECT NOT has_table_privilege('anon', 'public.sales_baseline_approval_requests', 'INSERT') AS no_anon_baseline_receipt_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_baseline_approval_requests', 'SELECT') AS no_authenticated_baseline_receipt_read;
SELECT NOT has_table_privilege('authenticated', 'public.sales_baseline_approval_requests', 'INSERT') AS no_authenticated_baseline_receipt_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_baseline_approval_requests', 'UPDATE') AS no_authenticated_baseline_receipt_update;
SELECT has_function_privilege('authenticated', 'public.approve_sales_requirement_baseline(uuid, integer, uuid)', 'EXECUTE') AS protected_baseline_callable;
SELECT NOT has_table_privilege('authenticated', 'public.requirement_baselines', 'INSERT') AS no_authenticated_baseline_insert;

-- Pending protected commercial-save structural preflight. This remains structural-only
-- until a real caller transport executes the function against an approved isolated target.
SELECT NOT has_table_privilege('PUBLIC', 'public.sales_commercial_save_requests', 'SELECT') AS no_public_commercial_receipt_read;
SELECT NOT has_table_privilege('anon', 'public.sales_commercial_save_requests', 'INSERT') AS no_anon_commercial_receipt_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_save_requests', 'SELECT') AS no_authenticated_commercial_receipt_read;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_save_requests', 'INSERT') AS no_authenticated_commercial_receipt_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_record_revisions', 'SELECT') AS no_authenticated_commercial_history_read;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_records', 'INSERT') AS no_authenticated_commercial_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_records', 'UPDATE') AS no_authenticated_commercial_update;
SELECT NOT has_table_privilege('authenticated', 'public.sales_commercial_records', 'DELETE') AS no_authenticated_commercial_delete;
SELECT has_function_privilege('authenticated', 'public.save_sales_commercial_record(uuid, integer, text, text, numeric, text, text, text, uuid)', 'EXECUTE') AS protected_commercial_callable;
DO $$
DECLARE
  v_revision_column boolean;
  v_unique_history boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_commercial_records'
      AND column_name = 'revision_number' AND data_type = 'integer' AND is_nullable = 'NO'
  ) INTO v_revision_column;
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public' AND relation.relname = 'sales_commercial_record_revisions'
      AND constraint_row.contype = 'u' AND pg_get_constraintdef(constraint_row.oid) LIKE '%commercial_record_id, revision_number%'
  ) INTO v_unique_history;
  IF NOT v_revision_column OR NOT v_unique_history THEN
    RAISE EXCEPTION 'Commercial revision/history schema contract is incomplete';
  END IF;
END;
$$;

-- Required caller-authenticated isolated assertions, each transactionally isolated:
-- 1. exact expected current revision and pinned provenance are mandatory; legacy NULL
--    provenance, stale revisions, mismatched source pairs, or TBC workstreams fail.
-- 2. every applicable department has one matching terminal feasible verdict; a verdict
--    pinned to a historic revision never satisfies a newer revision.
-- 3. unresolved conditions/risks and missing verified customer authorization fail.
-- 4. the existing trigger assigns the baseline number; callers have no number parameter.
-- 5. identical actor/key/payload replays after later source changes; changed payload rejects.
-- 6. concurrent same-key approvals converge to one baseline/receipt/audit; forced audit
--    failure rolls all three back; direct receipt/baseline writes remain denied.
-- 7. while approval holds the revision-scoped review locks, an assigned-reviewer response
--    and a Sales reassignment wait and then re-evaluate against the post-approval source;
--    no baseline may snapshot a review mid-transition.
-- 8. while approval holds its commercial row lock, a protected commercial authorization
--    update waits and no baseline may snapshot a partly changed authorization.
-- 9. two new commercial saves for the same requirement serialize through the requirement
--    lock: exactly one revision-one row/history/receipt/audit survives; the other stale
--    expected-revision request fails rather than silently overwriting it.
-- 10. an exact same-actor/key/payload replay returns the stored commercial record without
--    appending history/audit; changed actor or payload rejects. A forced activity-log
--    failure leaves no commercial row, history row, or receipt.

-- Required executable assertions in the real caller transport runner:
-- 1. approved isolated target refusal before any request is sent;
-- 2. real authenticated Sales creation produces exactly one requirement, revision 1,
--    source_bound_created audit, and receipt; all are rolled back in an audit-failure case;
-- 3. identical retry returns the same ID and exact counts stay one;
-- 4. changed title, summary, customer, version, or caller under the same key rejects;
-- 5. an exact replay after controlled Master-version advance returns the historical ID,
--    while a fresh key using the now-stale Master version rejects;
-- 6. two real authenticated sessions with one key converge to one persisted result;
-- 7. a protected create holds its source locks while a protected controlled source update
--    blocks, then resolves without changing the first create's persisted provenance;
-- 8. direct receipt/requirement/revision writes are denied to each real caller.
-- 9. real authenticated Sales baseline approval creates exactly one trigger-numbered
--    baseline, audit, and receipt; an exact replay after an allowed source advance returns
--    the original baseline only after re-checking the caller capability; changed actor or
--    payload rejects before any new write.
-- 10. forced audit failure rolls baseline, receipt, and number allocation transaction back;
--    concurrent same-key baseline calls converge to one returned ID and exact counts one.

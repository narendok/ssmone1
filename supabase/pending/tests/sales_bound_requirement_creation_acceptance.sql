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
SELECT has_function_privilege('authenticated', 'public.approve_sales_requirement_baseline(uuid, integer, uuid)', 'EXECUTE') AS protected_baseline_callable;

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

-- ISOLATED ACCEPTANCE ONLY. Source contract for the pending Sales-bound requirement proposal.
-- Use real caller-authenticated sessions and existing isolated records; never service-role impersonation.
-- Required variables: sales_manager_id, sales_manager_jwt, opportunity_id, customer_id,
-- master_specification_version_id, stale_master_specification_version_id, wrong_customer_id,
-- request_key. Every mutation case must ROLLBACK.
\set ON_ERROR_STOP on

-- Preflight: only the protected routine may access receipts. Every direct table
-- privilege below must be false for PUBLIC, anon, and authenticated.
SELECT has_table_privilege('PUBLIC', 'public.sales_requirement_creation_requests', 'SELECT') AS no_public_receipt_read;
SELECT has_table_privilege('PUBLIC', 'public.sales_requirement_creation_requests', 'INSERT') AS no_public_receipt_insert;
SELECT has_table_privilege('anon', 'public.sales_requirement_creation_requests', 'SELECT') AS no_anon_receipt_read;
SELECT has_table_privilege('anon', 'public.sales_requirement_creation_requests', 'INSERT') AS no_anon_receipt_insert;
SELECT has_table_privilege('authenticated', 'public.sales_requirement_creation_requests', 'SELECT') AS no_authenticated_receipt_read;
SELECT has_table_privilege('authenticated', 'public.sales_requirement_creation_requests', 'INSERT') AS no_authenticated_receipt_insert;
SELECT has_function_privilege('authenticated', 'public.create_sales_bound_customer_requirement(uuid, uuid, uuid, text, text, text, uuid)', 'EXECUTE') AS protected_create_callable;

-- 1. Allowed caller: creates exactly one header, revision 1, audit, and receipt bound to
-- opportunity/customer/current Master Specification version and actor.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
SELECT public.create_sales_bound_customer_requirement(
  :'opportunity_id'::uuid, :'customer_id'::uuid, :'master_specification_version_id'::uuid,
  'Acceptance source-bound requirement', 'ACCEPT-REQ', 'Acceptance-only summary.', :'request_key'::uuid
);
ROLLBACK;

-- 2. Identical retry: two calls with the same request key and canonical payload return one ID;
-- counts remain one for header, revision 1, source_bound_created audit, and receipt.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
SELECT public.create_sales_bound_customer_requirement(:'opportunity_id'::uuid, :'customer_id'::uuid, :'master_specification_version_id'::uuid, 'Retry exact payload', 'RETRY', 'Exact summary.', :'request_key'::uuid);
SELECT public.create_sales_bound_customer_requirement(:'opportunity_id'::uuid, :'customer_id'::uuid, :'master_specification_version_id'::uuid, 'Retry exact payload', 'RETRY', 'Exact summary.', :'request_key'::uuid);
ROLLBACK;

-- 3. Replay after Master version advance: commit an allowed creation, then use the existing
-- controlled Master Specification save path in a separate caller-authenticated transaction to
-- advance current_version. An exact retry with the original key/payload/version must return its
-- historical requirement ID; it must not revalidate the version as current or create another row.
-- Run this with a dedicated acceptance-only source tuple and roll back/clean it outside this script.

-- 4. Changed title, summary, customer, version, or actor with the same request key fails before new rows.
-- 5. Wrong opportunity/customer pair and stale/nonmatching Master version fail before header/revision/audit/receipt.
-- 6. Two concurrent authenticated sessions with the same caller/key/payload serialize on the advisory lock,
-- both return the same requirement ID, and commit one header/revision/audit/receipt only.
-- 7. Concurrent source update: session A calls this routine for a fresh key and pauses after its
-- opportunity/specification FOR UPDATE locks are acquired; session B, authenticated as an authorized
-- source editor, attempts either sales_opportunities.customer_id or master_specifications.current_version
-- update through its controlled source mutation. B must block until A commits/rolls back. If A commits,
-- its persisted receipt/audit source tuple must equal the locked tuple; B then proceeds and cannot alter
-- the already-persisted provenance. If A rolls back, B may proceed and A leaves no receipt/header/revision/audit.
-- 8. Force the source_bound_created audit insert to fail in isolated infrastructure; header, revision,
-- and receipt roll back together. Do not simulate with a service role.
-- 9. After compatible legacy redirect/removal is accepted, direct authenticated INSERT/UPDATE/DELETE on
-- customer_requirements and customer_requirement_revisions must fail, and the legacy multi-call facade
-- must not remain callable. Existing manual/approved rows, including the 24v tracker, remain unchanged.

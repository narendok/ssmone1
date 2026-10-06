-- ISOLATED ACCEPTANCE ONLY. Source contract for the pending Sales-bound requirement proposal.
-- Use real caller-authenticated sessions and existing isolated records; never service-role impersonation.
-- Required variables: sales_manager_id, sales_manager_jwt, opportunity_id, customer_id,
-- master_specification_version_id, stale_master_specification_version_id, wrong_customer_id,
-- request_key. Every mutation case must ROLLBACK.
\set ON_ERROR_STOP on

-- Preflight: receipt has no authenticated direct access, and only the protected routine is callable.
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

-- 3. Changed title, summary, customer, version, or actor with the same request key fails before new rows.
-- 4. Wrong opportunity/customer pair and stale/nonmatching Master version fail before header/revision/audit/receipt.
-- 5. Two concurrent authenticated sessions with the same caller/key/payload serialize on the advisory lock,
-- both return the same requirement ID, and commit one header/revision/audit/receipt only.
-- 6. Force the source_bound_created audit insert to fail in isolated infrastructure; header, revision,
-- and receipt roll back together. Do not simulate with a service role.
-- 7. After compatible legacy redirect/removal is accepted, direct authenticated INSERT/UPDATE/DELETE on
-- customer_requirements and customer_requirement_revisions must fail, and the legacy multi-call facade
-- must not remain callable. Existing manual/approved rows, including the 24v tracker, remain unchanged.

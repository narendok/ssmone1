-- ISOLATED ACCEPTANCE ONLY. Requires a real caller-authenticated runner with
-- an existing sales.manage/admin identity and existing isolated Sales fixture.
-- Every case is independently rolled back. Never run with service-role
-- impersonation or a role that bypasses RLS.
\set ON_ERROR_STOP on

-- Required psql variables:
-- sales_manager_jwt, sales_manager_id, opportunity_id, customer_id,
-- specification_id, wrong_customer_id, audit_failure_summary
-- The runner must inject sales_manager_jwt as the real application JWT.

-- Preflight: prove authenticated and PUBLIC have no direct mutation privilege,
-- while the protected routine remains callable through a real auth context.
SELECT has_table_privilege('authenticated', 'public.master_specifications', 'INSERT') AS authenticated_header_insert;
SELECT has_table_privilege('PUBLIC', 'public.master_specifications', 'INSERT') AS public_header_insert;
SELECT has_table_privilege('authenticated', 'public.master_specification_versions', 'INSERT') AS authenticated_version_insert;
SELECT has_table_privilege('PUBLIC', 'public.master_specification_versions', 'INSERT') AS public_version_insert;

-- Case 1: allowed controlled save proves the existing immutable version
-- update/delete trigger does not interfere with the SECURITY DEFINER routine.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
SELECT * FROM public.save_master_specification_version(
  :'specification_id'::uuid, :'opportunity_id'::uuid, :'customer_id'::uuid,
  'Acceptance controlled save', 1, 'Acceptance controlled save',
  '{"proposedName":"Synthetic","customerOrInternalOwner":"Synthetic","industryApplication":"Test","productFamily":"Test","developmentScope":"Test","workstreams":["HARDWARE"],"requirementSummary":"Test"}'::jsonb
);
ROLLBACK;

-- Case 1b: NULL mandatory arguments are denied rather than falling through a
-- SQL three-valued IF predicate. Run each call in a separate transaction in
-- the real runner and assert the payload-invalid exception.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
SELECT * FROM public.save_master_specification_version(
  :'specification_id'::uuid, :'opportunity_id'::uuid, :'customer_id'::uuid,
  NULL, NULL, NULL, NULL
);
ROLLBACK;

-- Case 2: authoritative mismatch is denied and creates no header/version/audit.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
SELECT * FROM public.save_master_specification_version(
  NULL, :'opportunity_id'::uuid, :'wrong_customer_id'::uuid,
  'Mismatch must fail', 0, 'Mismatch must fail',
  '{"proposedName":"Synthetic","customerOrInternalOwner":"Synthetic","industryApplication":"Test","productFamily":"Test","developmentScope":"Test","workstreams":["HARDWARE"],"requirementSummary":"Test"}'::jsonb
);
ROLLBACK;

-- Case 3: stale expected version is denied after a competing save and rolls back.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
SELECT * FROM public.save_master_specification_version(
  :'specification_id'::uuid, :'opportunity_id'::uuid, :'customer_id'::uuid,
  'First concurrent writer', 1, 'First concurrent writer',
  '{"proposedName":"Synthetic","customerOrInternalOwner":"Synthetic","industryApplication":"Test","productFamily":"Test","developmentScope":"Test","workstreams":["HARDWARE"],"requirementSummary":"Test"}'::jsonb
);
SELECT * FROM public.save_master_specification_version(
  :'specification_id'::uuid, :'opportunity_id'::uuid, :'customer_id'::uuid,
  'Stale concurrent writer', 1, 'Stale concurrent writer',
  '{"proposedName":"Synthetic","customerOrInternalOwner":"Synthetic","industryApplication":"Test","productFamily":"Test","developmentScope":"Test","workstreams":["HARDWARE"],"requirementSummary":"Test"}'::jsonb
);
ROLLBACK;

-- Case 4: direct header insert is denied after hardening.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
INSERT INTO public.master_specifications
  (specification_number, opportunity_id, customer_id, title, current_version, created_by)
VALUES ('DIRECT-WRITE-MUST-FAIL', :'opportunity_id'::uuid, :'customer_id'::uuid,
        'Direct write must fail', 1, :'sales_manager_id'::uuid);
ROLLBACK;

-- Case 5: direct pointer update and delete are denied after hardening.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
UPDATE public.master_specifications
SET current_version = current_version + 1
WHERE id = :'specification_id'::uuid;
DELETE FROM public.master_specifications
WHERE id = :'specification_id'::uuid;
ROLLBACK;

-- Case 6: direct revision insert is denied after hardening.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
INSERT INTO public.master_specification_versions
  (specification_id, version_number, change_summary, specification_data, created_by)
VALUES (:'specification_id'::uuid, 999, 'Direct insert must fail', '{}'::jsonb, :'sales_manager_id'::uuid);
ROLLBACK;

-- Case 7: forced activity audit failure rolls back header pointer and revision.
-- The isolated fixture must install a transaction-local failing activity_log
-- constraint or trigger; the runner then proves no specification/version row
-- remains from this call after the exception.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
SELECT * FROM public.save_master_specification_version(
  NULL, :'opportunity_id'::uuid, :'customer_id'::uuid,
  'Audit rollback must fail', 0, :'audit_failure_summary',
  '{"proposedName":"Synthetic","customerOrInternalOwner":"Synthetic","industryApplication":"Test","productFamily":"Test","developmentScope":"Test","workstreams":["HARDWARE"],"requirementSummary":"Test"}'::jsonb
);
ROLLBACK;

-- A two-session runner must additionally invoke Case 3 simultaneously using
-- the same expected version. Exactly one call may receive a receipt; the other
-- must receive the stale-version error. Both sessions rollback.
-- ISOLATED ACCEPTANCE ONLY. Requires a real caller-authenticated runner.
-- Run every case in an outer transaction and ROLLBACK; no production fixture
-- creation. Variables must resolve existing isolated fixture IDs and JWTs.
\set ON_ERROR_STOP on

-- Case 1: sales.manage direct header insert is denied after hardening.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
INSERT INTO public.master_specifications
  (specification_number, opportunity_id, customer_id, title, current_version, created_by)
VALUES
  ('DIRECT-WRITE-MUST-FAIL', :'opportunity_id'::uuid, :'customer_id'::uuid,
   'Direct write must fail', 1, :'sales_manager_id'::uuid);
ROLLBACK;

-- Case 2: direct pointer mutation is denied after hardening.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
UPDATE public.master_specifications
SET current_version = current_version + 1
WHERE id = :'specification_id'::uuid;
ROLLBACK;

-- Case 3: direct appended revision is denied after hardening.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
INSERT INTO public.master_specification_versions
  (specification_id, version_number, change_summary, specification_data, created_by)
VALUES
  (:'specification_id'::uuid, 999, 'Direct insert must fail', '{}'::jsonb, :'sales_manager_id'::uuid);
ROLLBACK;

-- Case 4: RPC rejects an opportunity/customer mismatch and leaves no rows/audit.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
SELECT * FROM public.save_master_specification_version(
  NULL, :'opportunity_id'::uuid, :'wrong_customer_id'::uuid,
  'Mismatch must fail', 0, 'Mismatch must fail',
  '{"proposedName":"Synthetic","customerOrInternalOwner":"Synthetic","industryApplication":"Test","productFamily":"Test","developmentScope":"Test","workstreams":["HARDWARE"],"requirementSummary":"Test"}'::jsonb
);
ROLLBACK;
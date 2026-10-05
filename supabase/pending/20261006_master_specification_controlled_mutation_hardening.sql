-- SOURCE-ONLY HARDENING PROPOSAL. Do not apply until isolated caller-RLS,
-- rollback, direct-write denial, RPC replay/conflict, and concurrency acceptance pass.
-- This preserves the existing save_master_specification_version contract while
-- removing direct authenticated mutation paths that bypass its transaction.

REVOKE INSERT, UPDATE, DELETE ON TABLE public.master_specifications FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.master_specification_versions FROM authenticated;

DROP POLICY IF EXISTS "Sales users manage master specifications" ON public.master_specifications;
DROP POLICY IF EXISTS "Sales users append master specification versions" ON public.master_specification_versions;

CREATE OR REPLACE FUNCTION public.master_specification_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Master Specification records may only be changed through save_master_specification_version';
END;
$$;

DROP TRIGGER IF EXISTS master_specifications_no_direct_write ON public.master_specifications;
CREATE TRIGGER master_specifications_no_direct_write
BEFORE INSERT OR UPDATE OR DELETE ON public.master_specifications
FOR EACH ROW EXECUTE FUNCTION public.master_specification_write_guard();

DROP TRIGGER IF EXISTS master_specification_versions_no_direct_insert ON public.master_specification_versions;
CREATE TRIGGER master_specification_versions_no_direct_insert
BEFORE INSERT ON public.master_specification_versions
FOR EACH ROW EXECUTE FUNCTION public.master_specification_write_guard();

-- The existing SECURITY INVOKER save routine must be replaced in the same
-- reviewed migration by a privileged, server-only transaction entry point.
-- It must receive verified caller identity from the authenticated server
-- boundary, re-authorize sales.manage/admin, derive the authoritative
-- opportunity/customer pairing, lock the specification row, append exactly one
-- revision, update the pointer, and write activity_log atomically.
-- The direct-write triggers above intentionally stay unapplied until that
-- compatible replacement is acceptance-tested.
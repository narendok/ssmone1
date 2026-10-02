-- UNAPPLIED SOURCE-ONLY PROPOSAL. Do not move this file into supabase/migrations
-- until isolated database, rollback, RLS, and protected-action acceptance succeeds.
-- Existing folder_kind remains unchanged; reviews use STANDARD plus metadata.

BEGIN;

-- Preflight must return zero rows before provisioning a department review root:
-- SELECT department_id FROM public.drive_nodes
-- WHERE metadata @> '{"taxonomy":"periodic-conditional-review-v1","category":"PERIODIC_CONDITIONAL_REVIEW"}'::jsonb
-- GROUP BY department_id HAVING count(*) > 1;

CREATE OR REPLACE FUNCTION public.provision_department_periodic_review_root(p_department_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_standards_root uuid;
  v_review_root uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.lifecycle_can_manage_department(v_actor, p_department_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT id INTO v_standards_root FROM public.drive_nodes
  WHERE department_id = p_department_id AND folder_kind = 'DEPARTMENT_STANDARDS' AND is_trashed = false
  ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF v_standards_root IS NULL THEN RAISE EXCEPTION 'Verified department standards root is required'; END IF;
  SELECT id INTO v_review_root FROM public.drive_nodes
  WHERE department_id = p_department_id AND metadata @> '{"taxonomy":"periodic-conditional-review-v1","category":"PERIODIC_CONDITIONAL_REVIEW"}'::jsonb
    AND is_trashed = false FOR UPDATE;
  IF FOUND THEN RETURN v_review_root; END IF;
  INSERT INTO public.drive_nodes (department_id, parent_id, name, slug, node_type, is_locked, folder_kind, metadata)
  VALUES (p_department_id, v_standards_root, 'Periodic and Conditional Reviews', 'periodic-conditional-reviews', 'FOLDER', true, 'STANDARD', jsonb_build_object('taxonomy', 'periodic-conditional-review-v1', 'category', 'PERIODIC_CONDITIONAL_REVIEW', 'placement', 'COMMON', 'provisioned_by', 'protected-action'))
  RETURNING id INTO v_review_root;
  RETURN v_review_root;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_department_periodic_review_root(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_department_periodic_review_root(uuid) TO service_role;

-- Required acceptance: scoped lead/admin allow+deny, missing/duplicate root,
-- exact replay, rollback, and unchanged legacy-folder checks in an isolated DB.
ROLLBACK;
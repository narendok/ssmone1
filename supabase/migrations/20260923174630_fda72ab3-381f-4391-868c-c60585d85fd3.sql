REVOKE EXECUTE ON FUNCTION public.assign_stabilization_codes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_automation_lease(text, text, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_grn(uuid, text, date, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_phase6_quotation(uuid, uuid, date, date, integer, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_phase6_rfq(uuid, uuid, date, text, uuid[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_phase7_dispatch(uuid, text, text, text, text, uuid[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_phase7_ppap_package(uuid, uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_phase7_work_order(uuid, uuid, uuid, text, text, numeric, date, date, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_purchase_order(uuid, date, text, numeric, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_purchase_request_from_bom_shortage(uuid, date) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decide_incoming_inspection(uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decide_phase7_finished_goods_release(uuid, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decide_phase7_ppap_package(uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.disposition_phase7_ncr(uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_phase5_project_access_catalog() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_po_sent(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.next_business_number(text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.next_document_number(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.phase6_shortage_snapshot(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.provision_drive_for_project(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.provision_project_drive_folders() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_phase7_unit_execution(uuid, uuid, uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_phase7_unit_inspection(uuid, uuid, uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_phase7_unit_test(uuid, uuid, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.review_phase6_record(text, uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.short_close_po_item(uuid, text, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.toggle_node_star(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.transition_phase7_work_order(uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.try_acquire_automation_lease(text, integer) FROM authenticated;

-- These two are explicitly called by the signed-in project drive UI and enforce access internally.
GRANT EXECUTE ON FUNCTION public.get_drive_breadcrumbs(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_drive_for_project(uuid) TO service_role;

-- Public Careers functions are intentionally available to applicants; all other privileged helpers stay service-only.
REVOKE EXECUTE ON FUNCTION public.submit_public_job_application(text, text, text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_public_job_application(text, text, text, text, text, text, text, text, text, bigint) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_application_status(text) FROM authenticated;
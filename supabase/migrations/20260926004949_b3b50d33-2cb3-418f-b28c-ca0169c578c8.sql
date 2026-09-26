CREATE OR REPLACE FUNCTION public.seed_mobile_stage5_test_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  test_vendor_id uuid;
  test_pr_id uuid;
  test_rfq_id uuid;
  test_po_id uuid;
  test_component_id uuid;
  vendor_created boolean := false;
  pr_created boolean := false;
  rfq_created boolean := false;
  shipment_created boolean := false;
BEGIN
  IF actor IS NULL OR NOT public.has_role(actor, 'admin') THEN
    RAISE EXCEPTION 'Only Administrators can seed controlled test data';
  END IF;

  SELECT id INTO test_vendor_id FROM public.vendors WHERE vendor_code = 'TEST-MOB-001' LIMIT 1;
  IF test_vendor_id IS NULL THEN
    INSERT INTO public.vendors (vendor_code, name, supplier_status, quality_risk, is_active, customer_nominated, approved_categories)
    VALUES ('TEST-MOB-001', 'TEST ONLY — Mobile Stage 5 Vendor', 'APPROVED', 'LOW', true, false, '[]'::jsonb)
    RETURNING id INTO test_vendor_id;
    vendor_created := true;
  END IF;

  SELECT id INTO test_pr_id FROM public.purchase_requests WHERE request_number = 'TEST-MOB-PR-001' LIMIT 1;
  IF test_pr_id IS NULL THEN
    INSERT INTO public.purchase_requests (request_number, source_type, requester_id, status, urgency, required_date, notes, submitted_at)
    VALUES ('TEST-MOB-PR-001', 'TESTING', actor, 'SUBMITTED', 'NORMAL', current_date + 14, 'Controlled Mobile Stage 5 test data. Safe to identify and exclude from operational reporting.', now())
    RETURNING id INTO test_pr_id;
    pr_created := true;

    SELECT id INTO test_component_id FROM public.components ORDER BY created_at NULLS LAST, id LIMIT 1;
    INSERT INTO public.purchase_request_items (purchase_request_id, component_id, mpn, description, required_quantity, shortage_quantity, unit, notes)
    VALUES (test_pr_id, test_component_id, 'TEST-MOB-COMP-001', 'Controlled Mobile Stage 5 test request line', 1, 1, 'EA', 'Test-only request line');
  END IF;

  SELECT id INTO test_rfq_id FROM public.rfqs WHERE rfq_number = 'TEST-MOB-RFQ-001' LIMIT 1;
  IF test_rfq_id IS NULL THEN
    INSERT INTO public.rfqs (rfq_number, purchase_request_id, status, response_due_date, terms, created_by)
    VALUES ('TEST-MOB-RFQ-001', test_pr_id, 'SENT', current_date + 10, 'Controlled Mobile Stage 5 test RFQ. No commercial terms.', actor)
    RETURNING id INTO test_rfq_id;
    rfq_created := true;
    INSERT INTO public.rfq_vendors (rfq_id, vendor_id, sent_at, status)
    VALUES (test_rfq_id, test_vendor_id, now(), 'SENT') ON CONFLICT (rfq_id, vendor_id) DO NOTHING;
  END IF;

  SELECT id INTO test_po_id FROM public.purchase_orders WHERE po_number = 'TEST-MOB-PO-001' LIMIT 1;
  IF test_po_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.po_shipments WHERE po_id = test_po_id AND awb_number = 'TEST-MOB-AWB-001') THEN
    INSERT INTO public.po_shipments (po_id, dispatch_date, courier, awb_number, expected_arrival_date, tracking_provider, status)
    VALUES (test_po_id, current_date, 'TEST ONLY', 'TEST-MOB-AWB-001', current_date + 3, 'MANUAL', 'PLANNED');
    shipment_created := true;
  END IF;

  INSERT INTO public.activity_log (actor_user_id, module_key, entity_type, entity_id, action, summary)
  VALUES (actor, 'mobile-stage5', 'test_seed', coalesce(test_rfq_id, test_pr_id, test_vendor_id), 'seeded', 'Ran idempotent Mobile Stage 5 controlled test-data seed');

  RETURN jsonb_build_object('vendor_id', test_vendor_id, 'purchase_request_id', test_pr_id, 'rfq_id', test_rfq_id, 'shipment_seeded', shipment_created, 'created', jsonb_build_object('vendor', vendor_created, 'purchase_request', pr_created, 'rfq', rfq_created));
END;
$$;
ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

ALTER TABLE public.po_delivery_revisions
  ADD COLUMN IF NOT EXISTS decision_notes text;

ALTER TABLE public.rtv_records
  ADD COLUMN IF NOT EXISTS authorized_by uuid,
  ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE public.quick_expenses
  ADD COLUMN IF NOT EXISTS finance_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS finance_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS finance_notes text;

ALTER TABLE public.payment_milestones
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_notes text;

CREATE OR REPLACE FUNCTION public.create_grn(_po_id uuid, _vendor_invoice_number text, _vendor_invoice_date date, _storage_notes text, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  grn_id uuid;
  grn_no text;
  po_no text;
  po_vendor_id uuid;
  it jsonb;
  loc_id uuid;
  grn_item_id uuid;
  qty int;
  rej int;
  comp uuid;
  total int := 0;
  total_rej int := 0;
  remaining int;
  new_status text;
BEGIN
  IF uid IS NULL OR NOT public.can_inward(uid) THEN
    RAISE EXCEPTION 'Not allowed to record goods receipts';
  END IF;
  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'No received items provided';
  END IF;

  SELECT po_number, vendor_id INTO po_no, po_vendor_id FROM public.purchase_orders WHERE id = _po_id FOR UPDATE;
  IF po_no IS NULL THEN RAISE EXCEPTION 'Purchase order not found'; END IF;

  grn_no := public.next_document_number('GRN');
  INSERT INTO public.goods_receipt_notes(grn_number, po_id, vendor_invoice_number, vendor_invoice_date, received_by, storage_location_notes, quality_status)
    VALUES (grn_no, _po_id, _vendor_invoice_number, _vendor_invoice_date, uid, _storage_notes, 'PENDING_IQC')
    RETURNING id INTO grn_id;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    qty := COALESCE((it->>'quantity')::int, 0);
    rej := COALESCE((it->>'quantity_rejected')::int, 0);
    comp := (it->>'component_id')::uuid;
    IF (qty <= 0 AND rej <= 0) OR comp IS NULL THEN CONTINUE; END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.purchase_order_items
      WHERE id = NULLIF(it->>'po_item_id','')::uuid AND po_id = _po_id AND component_id = comp
    ) THEN
      RAISE EXCEPTION 'Received item does not belong to this purchase order';
    END IF;

    IF qty + rej > COALESCE((SELECT quantity_ordered - quantity_received - quantity_rejected FROM public.purchase_order_items WHERE id = NULLIF(it->>'po_item_id','')::uuid), 0) THEN
      RAISE EXCEPTION 'Received quantity exceeds the outstanding purchase order quantity';
    END IF;

    loc_id := NULLIF(it->>'location_id','')::uuid;
    IF loc_id IS NULL AND qty > 0 THEN
      INSERT INTO public.locations(component_id, location_type, label, quantity)
        VALUES (comp, COALESCE(NULLIF(it->>'location_type',''), 'store'), COALESCE(NULLIF(it->>'location_label',''), 'Basement Store'), 0)
        RETURNING id INTO loc_id;
    END IF;

    INSERT INTO public.goods_receipt_items(grn_id, po_item_id, component_id, location_id, quantity_received, lot_number, date_code, reel_id, quantity_rejected, rejection_reason, rejection_note, quality_status)
      VALUES (grn_id, NULLIF(it->>'po_item_id','')::uuid, comp, loc_id, qty, NULLIF(it->>'lot_number',''), NULLIF(it->>'date_code',''), NULLIF(it->>'reel_id',''), rej, NULLIF(it->>'rejection_reason',''), NULLIF(it->>'rejection_note',''), CASE WHEN qty > 0 THEN 'QUALITY_HOLD' ELSE 'REJECTED' END)
      RETURNING id INTO grn_item_id;

    IF qty > 0 THEN
      UPDATE public.purchase_order_items SET quantity_received = quantity_received + qty WHERE id = NULLIF(it->>'po_item_id','')::uuid;
      UPDATE public.locations SET quantity = quantity + qty WHERE id = loc_id;
      INSERT INTO public.inventory_lots(component_id, grn_item_id, location_id, lot_number, date_code, reel_id, quantity_received, quantity_available, quality_status)
        VALUES (comp, grn_item_id, loc_id, NULLIF(it->>'lot_number',''), NULLIF(it->>'date_code',''), NULLIF(it->>'reel_id',''), qty, qty, 'QUALITY_HOLD');
      INSERT INTO public.incoming_inspections(grn_id, grn_item_id, vendor_id, status, applicability_reason)
        VALUES (grn_id, grn_item_id, po_vendor_id, 'PENDING', 'Generated automatically from GRN');
      INSERT INTO public.stock_history(component_id, location_id, delta, action, note, user_id)
        VALUES (comp, loc_id, qty, 'inward_quality_hold', grn_no || ' (' || po_no || ') pending incoming quality', uid);
      total := total + qty;
    END IF;

    IF rej > 0 THEN
      UPDATE public.purchase_order_items SET quantity_rejected = quantity_rejected + rej WHERE id = NULLIF(it->>'po_item_id','')::uuid;
      total_rej := total_rej + rej;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO remaining FROM public.purchase_order_items
    WHERE po_id = _po_id AND NOT short_closed AND quantity_received + quantity_rejected < quantity_ordered;
  new_status := CASE WHEN remaining = 0 THEN 'RECEIVED' ELSE 'PARTIALLY_RECEIVED' END;
  UPDATE public.purchase_orders SET status = new_status WHERE id = _po_id;

  RETURN jsonb_build_object('grn_id', grn_id, 'grn_number', grn_no, 'total_quantity', total, 'total_rejected', total_rej, 'po_status', new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_incoming_inspection(_inspection_id uuid, _status text, _findings text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_grn_id uuid;
  v_grn_item_id uuid;
  v_lot_status text;
  v_grn_status text;
BEGIN
  IF uid IS NULL OR NOT public.phase6_can_quality(uid) THEN RAISE EXCEPTION 'Not allowed to decide incoming inspection'; END IF;
  IF _status NOT IN ('ACCEPTED','ACCEPTED_WITH_DEVIATION','HOLD','REJECTED','REINSPECTION_REQUIRED') THEN RAISE EXCEPTION 'Invalid incoming-inspection status'; END IF;
  SELECT grn_id, grn_item_id INTO v_grn_id, v_grn_item_id FROM public.incoming_inspections WHERE id = _inspection_id FOR UPDATE;
  IF v_grn_id IS NULL THEN RAISE EXCEPTION 'Incoming inspection not found'; END IF;
  v_lot_status := CASE WHEN _status IN ('ACCEPTED','ACCEPTED_WITH_DEVIATION') THEN 'AVAILABLE' WHEN _status = 'REJECTED' THEN 'REJECTED' ELSE 'QUALITY_HOLD' END;
  UPDATE public.incoming_inspections SET status = _status, findings = _findings, disposition_by = uid, disposition_at = now() WHERE id = _inspection_id;
  UPDATE public.goods_receipt_items SET quality_status = v_lot_status WHERE id = v_grn_item_id;
  UPDATE public.inventory_lots SET quality_status = v_lot_status WHERE grn_item_id = v_grn_item_id;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.incoming_inspections WHERE grn_id = v_grn_id AND status IN ('PENDING','HOLD','REINSPECTION_REQUIRED')) THEN 'PENDING_IQC' WHEN EXISTS (SELECT 1 FROM public.incoming_inspections WHERE grn_id = v_grn_id AND status = 'REJECTED') THEN 'REJECTED' ELSE 'ACCEPTED' END INTO v_grn_status;
  UPDATE public.goods_receipt_notes SET quality_status = v_grn_status WHERE id = v_grn_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_phase6_record(_record_type text, _record_id uuid, _decision text, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _record_type = 'purchase_request' THEN
    IF NOT public.can_purchase(uid) OR _decision NOT IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','CONVERTED','CANCELLED') THEN RAISE EXCEPTION 'Not allowed to update purchase request'; END IF;
    UPDATE public.purchase_requests SET status = _decision, reviewed_by = uid, reviewed_at = now(), review_notes = _notes, submitted_at = CASE WHEN _decision = 'SUBMITTED' THEN now() ELSE submitted_at END, approved_by = CASE WHEN _decision = 'APPROVED' THEN uid ELSE approved_by END, approved_at = CASE WHEN _decision = 'APPROVED' THEN now() ELSE approved_at END WHERE id = _record_id;
  ELSIF _record_type = 'quotation' THEN
    IF NOT public.can_purchase(uid) OR _decision NOT IN ('NEEDS_REVIEW','CONFIRMED','REJECTED','EXPIRED') THEN RAISE EXCEPTION 'Not allowed to review quotation'; END IF;
    UPDATE public.quotations SET status = _decision, reviewed_by = uid, reviewed_at = now(), review_notes = _notes WHERE id = _record_id;
  ELSIF _record_type = 'delivery_revision' THEN
    IF NOT public.can_purchase(uid) OR _decision NOT IN ('ACCEPTED','REJECTED','CLARIFICATION_REQUESTED') THEN RAISE EXCEPTION 'Not allowed to decide delivery revision'; END IF;
    UPDATE public.po_delivery_revisions SET status = _decision, decided_by = uid, decided_at = now(), decision_notes = _notes WHERE id = _record_id;
    IF _decision = 'ACCEPTED' THEN UPDATE public.purchase_orders po SET expected_delivery_date = r.proposed_delivery_date FROM public.po_delivery_revisions r WHERE r.id = _record_id AND po.id = r.po_id; END IF;
  ELSIF _record_type = 'rtv' THEN
    IF NOT (public.can_purchase(uid) OR public.phase6_can_quality(uid)) OR _decision NOT IN ('AUTHORIZED','DISPATCHED','CLOSED') THEN RAISE EXCEPTION 'Not allowed to update supplier return'; END IF;
    UPDATE public.rtv_records SET status = _decision, authorized_by = CASE WHEN _decision = 'AUTHORIZED' THEN uid ELSE authorized_by END, authorized_at = CASE WHEN _decision = 'AUTHORIZED' THEN now() ELSE authorized_at END, dispatched_at = CASE WHEN _decision = 'DISPATCHED' THEN now() ELSE dispatched_at END, closed_by = CASE WHEN _decision = 'CLOSED' THEN uid ELSE closed_by END, closed_at = CASE WHEN _decision = 'CLOSED' THEN now() ELSE closed_at END WHERE id = _record_id;
  ELSIF _record_type = 'expense' THEN
    IF NOT public.phase6_can_finance(uid) OR _decision NOT IN ('FINANCE_REVIEW','APPROVED','REJECTED','PAID') THEN RAISE EXCEPTION 'Not allowed to decide expense'; END IF;
    UPDATE public.quick_expenses SET status = _decision, finance_reviewed_by = uid, finance_reviewed_at = now(), finance_notes = _notes WHERE id = _record_id;
  ELSIF _record_type = 'payment_milestone' THEN
    IF NOT public.phase6_can_finance(uid) OR _decision NOT IN ('PENDING_APPROVAL','APPROVED','BLOCKED','PAID','CANCELLED') THEN RAISE EXCEPTION 'Not allowed to decide payment milestone'; END IF;
    UPDATE public.payment_milestones SET status = _decision, requested_by = COALESCE(requested_by, uid), approved_by = CASE WHEN _decision IN ('APPROVED','PAID') THEN uid ELSE approved_by END, approved_at = CASE WHEN _decision IN ('APPROVED','PAID') THEN now() ELSE approved_at END, approval_notes = _notes WHERE id = _record_id;
  ELSE RAISE EXCEPTION 'Unsupported review record type';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_phase6_rfq(_purchase_request_id uuid, _project_id uuid, _response_due_date date, _terms text, _vendor_ids uuid[] DEFAULT ARRAY[]::uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); v_id uuid; v_number text; v_vendor uuid; BEGIN
  IF uid IS NULL OR NOT public.can_purchase(uid) THEN RAISE EXCEPTION 'Not allowed to create RFQs'; END IF;
  v_number := public.next_business_number('rfq', 'PUR/PD', NULL);
  INSERT INTO public.rfqs(rfq_number, purchase_request_id, project_id, response_due_date, terms, created_by) VALUES (v_number, _purchase_request_id, _project_id, _response_due_date, _terms, uid) RETURNING id INTO v_id;
  FOREACH v_vendor IN ARRAY COALESCE(_vendor_ids, ARRAY[]::uuid[]) LOOP
    INSERT INTO public.rfq_vendors(rfq_id, vendor_id, status, sent_at) VALUES (v_id, v_vendor, 'INVITED', NULL) ON CONFLICT (rfq_id, vendor_id) DO NOTHING;
  END LOOP;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_phase6_quotation(_rfq_id uuid, _vendor_id uuid, _quoted_at date, _valid_until date, _lead_time_days integer, _payment_terms text, _items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); v_id uuid; v_number text; item jsonb; BEGIN
  IF uid IS NULL OR NOT public.can_purchase(uid) THEN RAISE EXCEPTION 'Not allowed to record quotations'; END IF;
  IF jsonb_array_length(COALESCE(_items, '[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'Add at least one quotation line'; END IF;
  v_number := public.next_business_number('quotation', 'PUR/PD', NULL);
  INSERT INTO public.quotations(quotation_number, rfq_id, vendor_id, quoted_at, valid_until, lead_time_days, payment_terms, status, created_by) VALUES (v_number, _rfq_id, _vendor_id, _quoted_at, _valid_until, _lead_time_days, _payment_terms, 'NEEDS_REVIEW', uid) RETURNING id INTO v_id;
  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.quotation_items(quotation_id, component_id, mpn, description, quantity, unit_price, moq, lead_time_days, notes)
      VALUES (v_id, NULLIF(item->>'component_id','')::uuid, NULLIF(item->>'mpn',''), NULLIF(item->>'description',''), COALESCE((item->>'quantity')::numeric, 0), COALESCE((item->>'unit_price')::numeric, 0), NULLIF(item->>'moq','')::numeric, NULLIF(item->>'lead_time_days','')::integer, NULLIF(item->>'notes',''));
  END LOOP;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_grn(uuid,text,date,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_grn(uuid,text,date,text,jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.decide_incoming_inspection(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_incoming_inspection(uuid,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.review_phase6_record(text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_phase6_record(text,uuid,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_phase6_rfq(uuid,uuid,date,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_phase6_rfq(uuid,uuid,date,text,uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_phase6_quotation(uuid,uuid,date,date,integer,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_phase6_quotation(uuid,uuid,date,date,integer,text,jsonb) TO authenticated, service_role;
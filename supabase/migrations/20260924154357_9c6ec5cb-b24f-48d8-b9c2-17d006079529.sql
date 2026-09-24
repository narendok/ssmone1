CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.inventory_transaction_requests (
  request_key uuid PRIMARY KEY,
  transaction_type text NOT NULL CHECK (transaction_type IN ('GRN', 'MATERIAL_ISSUE', 'MATERIAL_RETURN', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT')),
  requested_by uuid NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED')),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_transaction_requests TO authenticated;
GRANT ALL ON public.inventory_transaction_requests TO service_role;
ALTER TABLE public.inventory_transaction_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.material_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), issue_number text NOT NULL UNIQUE,
  request_key uuid NOT NULL UNIQUE REFERENCES public.inventory_transaction_requests(request_key), assignment_batch_id uuid REFERENCES public.assignment_batches(id),
  assignee_id uuid NOT NULL REFERENCES public.rd_members(id), project_id uuid REFERENCES public.projects(id), project_name text, notes text, issued_by uuid NOT NULL, issued_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.material_issues TO authenticated;
GRANT ALL ON public.material_issues TO service_role;
ALTER TABLE public.material_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operational users can read material issues" ON public.material_issues FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view','inventory.manage','procurement.view','procurement.manage']) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.material_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), return_number text NOT NULL UNIQUE,
  request_key uuid NOT NULL UNIQUE REFERENCES public.inventory_transaction_requests(request_key), assignment_id uuid NOT NULL REFERENCES public.assignments(id), quantity integer NOT NULL CHECK (quantity > 0), returned_by uuid NOT NULL, returned_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.material_returns TO authenticated;
GRANT ALL ON public.material_returns TO service_role;
ALTER TABLE public.material_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operational users can read material returns" ON public.material_returns FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view','inventory.manage','procurement.view','procurement.manage']) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transfer_number text NOT NULL UNIQUE,
  request_key uuid NOT NULL UNIQUE REFERENCES public.inventory_transaction_requests(request_key), component_id uuid NOT NULL REFERENCES public.components(id), from_location_id uuid NOT NULL REFERENCES public.locations(id), to_location_id uuid NOT NULL REFERENCES public.locations(id), quantity integer NOT NULL CHECK (quantity > 0), notes text, transferred_by uuid NOT NULL, transferred_at timestamptz NOT NULL DEFAULT now(), CHECK (from_location_id <> to_location_id)
);
GRANT SELECT ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operational users can read stock transfers" ON public.stock_transfers FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view','inventory.manage','procurement.view','procurement.manage']) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), adjustment_number text NOT NULL UNIQUE,
  request_key uuid NOT NULL UNIQUE REFERENCES public.inventory_transaction_requests(request_key), component_id uuid NOT NULL REFERENCES public.components(id), location_id uuid NOT NULL REFERENCES public.locations(id), delta integer NOT NULL CHECK (delta <> 0), reason text NOT NULL CHECK (length(trim(reason)) > 0), adjusted_by uuid NOT NULL, adjusted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_adjustments TO authenticated;
GRANT ALL ON public.stock_adjustments TO service_role;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operational users can read stock adjustments" ON public.stock_adjustments FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view','inventory.manage','procurement.view','procurement.manage']) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX material_issues_assignee_issued_at_idx ON public.material_issues (assignee_id, issued_at DESC);
CREATE INDEX material_returns_assignment_returned_at_idx ON public.material_returns (assignment_id, returned_at DESC);
CREATE INDEX stock_transfers_component_transferred_at_idx ON public.stock_transfers (component_id, transferred_at DESC);
CREATE INDEX stock_adjustments_component_adjusted_at_idx ON public.stock_adjustments (component_id, adjusted_at DESC);

CREATE OR REPLACE FUNCTION public.inventory_payload_hash(_payload jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT md5(jsonb_strip_nulls(_payload)::text) $$;
CREATE OR REPLACE FUNCTION public.inventory_request_result(_request_key uuid, _transaction_type text, _payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_hash text; existing_type text; existing_result jsonb; computed_hash text;
BEGIN
  computed_hash := public.inventory_payload_hash(_payload);
  SELECT transaction_type, payload_hash, result INTO existing_type, existing_hash, existing_result FROM public.inventory_transaction_requests WHERE request_key = _request_key FOR UPDATE;
  IF FOUND THEN
    IF existing_type <> _transaction_type OR existing_hash <> computed_hash THEN RAISE EXCEPTION 'Idempotency key already used with a different request'; END IF;
    RETURN existing_result;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_grn(_po_id uuid, _vendor_invoice_number text, _vendor_invoice_date date, _storage_notes text, _items jsonb, _idempotency_key uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); grn_id uuid; grn_no text; po_no text; po_vendor_id uuid; it jsonb; loc_id uuid; grn_item_id uuid; qty int; rej int; comp uuid; total int := 0; total_rej int := 0; remaining int; new_status text; payload jsonb; cached jsonb; result jsonb;
BEGIN
  IF uid IS NULL OR NOT public.can_inward(uid) THEN RAISE EXCEPTION 'Not allowed to record goods receipts'; END IF;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'No received items provided'; END IF;
  payload := jsonb_build_object('po_id', _po_id, 'vendor_invoice_number', _vendor_invoice_number, 'vendor_invoice_date', _vendor_invoice_date, 'storage_notes', _storage_notes, 'items', _items);
  IF _idempotency_key IS NOT NULL THEN cached := public.inventory_request_result(_idempotency_key, 'GRN', payload); IF cached IS NOT NULL THEN RETURN cached; END IF; END IF;
  SELECT po_number, vendor_id INTO po_no, po_vendor_id FROM public.purchase_orders WHERE id = _po_id FOR UPDATE;
  IF po_no IS NULL THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  PERFORM 1 FROM public.purchase_order_items WHERE po_id = _po_id ORDER BY id FOR UPDATE;
  grn_no := public.next_document_number('GRN');
  INSERT INTO public.goods_receipt_notes(grn_number, po_id, vendor_invoice_number, vendor_invoice_date, received_by, storage_location_notes, quality_status) VALUES (grn_no, _po_id, _vendor_invoice_number, _vendor_invoice_date, uid, _storage_notes, 'PENDING_IQC') RETURNING id INTO grn_id;
  FOR it IN SELECT value FROM jsonb_array_elements(_items) AS x(value) ORDER BY value->>'po_item_id', value->>'component_id' LOOP
    qty := COALESCE((it->>'quantity')::int, 0); rej := COALESCE((it->>'quantity_rejected')::int, 0); comp := (it->>'component_id')::uuid;
    IF (qty <= 0 AND rej <= 0) OR comp IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE id = NULLIF(it->>'po_item_id','')::uuid AND po_id = _po_id AND component_id = comp) THEN RAISE EXCEPTION 'Received item does not belong to this purchase order'; END IF;
    IF qty + rej > COALESCE((SELECT quantity_ordered - quantity_received - quantity_rejected FROM public.purchase_order_items WHERE id = NULLIF(it->>'po_item_id','')::uuid), 0) THEN RAISE EXCEPTION 'Received quantity exceeds the outstanding purchase order quantity'; END IF;
    loc_id := NULLIF(it->>'location_id','')::uuid;
    IF loc_id IS NULL AND qty > 0 THEN INSERT INTO public.locations(component_id, location_type, label, quantity) VALUES (comp, COALESCE(NULLIF(it->>'location_type',''), 'store'), COALESCE(NULLIF(it->>'location_label',''), 'Basement Store'), 0) RETURNING id INTO loc_id; END IF;
    IF loc_id IS NOT NULL THEN PERFORM 1 FROM public.locations WHERE id = loc_id ORDER BY id FOR UPDATE; END IF;
    INSERT INTO public.goods_receipt_items(grn_id, po_item_id, component_id, location_id, quantity_received, lot_number, date_code, reel_id, quantity_rejected, rejection_reason, rejection_note, quality_status) VALUES (grn_id, NULLIF(it->>'po_item_id','')::uuid, comp, loc_id, qty, NULLIF(it->>'lot_number',''), NULLIF(it->>'date_code',''), NULLIF(it->>'reel_id',''), rej, NULLIF(it->>'rejection_reason',''), NULLIF(it->>'rejection_note',''), CASE WHEN qty > 0 THEN 'QUALITY_HOLD' ELSE 'REJECTED' END) RETURNING id INTO grn_item_id;
    IF qty > 0 THEN UPDATE public.purchase_order_items SET quantity_received = quantity_received + qty WHERE id = NULLIF(it->>'po_item_id','')::uuid; UPDATE public.locations SET quantity = quantity + qty WHERE id = loc_id; INSERT INTO public.inventory_lots(component_id, grn_item_id, location_id, lot_number, date_code, reel_id, quantity_received, quantity_available, quality_status) VALUES (comp, grn_item_id, loc_id, NULLIF(it->>'lot_number',''), NULLIF(it->>'date_code',''), NULLIF(it->>'reel_id',''), qty, qty, 'QUALITY_HOLD'); INSERT INTO public.incoming_inspections(grn_id, grn_item_id, vendor_id, status, applicability_reason) VALUES (grn_id, grn_item_id, po_vendor_id, 'PENDING', 'Generated automatically from GRN'); INSERT INTO public.stock_history(component_id, location_id, delta, action, note, user_id) VALUES (comp, loc_id, qty, 'inward_quality_hold', grn_no || ' (' || po_no || ') pending incoming quality', uid); total := total + qty; END IF;
    IF rej > 0 THEN UPDATE public.purchase_order_items SET quantity_rejected = quantity_rejected + rej WHERE id = NULLIF(it->>'po_item_id','')::uuid; total_rej := total_rej + rej; END IF;
  END LOOP;
  SELECT COUNT(*) INTO remaining FROM public.purchase_order_items WHERE po_id = _po_id AND NOT short_closed AND quantity_received + quantity_rejected < quantity_ordered;
  new_status := CASE WHEN remaining = 0 THEN 'RECEIVED' ELSE 'PARTIALLY_RECEIVED' END; UPDATE public.purchase_orders SET status = new_status WHERE id = _po_id;
  result := jsonb_build_object('grn_id', grn_id, 'grn_number', grn_no, 'total_quantity', total, 'total_rejected', total_rej, 'po_status', new_status);
  IF _idempotency_key IS NOT NULL THEN INSERT INTO public.inventory_transaction_requests(request_key, transaction_type, requested_by, payload_hash, result) VALUES (_idempotency_key, 'GRN', uid, public.inventory_payload_hash(payload), result); END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_material_issue(_assignee_id uuid, _project_id uuid, _project_name text, _notes text, _items jsonb, _idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); payload jsonb; cached jsonb; issue_id uuid; batch_id uuid; issue_no text; item jsonb; loc record; result jsonb; assignee_name text;
BEGIN
  IF uid IS NULL OR NOT (public.has_any_permission(uid, ARRAY['inventory.manage','procurement.manage']) OR public.has_role(uid,'admin')) THEN RAISE EXCEPTION 'Not allowed to issue material'; END IF;
  IF _idempotency_key IS NULL OR jsonb_array_length(_items) = 0 OR _assignee_id IS NULL THEN RAISE EXCEPTION 'Assignee, item(s), and request key are required'; END IF;
  payload := jsonb_build_object('assignee_id',_assignee_id,'project_id',_project_id,'project_name',_project_name,'notes',_notes,'items',_items); cached := public.inventory_request_result(_idempotency_key,'MATERIAL_ISSUE',payload); IF cached IS NOT NULL THEN RETURN cached; END IF;
  SELECT name INTO assignee_name FROM public.rd_members WHERE id=_assignee_id AND active; IF assignee_name IS NULL THEN RAISE EXCEPTION 'Active R&D member not found'; END IF;
  PERFORM 1 FROM public.locations WHERE id IN (SELECT NULLIF(value->>'location_id','')::uuid FROM jsonb_array_elements(_items)) ORDER BY id FOR UPDATE;
  INSERT INTO public.assignment_batches(assignee_id, project_id, notes, created_by) VALUES (_assignee_id,_project_id,_notes,uid) RETURNING id INTO batch_id; issue_no := public.next_document_number('ISSUE');
  INSERT INTO public.material_issues(issue_number,request_key,assignment_batch_id,assignee_id,project_id,project_name,notes,issued_by) VALUES(issue_no,_idempotency_key,batch_id,_assignee_id,_project_id,_project_name,_notes,uid) RETURNING id INTO issue_id;
  FOR item IN SELECT value FROM jsonb_array_elements(_items) AS x(value) ORDER BY value->>'location_id',value->>'component_id' LOOP
    SELECT * INTO loc FROM public.locations WHERE id=NULLIF(item->>'location_id','')::uuid; IF NOT FOUND OR loc.component_id <> NULLIF(item->>'component_id','')::uuid THEN RAISE EXCEPTION 'Invalid issue location'; END IF;
    IF COALESCE((item->>'quantity')::int,0) <= 0 OR loc.quantity < (item->>'quantity')::int THEN RAISE EXCEPTION 'Insufficient stock for material issue'; END IF;
    UPDATE public.locations SET quantity=quantity-(item->>'quantity')::int WHERE id=loc.id;
    INSERT INTO public.assignments(component_id,location_id,quantity,quantity_returned,assignee_id,assigned_by,batch_id,project_id,project_name,notes,status) VALUES(loc.component_id,loc.id,(item->>'quantity')::int,0,_assignee_id,uid,batch_id,_project_id,_project_name,_notes,'assigned');
    INSERT INTO public.stock_history(component_id,location_id,delta,action,note,user_id) VALUES(loc.component_id,loc.id,-(item->>'quantity')::int,'assign',issue_no || ': issued to ' || assignee_name,uid);
  END LOOP;
  result := jsonb_build_object('issue_id',issue_id,'issue_number',issue_no,'assignment_batch_id',batch_id); INSERT INTO public.inventory_transaction_requests(request_key,transaction_type,requested_by,payload_hash,result) VALUES(_idempotency_key,'MATERIAL_ISSUE',uid,public.inventory_payload_hash(payload),result); RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_material_return(_assignment_id uuid, _quantity integer, _idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); payload jsonb; cached jsonb; a record; return_no text; return_id uuid; result jsonb; new_returned integer; new_status text;
BEGIN
  IF uid IS NULL OR NOT (public.has_any_permission(uid, ARRAY['inventory.manage','procurement.manage']) OR public.has_role(uid,'admin')) THEN RAISE EXCEPTION 'Not allowed to return material'; END IF;
  IF _idempotency_key IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Quantity and request key are required'; END IF;
  payload := jsonb_build_object('assignment_id',_assignment_id,'quantity',_quantity); cached := public.inventory_request_result(_idempotency_key,'MATERIAL_RETURN',payload); IF cached IS NOT NULL THEN RETURN cached; END IF;
  SELECT * INTO a FROM public.assignments WHERE id=_assignment_id FOR UPDATE; IF NOT FOUND OR a.location_id IS NULL THEN RAISE EXCEPTION 'Assignment not found'; END IF; PERFORM 1 FROM public.locations WHERE id=a.location_id FOR UPDATE;
  IF a.quantity_returned + _quantity > a.quantity THEN RAISE EXCEPTION 'Return quantity exceeds issued quantity'; END IF;
  new_returned := a.quantity_returned + _quantity; new_status := CASE WHEN new_returned >= a.quantity THEN 'returned' ELSE 'partial' END; return_no := public.next_document_number('RETURN');
  INSERT INTO public.material_returns(return_number,request_key,assignment_id,quantity,returned_by) VALUES(return_no,_idempotency_key,_assignment_id,_quantity,uid) RETURNING id INTO return_id;
  UPDATE public.assignments SET quantity_returned=new_returned,status=new_status,returned_at=CASE WHEN new_status='returned' THEN now() ELSE NULL END WHERE id=_assignment_id; UPDATE public.locations SET quantity=quantity+_quantity WHERE id=a.location_id;
  INSERT INTO public.stock_history(component_id,location_id,delta,action,note,user_id) VALUES(a.component_id,a.location_id,_quantity,'return',return_no || ': returned from assignment',uid);
  result := jsonb_build_object('return_id',return_id,'return_number',return_no,'assignment_id',_assignment_id,'status',new_status); INSERT INTO public.inventory_transaction_requests(request_key,transaction_type,requested_by,payload_hash,result) VALUES(_idempotency_key,'MATERIAL_RETURN',uid,public.inventory_payload_hash(payload),result); RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_stock_transfer(_component_id uuid, _from_location_id uuid, _to_location_id uuid, _quantity integer, _notes text, _idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); payload jsonb; cached jsonb; source record; destination record; transfer_id uuid; transfer_no text; result jsonb;
BEGIN
  IF uid IS NULL OR NOT (public.has_any_permission(uid, ARRAY['inventory.manage','procurement.manage']) OR public.has_role(uid,'admin')) THEN RAISE EXCEPTION 'Not allowed to transfer stock'; END IF;
  IF _idempotency_key IS NULL OR _quantity <= 0 OR _from_location_id=_to_location_id THEN RAISE EXCEPTION 'Valid transfer details and request key are required'; END IF;
  payload := jsonb_build_object('component_id',_component_id,'from_location_id',_from_location_id,'to_location_id',_to_location_id,'quantity',_quantity,'notes',_notes); cached := public.inventory_request_result(_idempotency_key,'STOCK_TRANSFER',payload); IF cached IS NOT NULL THEN RETURN cached; END IF;
  PERFORM 1 FROM public.locations WHERE id IN (_from_location_id,_to_location_id) ORDER BY id FOR UPDATE; SELECT * INTO source FROM public.locations WHERE id=_from_location_id; SELECT * INTO destination FROM public.locations WHERE id=_to_location_id;
  IF NOT FOUND OR source.component_id<>_component_id OR destination.component_id<>_component_id OR source.quantity<_quantity THEN RAISE EXCEPTION 'Invalid transfer location or insufficient stock'; END IF;
  transfer_no := public.next_document_number('TRANSFER'); INSERT INTO public.stock_transfers(transfer_number,request_key,component_id,from_location_id,to_location_id,quantity,notes,transferred_by) VALUES(transfer_no,_idempotency_key,_component_id,_from_location_id,_to_location_id,_quantity,_notes,uid) RETURNING id INTO transfer_id;
  UPDATE public.locations SET quantity=quantity-_quantity WHERE id=_from_location_id; UPDATE public.locations SET quantity=quantity+_quantity WHERE id=_to_location_id;
  INSERT INTO public.stock_history(component_id,location_id,delta,action,note,user_id) VALUES(_component_id,_from_location_id,-_quantity,'transfer_out',transfer_no,uid),(_component_id,_to_location_id,_quantity,'transfer_in',transfer_no,uid);
  result := jsonb_build_object('transfer_id',transfer_id,'transfer_number',transfer_no); INSERT INTO public.inventory_transaction_requests(request_key,transaction_type,requested_by,payload_hash,result) VALUES(_idempotency_key,'STOCK_TRANSFER',uid,public.inventory_payload_hash(payload),result); RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_stock_adjustment(_component_id uuid, _location_id uuid, _delta integer, _reason text, _idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); payload jsonb; cached jsonb; loc record; adjustment_no text; adjustment_id uuid; result jsonb;
BEGIN
  IF uid IS NULL OR NOT (public.has_any_permission(uid, ARRAY['inventory.manage','procurement.manage']) OR public.has_role(uid,'admin')) THEN RAISE EXCEPTION 'Not allowed to adjust stock'; END IF;
  IF _idempotency_key IS NULL OR _delta=0 OR length(trim(coalesce(_reason,'')))=0 THEN RAISE EXCEPTION 'Adjustment reason, quantity, and request key are required'; END IF;
  payload := jsonb_build_object('component_id',_component_id,'location_id',_location_id,'delta',_delta,'reason',_reason); cached := public.inventory_request_result(_idempotency_key,'STOCK_ADJUSTMENT',payload); IF cached IS NOT NULL THEN RETURN cached; END IF;
  SELECT * INTO loc FROM public.locations WHERE id=_location_id FOR UPDATE; IF NOT FOUND OR loc.component_id<>_component_id OR loc.quantity+_delta<0 THEN RAISE EXCEPTION 'Invalid adjustment location or insufficient stock'; END IF;
  adjustment_no := public.next_document_number('ADJUSTMENT'); INSERT INTO public.stock_adjustments(adjustment_number,request_key,component_id,location_id,delta,reason,adjusted_by) VALUES(adjustment_no,_idempotency_key,_component_id,_location_id,_delta,_reason,uid) RETURNING id INTO adjustment_id;
  UPDATE public.locations SET quantity=quantity+_delta WHERE id=_location_id; INSERT INTO public.stock_history(component_id,location_id,delta,action,note,user_id) VALUES(_component_id,_location_id,_delta,CASE WHEN _delta>0 THEN 'add' ELSE 'remove' END,adjustment_no || ': ' || _reason,uid);
  result := jsonb_build_object('adjustment_id',adjustment_id,'adjustment_number',adjustment_no); INSERT INTO public.inventory_transaction_requests(request_key,transaction_type,requested_by,payload_hash,result) VALUES(_idempotency_key,'STOCK_ADJUSTMENT',uid,public.inventory_payload_hash(payload),result); RETURN result;
END;
$$;

CREATE OR REPLACE VIEW public.operational_receiving_purchase_orders WITH (security_invoker = true) AS SELECT po.id, po.po_number, po.vendor_id, po.status, po.expected_delivery_date, po.notes, po.created_at, po.updated_at, v.name AS vendor_name, v.contact_person AS vendor_contact_person, v.email AS vendor_email, v.phone AS vendor_phone, v.address AS vendor_address FROM public.purchase_orders po LEFT JOIN public.vendors v ON v.id = po.vendor_id;
CREATE OR REPLACE VIEW public.operational_receiving_purchase_order_items WITH (security_invoker = true) AS SELECT id, po_id, component_id, mpn, description, quantity_ordered, quantity_received, quantity_rejected, short_closed, short_close_reason, created_at FROM public.purchase_order_items;
GRANT SELECT ON public.operational_receiving_purchase_orders, public.operational_receiving_purchase_order_items TO authenticated;
GRANT ALL ON public.operational_receiving_purchase_orders, public.operational_receiving_purchase_order_items TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.locations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.stock_history FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_grn(uuid,text,date,text,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_material_issue(uuid,uuid,text,text,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_material_return(uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_stock_transfer(uuid,uuid,uuid,integer,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_stock_adjustment(uuid,uuid,integer,text,uuid) TO authenticated;
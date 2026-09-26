CREATE OR REPLACE FUNCTION public.approve_inventory_csv_row(
  _approved_by uuid,
  _mpn text,
  _name text,
  _manufacturer text,
  _category_id uuid,
  _footprint text,
  _quantity integer,
  _location_type text,
  _location_label text,
  _low_stock_threshold integer,
  _supplier_url text,
  _datasheet_url text,
  _idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  cached jsonb;
  normalized_mpn text;
  matched_component_id uuid;
  matched_location_id uuid;
  visible_lot_id uuid;
  stock_event_id uuid;
  component_count integer;
  fallback_category_id uuid;
  created_component boolean := false;
  created_location boolean := false;
  final_location_quantity integer;
  result jsonb;
BEGIN
  IF _approved_by IS NULL OR NOT (
    public.has_any_permission(_approved_by, ARRAY['inventory.manage', 'procurement.manage'])
    OR public.has_role(_approved_by, 'admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed to approve inventory rows';
  END IF;
  IF _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'A request key is required';
  END IF;
  IF length(trim(coalesce(_mpn, ''))) = 0
    OR length(trim(coalesce(_name, ''))) = 0
    OR coalesce(_quantity, 0) <= 0
    OR length(trim(coalesce(_location_type, ''))) = 0
    OR length(trim(coalesce(_location_label, ''))) = 0
    OR coalesce(_low_stock_threshold, 0) < 0 THEN
    RAISE EXCEPTION 'Part number, name, positive quantity, location, and non-negative low-stock threshold are required';
  END IF;

  payload := jsonb_build_object(
    'approved_by', _approved_by, 'mpn', trim(_mpn), 'name', trim(_name),
    'manufacturer', nullif(trim(coalesce(_manufacturer, '')), ''), 'category_id', _category_id,
    'footprint', nullif(trim(coalesce(_footprint, '')), ''), 'quantity', _quantity,
    'location_type', trim(_location_type), 'location_label', trim(_location_label),
    'low_stock_threshold', _low_stock_threshold, 'supplier_url', nullif(trim(coalesce(_supplier_url, '')), ''),
    'datasheet_url', nullif(trim(coalesce(_datasheet_url, '')), '')
  );
  cached := public.inventory_request_result(_idempotency_key, 'INVENTORY_CSV_APPROVAL', payload);
  IF cached IS NOT NULL THEN
    IF coalesce((cached->>'location_quantity')::integer, 0) <= 0
      OR nullif(cached->>'stock_event_id', '') IS NULL
      OR nullif(cached->>'location_id', '') IS NULL THEN
      RAISE EXCEPTION 'Stored inventory posting is incomplete; retry with a new request key after review';
    END IF;
    RETURN cached;
  END IF;

  normalized_mpn := regexp_replace(upper(trim(_mpn)), '[^A-Z0-9]', '', 'g');
  PERFORM pg_advisory_xact_lock(hashtext('inventory-component:' || normalized_mpn));
  SELECT count(*) INTO component_count FROM public.components c
  WHERE regexp_replace(upper(c.part_number), '[^A-Z0-9]', '', 'g') = normalized_mpn;
  IF component_count > 1 THEN
    RAISE EXCEPTION 'More than one inventory component matches this part number; resolve the part number before approving';
  END IF;
  IF component_count = 1 THEN
    SELECT c.id INTO matched_component_id FROM public.components c
    WHERE regexp_replace(upper(c.part_number), '[^A-Z0-9]', '', 'g') = normalized_mpn LIMIT 1;
  END IF;
  IF matched_component_id IS NULL THEN
    SELECT c.id INTO fallback_category_id FROM public.categories c
    WHERE lower(c.name) = 'uncategorized' ORDER BY c.sort_order, c.id LIMIT 1;
    IF _category_id IS NULL THEN _category_id := fallback_category_id; END IF;
    IF _category_id IS NULL THEN RAISE EXCEPTION 'Choose a category before approving this new component'; END IF;
    INSERT INTO public.components (category_id, name, part_number, manufacturer, value, package_case, footprint, supplier_url, datasheet_url, low_stock_threshold, needs_review)
    VALUES (_category_id, trim(_name), trim(_mpn), nullif(trim(coalesce(_manufacturer, '')), ''), trim(_name), nullif(trim(coalesce(_footprint, '')), ''), nullif(trim(coalesce(_footprint, '')), ''), nullif(trim(coalesce(_supplier_url, '')), ''), nullif(trim(coalesce(_datasheet_url, '')), ''), _low_stock_threshold, false)
    RETURNING id INTO matched_component_id;
    created_component := true;
  ELSE
    UPDATE public.components SET low_stock_threshold = _low_stock_threshold WHERE id = matched_component_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('inventory-location:' || matched_component_id::text || ':' || lower(trim(_location_type)) || ':' || lower(trim(_location_label))));
  SELECT l.id INTO matched_location_id FROM public.locations l
  WHERE l.component_id = matched_component_id AND l.location_type = trim(_location_type) AND l.label = trim(_location_label)
  ORDER BY l.id LIMIT 1 FOR UPDATE;
  IF matched_location_id IS NULL THEN
    INSERT INTO public.locations(component_id, location_type, label, quantity)
    VALUES (matched_component_id, trim(_location_type), trim(_location_label), 0)
    RETURNING id INTO matched_location_id;
    created_location := true;
  END IF;
  UPDATE public.locations SET quantity = quantity + _quantity WHERE id = matched_location_id RETURNING quantity INTO final_location_quantity;
  IF coalesce(final_location_quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Inventory posting did not persist a positive location quantity';
  END IF;
  INSERT INTO public.inventory_lots(component_id, location_id, lot_number, quantity_received, quantity_available, quality_status)
  VALUES (matched_component_id, matched_location_id, 'CSV-' || _idempotency_key::text, _quantity, _quantity, 'AVAILABLE')
  RETURNING id INTO visible_lot_id;
  INSERT INTO public.stock_history(component_id, location_id, delta, action, note, user_id)
  VALUES (matched_component_id, matched_location_id, _quantity, 'inventory_csv_approval', 'Approved inventory import', _approved_by)
  RETURNING id INTO stock_event_id;
  IF stock_event_id IS NULL THEN
    RAISE EXCEPTION 'Inventory posting did not persist a stock-history event';
  END IF;
  result := jsonb_build_object(
    'component_id', matched_component_id, 'location_id', matched_location_id,
    'location_type', trim(_location_type), 'location_label', trim(_location_label),
    'quantity_added', _quantity, 'location_quantity', final_location_quantity,
    'inventory_lot_id', visible_lot_id, 'stock_event_id', stock_event_id,
    'created_component', created_component, 'created_location', created_location
  );
  INSERT INTO public.inventory_transaction_requests(request_key, transaction_type, requested_by, payload_hash, result)
  VALUES (_idempotency_key, 'INVENTORY_CSV_APPROVAL', _approved_by, public.inventory_payload_hash(payload), result);
  INSERT INTO public.activity_log(module_key, entity_type, entity_id, action, summary, actor_user_id, after_data)
  VALUES ('inventory', 'component', matched_component_id, 'inventory_csv_approved', 'Inventory import approved for ' || trim(_mpn), _approved_by, result);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_historical_zero_stock_component(
  _approved_by uuid,
  _component_id uuid,
  _quantity integer,
  _location_type text,
  _location_label text,
  _source_note text,
  _idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  component_row public.components%ROWTYPE;
  result jsonb;
BEGIN
  IF _approved_by IS NULL OR NOT public.has_role(_approved_by, 'admin') THEN
    RAISE EXCEPTION 'Only Administrators can recover historical inventory';
  END IF;
  IF _component_id IS NULL OR _idempotency_key IS NULL OR coalesce(_quantity, 0) <= 0
    OR length(trim(coalesce(_location_type, ''))) = 0 OR length(trim(coalesce(_location_label, ''))) = 0
    OR length(trim(coalesce(_source_note, ''))) = 0 THEN
    RAISE EXCEPTION 'Component, positive quantity, storage area, bin, source note, and request key are required';
  END IF;
  SELECT * INTO component_row FROM public.components WHERE id = _component_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Component not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.locations WHERE component_id = _component_id AND quantity > 0)
    OR EXISTS (SELECT 1 FROM public.stock_history WHERE component_id = _component_id) THEN
    RAISE EXCEPTION 'This component already has stock history or a positive location quantity and cannot use historical recovery';
  END IF;
  result := public.approve_inventory_csv_row(
    _approved_by, component_row.part_number, component_row.name, component_row.manufacturer,
    component_row.category_id, coalesce(component_row.footprint, component_row.package_case), _quantity,
    _location_type, _location_label, component_row.low_stock_threshold,
    component_row.supplier_url, component_row.datasheet_url, _idempotency_key
  );
  IF coalesce((result->>'location_quantity')::integer, 0) <= 0 OR nullif(result->>'stock_event_id', '') IS NULL THEN
    RAISE EXCEPTION 'Historical recovery did not persist a positive quantity and stock-history event';
  END IF;
  INSERT INTO public.activity_log(module_key, entity_type, entity_id, action, summary, actor_user_id, after_data)
  VALUES ('inventory', 'component', _component_id, 'historical_zero_stock_recovered', 'Historical zero-stock recovery posted from verified source: ' || trim(_source_note), _approved_by, result || jsonb_build_object('source_note', trim(_source_note)));
  RETURN result || jsonb_build_object('source_note', trim(_source_note));
END;
$$;

REVOKE ALL ON FUNCTION public.approve_inventory_csv_row(uuid,text,text,text,uuid,text,integer,text,text,integer,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_inventory_csv_row(uuid,text,text,text,uuid,text,integer,text,text,integer,text,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.recover_historical_zero_stock_component(uuid,uuid,integer,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_historical_zero_stock_component(uuid,uuid,integer,text,text,text,uuid) TO service_role;
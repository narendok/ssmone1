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
  component_count integer;
  fallback_category_id uuid;
  created_component boolean := false;
  created_location boolean := false;
  result jsonb;
BEGIN
  IF _approved_by IS NULL OR NOT (
    public.has_any_permission(_approved_by, ARRAY['inventory.manage', 'procurement.manage'])
    OR public.has_role(_approved_by, 'admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed to approve inventory CSV rows';
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
    'approved_by', _approved_by,
    'mpn', trim(_mpn),
    'name', trim(_name),
    'manufacturer', nullif(trim(coalesce(_manufacturer, '')), ''),
    'category_id', _category_id,
    'footprint', nullif(trim(coalesce(_footprint, '')), ''),
    'quantity', _quantity,
    'location_type', trim(_location_type),
    'location_label', trim(_location_label),
    'low_stock_threshold', _low_stock_threshold,
    'supplier_url', nullif(trim(coalesce(_supplier_url, '')), ''),
    'datasheet_url', nullif(trim(coalesce(_datasheet_url, '')), '')
  );
  cached := public.inventory_request_result(_idempotency_key, 'INVENTORY_CSV_APPROVAL', payload);
  IF cached IS NOT NULL THEN
    RETURN cached;
  END IF;

  normalized_mpn := regexp_replace(upper(trim(_mpn)), '[^A-Z0-9]', '', 'g');
  SELECT count(*), min(c.id)
    INTO component_count, matched_component_id
  FROM public.components c
  WHERE regexp_replace(upper(c.part_number), '[^A-Z0-9]', '', 'g') = normalized_mpn;

  IF component_count > 1 THEN
    RAISE EXCEPTION 'More than one inventory component matches this part number; resolve the part number before approving';
  END IF;

  IF matched_component_id IS NULL THEN
    SELECT c.id INTO fallback_category_id
    FROM public.categories c
    WHERE lower(c.name) = 'uncategorized'
    ORDER BY c.sort_order, c.id
    LIMIT 1;

    IF _category_id IS NULL THEN
      _category_id := fallback_category_id;
    END IF;
    IF _category_id IS NULL THEN
      RAISE EXCEPTION 'Choose a category before approving this new component';
    END IF;

    INSERT INTO public.components (
      category_id, name, part_number, manufacturer, value, package_case, footprint,
      supplier_url, datasheet_url, low_stock_threshold, needs_review
    ) VALUES (
      _category_id, trim(_name), trim(_mpn), nullif(trim(coalesce(_manufacturer, '')), ''),
      trim(_name), nullif(trim(coalesce(_footprint, '')), ''), nullif(trim(coalesce(_footprint, '')), ''),
      nullif(trim(coalesce(_supplier_url, '')), ''), nullif(trim(coalesce(_datasheet_url, '')), ''),
      _low_stock_threshold, false
    ) RETURNING id INTO matched_component_id;
    created_component := true;
  ELSE
    UPDATE public.components
    SET low_stock_threshold = _low_stock_threshold
    WHERE id = matched_component_id;
  END IF;

  SELECT l.id INTO matched_location_id
  FROM public.locations l
  WHERE l.component_id = matched_component_id
    AND l.location_type = trim(_location_type)
    AND l.label = trim(_location_label)
  ORDER BY l.id
  LIMIT 1
  FOR UPDATE;

  IF matched_location_id IS NULL THEN
    INSERT INTO public.locations(component_id, location_type, label, quantity)
    VALUES (matched_component_id, trim(_location_type), trim(_location_label), 0)
    RETURNING id INTO matched_location_id;
    created_location := true;
  END IF;

  UPDATE public.locations
  SET quantity = quantity + _quantity
  WHERE id = matched_location_id;

  INSERT INTO public.inventory_lots(
    component_id, location_id, lot_number, quantity_received, quantity_available, quality_status
  ) VALUES (
    matched_component_id, matched_location_id, 'CSV-' || _idempotency_key::text,
    _quantity, _quantity, 'AVAILABLE'
  ) RETURNING id INTO visible_lot_id;

  INSERT INTO public.stock_history(component_id, location_id, delta, action, note, user_id)
  VALUES (
    matched_component_id, matched_location_id, _quantity, 'inventory_csv_approval',
    'Approved from inventory CSV review', _approved_by
  );

  result := jsonb_build_object(
    'component_id', matched_component_id,
    'location_id', matched_location_id,
    'inventory_lot_id', visible_lot_id,
    'quantity_added', _quantity,
    'created_component', created_component,
    'created_location', created_location
  );

  INSERT INTO public.inventory_transaction_requests(request_key, transaction_type, requested_by, payload_hash, result)
  VALUES (_idempotency_key, 'INVENTORY_CSV_APPROVAL', _approved_by, public.inventory_payload_hash(payload), result);

  INSERT INTO public.activity_log(module_key, entity_type, entity_id, action, summary, actor_user_id, after_data)
  VALUES (
    'inventory', 'component', matched_component_id, 'inventory_csv_approved',
    'Inventory CSV row approved for ' || trim(_mpn), _approved_by, result
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_inventory_csv_row(uuid,text,text,text,uuid,text,integer,text,text,integer,text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_inventory_csv_row(uuid,text,text,text,uuid,text,integer,text,text,integer,text,text,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.approve_inventory_csv_row(uuid,text,text,text,uuid,text,integer,text,text,integer,text,text,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approve_inventory_csv_row(uuid,text,text,text,uuid,text,integer,text,text,integer,text,text,uuid) TO service_role;
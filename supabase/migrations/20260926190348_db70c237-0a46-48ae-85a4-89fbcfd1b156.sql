CREATE OR REPLACE FUNCTION public.post_stock_adjustment(
  _component_id uuid,
  _location_id uuid,
  _delta integer,
  _reason text,
  _idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  payload jsonb;
  cached jsonb;
  loc record;
  adjustment_no text;
  adjustment_id uuid;
  result jsonb;
BEGIN
  IF uid IS NULL OR NOT (
    public.has_any_permission(uid, ARRAY['inventory.manage', 'procurement.manage'])
    OR public.has_role(uid, 'admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed to adjust stock';
  END IF;

  IF _idempotency_key IS NULL OR _delta = 0 OR length(trim(coalesce(_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Adjustment reason, quantity, and request key are required';
  END IF;

  payload := jsonb_build_object(
    'component_id', _component_id,
    'location_id', _location_id,
    'delta', _delta,
    'reason', _reason
  );
  cached := public.inventory_request_result(_idempotency_key, 'STOCK_ADJUSTMENT', payload);
  IF cached IS NOT NULL THEN
    RETURN cached;
  END IF;

  SELECT * INTO loc
  FROM public.locations
  WHERE id = _location_id
  FOR UPDATE;

  IF NOT FOUND OR loc.component_id <> _component_id OR loc.quantity + _delta < 0 THEN
    RAISE EXCEPTION 'Invalid adjustment location or insufficient stock';
  END IF;

  adjustment_no := public.next_document_number('ADJUSTMENT');
  result := jsonb_build_object('adjustment_number', adjustment_no);

  INSERT INTO public.inventory_transaction_requests (
    request_key,
    transaction_type,
    requested_by,
    payload_hash,
    result
  ) VALUES (
    _idempotency_key,
    'STOCK_ADJUSTMENT',
    uid,
    public.inventory_payload_hash(payload),
    result
  );

  INSERT INTO public.stock_adjustments (
    adjustment_number,
    request_key,
    component_id,
    location_id,
    delta,
    reason,
    adjusted_by
  ) VALUES (
    adjustment_no,
    _idempotency_key,
    _component_id,
    _location_id,
    _delta,
    _reason,
    uid
  ) RETURNING id INTO adjustment_id;

  UPDATE public.locations
  SET quantity = quantity + _delta
  WHERE id = _location_id;

  INSERT INTO public.stock_history (
    component_id,
    location_id,
    delta,
    action,
    note,
    user_id
  ) VALUES (
    _component_id,
    _location_id,
    _delta,
    CASE WHEN _delta > 0 THEN 'add' ELSE 'remove' END,
    adjustment_no || ': ' || _reason,
    uid
  );

  result := jsonb_build_object(
    'adjustment_id', adjustment_id,
    'adjustment_number', adjustment_no
  );

  UPDATE public.inventory_transaction_requests AS requests
  SET result = result
  WHERE requests.request_key = _idempotency_key;

  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.post_stock_adjustment(uuid, uuid, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_stock_adjustment(uuid, uuid, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_stock_adjustment(uuid, uuid, integer, text, uuid) TO service_role;
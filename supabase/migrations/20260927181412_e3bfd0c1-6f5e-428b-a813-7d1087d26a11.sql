CREATE TABLE public.inventory_cycle_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'COUNTED', 'POSTED', 'CANCELLED')),
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  due_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.inventory_cycle_counts TO authenticated;
GRANT ALL ON public.inventory_cycle_counts TO service_role;
ALTER TABLE public.inventory_cycle_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cycle count assignees and inventory leads view counts"
  ON public.inventory_cycle_counts FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'procurement.manage'])
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Inventory leads create cycle counts"
  ON public.inventory_cycle_counts FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = auth.uid()
    AND (
      public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage'])
      OR public.has_role(auth.uid(), 'admin')
    )
  );
CREATE POLICY "Inventory leads manage cycle counts"
  ON public.inventory_cycle_counts FOR UPDATE TO authenticated
  USING (
    public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage'])
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage'])
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TABLE public.inventory_cycle_count_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id uuid NOT NULL REFERENCES public.inventory_cycle_counts(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.components(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  expected_quantity integer NOT NULL CHECK (expected_quantity >= 0),
  counted_quantity integer,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COUNTED', 'POSTED', 'CANCELLED')),
  counted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  counted_at timestamptz,
  posted_adjustment_id uuid REFERENCES public.stock_adjustments(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_count_id, location_id)
);
GRANT SELECT, INSERT, UPDATE ON public.inventory_cycle_count_lines TO authenticated;
GRANT ALL ON public.inventory_cycle_count_lines TO service_role;
ALTER TABLE public.inventory_cycle_count_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cycle count assignees and inventory leads view count lines"
  ON public.inventory_cycle_count_lines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_cycle_counts counts
      WHERE counts.id = inventory_cycle_count_lines.cycle_count_id
        AND (
          counts.assigned_to = auth.uid()
          OR public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'procurement.manage'])
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );
CREATE POLICY "Inventory leads create count lines"
  ON public.inventory_cycle_count_lines FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage'])
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Assigned users count and inventory leads manage lines"
  ON public.inventory_cycle_count_lines FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_cycle_counts counts
      WHERE counts.id = inventory_cycle_count_lines.cycle_count_id
        AND (
          counts.assigned_to = auth.uid()
          OR public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage'])
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_cycle_counts counts
      WHERE counts.id = inventory_cycle_count_lines.cycle_count_id
        AND (
          counts.assigned_to = auth.uid()
          OR public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage'])
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_entity_type text,
  ADD COLUMN IF NOT EXISTS target_entity_id uuid;
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_target_url_relative_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_target_url_relative_check
  CHECK (target_url IS NULL OR target_url ~ '^/[A-Za-z0-9_/?=&.-]*$');

CREATE OR REPLACE FUNCTION public.mark_notification_read(_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  updated_notification public.notifications%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  UPDATE public.notifications
  SET is_read = true,
      read_at = COALESCE(read_at, now())
  WHERE id = _notification_id
    AND user_id = auth.uid()
  RETURNING * INTO updated_notification;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;

  RETURN jsonb_build_object(
    'id', updated_notification.id,
    'is_read', updated_notification.is_read,
    'read_at', updated_notification.read_at,
    'target_url', updated_notification.target_url,
    'target_entity_type', updated_notification.target_entity_type,
    'target_entity_id', updated_notification.target_entity_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_cycle_count(
  _cycle_count_line_id uuid,
  _counted_quantity integer,
  _reason text,
  _idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  line_record public.inventory_cycle_count_lines%ROWTYPE;
  count_record public.inventory_cycle_counts%ROWTYPE;
  location_record public.locations%ROWTYPE;
  cached jsonb;
  payload jsonb;
  response_payload jsonb;
  adjustment_number text;
  adjustment_id uuid;
  delta_quantity integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;
  IF _cycle_count_line_id IS NULL OR _counted_quantity IS NULL OR _counted_quantity < 0 OR _idempotency_key IS NULL OR length(trim(coalesce(_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Count line, non-negative quantity, reason, and request key are required';
  END IF;

  payload := jsonb_build_object(
    'cycle_count_line_id', _cycle_count_line_id,
    'counted_quantity', _counted_quantity,
    'reason', _reason
  );
  cached := public.inventory_request_result(_idempotency_key, 'CYCLE_COUNT', payload);
  IF cached IS NOT NULL THEN
    RETURN cached;
  END IF;

  SELECT * INTO line_record
  FROM public.inventory_cycle_count_lines
  WHERE id = _cycle_count_line_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle-count line not found';
  END IF;

  SELECT * INTO count_record
  FROM public.inventory_cycle_counts
  WHERE id = line_record.cycle_count_id
  FOR UPDATE;
  IF NOT FOUND OR count_record.status NOT IN ('ASSIGNED', 'COUNTED') THEN
    RAISE EXCEPTION 'Cycle count is not open';
  END IF;
  IF count_record.assigned_to <> uid
    AND NOT public.has_any_permission(uid, ARRAY['inventory.manage', 'procurement.manage'])
    AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Not allowed to submit this cycle count';
  END IF;
  IF line_record.status NOT IN ('PENDING', 'COUNTED') THEN
    RAISE EXCEPTION 'Cycle-count line is not open';
  END IF;

  SELECT * INTO location_record
  FROM public.locations
  WHERE id = line_record.location_id
  FOR UPDATE;
  IF NOT FOUND OR location_record.component_id <> line_record.component_id THEN
    RAISE EXCEPTION 'Cycle-count location is invalid';
  END IF;

  delta_quantity := _counted_quantity - location_record.quantity;
  response_payload := jsonb_build_object(
    'cycle_count_line_id', line_record.id,
    'cycle_count_id', count_record.id,
    'counted_quantity', _counted_quantity,
    'delta', delta_quantity,
    'status', CASE WHEN delta_quantity = 0 THEN 'COUNTED' ELSE 'POSTED' END
  );

  INSERT INTO public.inventory_transaction_requests (
    request_key, transaction_type, requested_by, payload_hash, result
  ) VALUES (
    _idempotency_key, 'CYCLE_COUNT', uid, public.inventory_payload_hash(payload), response_payload
  );

  UPDATE public.inventory_cycle_count_lines
  SET expected_quantity = location_record.quantity,
      counted_quantity = _counted_quantity,
      counted_by = uid,
      counted_at = now(),
      status = CASE WHEN delta_quantity = 0 THEN 'COUNTED' ELSE 'POSTED' END,
      updated_at = now()
  WHERE id = line_record.id;

  IF delta_quantity <> 0 THEN
    IF NOT (
      public.has_any_permission(uid, ARRAY['inventory.manage', 'procurement.manage'])
      OR public.has_role(uid, 'admin')
    ) THEN
      RAISE EXCEPTION 'Only inventory-authorized users can post a count discrepancy';
    END IF;

    adjustment_number := public.next_document_number('ADJUSTMENT');
    INSERT INTO public.stock_adjustments (
      adjustment_number, request_key, component_id, location_id, delta, reason, adjusted_by
    ) VALUES (
      adjustment_number, _idempotency_key, line_record.component_id, line_record.location_id,
      delta_quantity, 'Cycle count: ' || _reason, uid
    ) RETURNING id INTO adjustment_id;

    UPDATE public.locations
    SET quantity = _counted_quantity,
        updated_at = now()
    WHERE id = location_record.id;

    INSERT INTO public.stock_history (
      component_id, location_id, delta, action, note, user_id
    ) VALUES (
      line_record.component_id, location_record.id, delta_quantity,
      CASE WHEN delta_quantity > 0 THEN 'add' ELSE 'remove' END,
      adjustment_number || ': Cycle count: ' || _reason, uid
    );

    UPDATE public.inventory_cycle_count_lines
    SET posted_adjustment_id = adjustment_id,
        updated_at = now()
    WHERE id = line_record.id;

    response_payload := response_payload || jsonb_build_object(
      'adjustment_id', adjustment_id,
      'adjustment_number', adjustment_number
    );
    UPDATE public.inventory_transaction_requests AS requests
    SET result = response_payload
    WHERE requests.request_key = _idempotency_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_cycle_count_lines lines
    WHERE lines.cycle_count_id = count_record.id
      AND lines.status IN ('PENDING', 'COUNTED')
  ) THEN
    UPDATE public.inventory_cycle_counts
    SET status = 'POSTED', updated_at = now()
    WHERE id = count_record.id;
  ELSIF count_record.status = 'ASSIGNED' THEN
    UPDATE public.inventory_cycle_counts
    SET status = 'COUNTED', updated_at = now()
    WHERE id = count_record.id;
  END IF;

  RETURN response_payload;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_cycle_count(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_cycle_count(uuid, integer, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_production_kit_pick(
  _kit_line_id uuid,
  _picked_quantity numeric,
  _idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  kit_line public.production_kit_lines%ROWTYPE;
  kit_record public.production_kits%ROWTYPE;
  material_record public.work_order_materials%ROWTYPE;
  lot_record public.inventory_lots%ROWTYPE;
  cached jsonb;
  payload jsonb;
  response_payload jsonb;
  remaining_required numeric;
BEGIN
  IF uid IS NULL OR NOT (
    public.has_role(uid, 'admin')
    OR public.has_permission(uid, 'production.edit')
    OR public.can_inward(uid)
  ) THEN
    RAISE EXCEPTION 'Not allowed to confirm a production-kit pick';
  END IF;
  IF _kit_line_id IS NULL OR _picked_quantity IS NULL OR _picked_quantity <= 0 OR _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Kit line, positive picked quantity, and request key are required';
  END IF;

  payload := jsonb_build_object(
    'kit_line_id', _kit_line_id,
    'picked_quantity', _picked_quantity
  );
  cached := public.inventory_request_result(_idempotency_key, 'PRODUCTION_KIT_PICK', payload);
  IF cached IS NOT NULL THEN
    RETURN cached;
  END IF;

  SELECT * INTO kit_line FROM public.production_kit_lines WHERE id = _kit_line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production-kit line not found';
  END IF;
  SELECT * INTO kit_record FROM public.production_kits WHERE id = kit_line.kit_id FOR UPDATE;
  IF NOT FOUND OR kit_record.status NOT IN ('DRAFT', 'PREPARED') THEN
    RAISE EXCEPTION 'Production kit is not open for picking';
  END IF;
  SELECT * INTO lot_record FROM public.inventory_lots WHERE id = kit_line.inventory_lot_id FOR UPDATE;
  IF NOT FOUND OR lot_record.quality_status <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'Inventory lot is not available for picking';
  END IF;
  IF _picked_quantity > kit_line.quantity_picked - kit_line.quantity_returned THEN
    RAISE EXCEPTION 'Picked quantity exceeds the remaining kit-line quantity';
  END IF;

  IF kit_line.work_order_material_id IS NOT NULL THEN
    SELECT * INTO material_record FROM public.work_order_materials WHERE id = kit_line.work_order_material_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Work-order material not found';
    END IF;
    remaining_required := material_record.required_quantity - material_record.issued_quantity;
    IF _picked_quantity > remaining_required THEN
      RAISE EXCEPTION 'Picked quantity exceeds the remaining work-order requirement';
    END IF;
  END IF;

  response_payload := jsonb_build_object(
    'kit_line_id', kit_line.id,
    'kit_id', kit_record.id,
    'picked_quantity', _picked_quantity,
    'status', 'CONFIRMED'
  );
  INSERT INTO public.inventory_transaction_requests (
    request_key, transaction_type, requested_by, payload_hash, result
  ) VALUES (
    _idempotency_key, 'PRODUCTION_KIT_PICK', uid, public.inventory_payload_hash(payload), response_payload
  );

  UPDATE public.inventory_lots
  SET quantity_available = quantity_available - _picked_quantity,
      updated_at = now()
  WHERE id = lot_record.id;

  IF kit_line.work_order_material_id IS NOT NULL THEN
    UPDATE public.work_order_materials
    SET issued_quantity = issued_quantity + _picked_quantity,
        status = CASE WHEN issued_quantity + _picked_quantity >= required_quantity THEN 'ISSUED' ELSE status END,
        updated_at = now()
    WHERE id = material_record.id;
  END IF;

  UPDATE public.production_kits
  SET status = 'PREPARED',
      prepared_by = COALESCE(prepared_by, uid),
      prepared_at = COALESCE(prepared_at, now()),
      updated_at = now()
  WHERE id = kit_record.id;

  INSERT INTO public.stock_history (
    component_id, location_id, delta, action, note, user_id
  ) VALUES (
    lot_record.component_id, lot_record.location_id, -_picked_quantity::integer,
    'remove', 'Production kit pick: ' || kit_record.kit_number, uid
  );

  RETURN response_payload;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_production_kit_pick(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_production_kit_pick(uuid, numeric, uuid) TO service_role;

DROP TRIGGER IF EXISTS inventory_cycle_counts_touch_updated_at ON public.inventory_cycle_counts;
CREATE TRIGGER inventory_cycle_counts_touch_updated_at
BEFORE UPDATE ON public.inventory_cycle_counts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS inventory_cycle_count_lines_touch_updated_at ON public.inventory_cycle_count_lines;
CREATE TRIGGER inventory_cycle_count_lines_touch_updated_at
BEFORE UPDATE ON public.inventory_cycle_count_lines
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
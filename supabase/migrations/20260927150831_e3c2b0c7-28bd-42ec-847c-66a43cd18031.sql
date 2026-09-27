CREATE OR REPLACE FUNCTION public.post_material_issue(
  _assignee_id uuid,
  _project_id uuid,
  _project_name text,
  _notes text,
  _items jsonb,
  _idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  payload jsonb;
  cached jsonb;
  issue_id uuid;
  batch_id uuid;
  issue_no text;
  item jsonb;
  loc record;
  result jsonb;
  assignee_name text;
BEGIN
  IF uid IS NULL OR NOT (
    public.has_any_permission(uid, ARRAY['inventory.manage','procurement.manage'])
    OR public.has_role(uid, 'admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed to issue material';
  END IF;

  IF _idempotency_key IS NULL OR jsonb_array_length(_items) = 0 OR _assignee_id IS NULL THEN
    RAISE EXCEPTION 'Assignee, item(s), and request key are required';
  END IF;

  payload := jsonb_build_object(
    'assignee_id', _assignee_id,
    'project_id', _project_id,
    'project_name', _project_name,
    'notes', _notes,
    'items', _items
  );
  cached := public.inventory_request_result(_idempotency_key, 'MATERIAL_ISSUE', payload);
  IF cached IS NOT NULL THEN
    RETURN cached;
  END IF;

  SELECT name INTO assignee_name
  FROM public.rd_members
  WHERE id = _assignee_id AND active;
  IF assignee_name IS NULL THEN
    RAISE EXCEPTION 'Active R&D member not found';
  END IF;

  PERFORM 1
  FROM public.locations
  WHERE id IN (
    SELECT NULLIF(value->>'location_id','')::uuid
    FROM jsonb_array_elements(_items)
  )
  ORDER BY id
  FOR UPDATE;

  INSERT INTO public.inventory_transaction_requests(
    request_key, transaction_type, requested_by, payload_hash, result
  ) VALUES (
    _idempotency_key, 'MATERIAL_ISSUE', uid, public.inventory_payload_hash(payload), '{}'::jsonb
  );

  INSERT INTO public.assignment_batches(assignee_id, project_id, notes, created_by)
  VALUES (_assignee_id, _project_id, _notes, uid)
  RETURNING id INTO batch_id;

  issue_no := public.next_document_number('ISSUE');
  INSERT INTO public.material_issues(
    issue_number, request_key, assignment_batch_id, assignee_id, project_id, project_name, notes, issued_by
  ) VALUES (
    issue_no, _idempotency_key, batch_id, _assignee_id, _project_id, _project_name, _notes, uid
  ) RETURNING id INTO issue_id;

  FOR item IN
    SELECT value
    FROM jsonb_array_elements(_items) AS x(value)
    ORDER BY value->>'location_id', value->>'component_id'
  LOOP
    SELECT * INTO loc
    FROM public.locations
    WHERE id = NULLIF(item->>'location_id','')::uuid;

    IF NOT FOUND OR loc.component_id <> NULLIF(item->>'component_id','')::uuid THEN
      RAISE EXCEPTION 'Invalid issue location';
    END IF;
    IF COALESCE((item->>'quantity')::int, 0) <= 0 OR loc.quantity < (item->>'quantity')::int THEN
      RAISE EXCEPTION 'Insufficient stock for material issue';
    END IF;

    UPDATE public.locations
    SET quantity = quantity - (item->>'quantity')::int
    WHERE id = loc.id;

    INSERT INTO public.assignments(
      component_id, location_id, quantity, quantity_returned, assignee_id, assigned_by,
      batch_id, project_id, project_name, notes, status
    ) VALUES (
      loc.component_id, loc.id, (item->>'quantity')::int, 0, _assignee_id, uid,
      batch_id, _project_id, _project_name, _notes, 'assigned'
    );

    INSERT INTO public.stock_history(component_id, location_id, delta, action, note, user_id)
    VALUES (
      loc.component_id, loc.id, -(item->>'quantity')::int, 'assign',
      issue_no || ': issued to ' || assignee_name, uid
    );
  END LOOP;

  result := jsonb_build_object(
    'issue_id', issue_id,
    'issue_number', issue_no,
    'assignment_batch_id', batch_id
  );

  UPDATE public.inventory_transaction_requests
  SET result = result, completed_at = now()
  WHERE request_key = _idempotency_key;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_material_return(
  _assignment_id uuid,
  _quantity integer,
  _idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  payload jsonb;
  cached jsonb;
  a record;
  return_no text;
  return_id uuid;
  result jsonb;
  new_returned integer;
  new_status text;
BEGIN
  IF uid IS NULL OR NOT (
    public.has_any_permission(uid, ARRAY['inventory.manage','procurement.manage'])
    OR public.has_role(uid, 'admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed to return material';
  END IF;

  IF _idempotency_key IS NULL OR _quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity and request key are required';
  END IF;

  payload := jsonb_build_object('assignment_id', _assignment_id, 'quantity', _quantity);
  cached := public.inventory_request_result(_idempotency_key, 'MATERIAL_RETURN', payload);
  IF cached IS NOT NULL THEN
    RETURN cached;
  END IF;

  SELECT * INTO a
  FROM public.assignments
  WHERE id = _assignment_id
  FOR UPDATE;
  IF NOT FOUND OR a.location_id IS NULL THEN
    RAISE EXCEPTION 'Assignment not found';
  END IF;

  PERFORM 1
  FROM public.locations
  WHERE id = a.location_id
  FOR UPDATE;

  IF a.quantity_returned + _quantity > a.quantity THEN
    RAISE EXCEPTION 'Return quantity exceeds issued quantity';
  END IF;

  INSERT INTO public.inventory_transaction_requests(
    request_key, transaction_type, requested_by, payload_hash, result
  ) VALUES (
    _idempotency_key, 'MATERIAL_RETURN', uid, public.inventory_payload_hash(payload), '{}'::jsonb
  );

  new_returned := a.quantity_returned + _quantity;
  new_status := CASE WHEN new_returned >= a.quantity THEN 'returned' ELSE 'partial' END;
  return_no := public.next_document_number('RETURN');

  INSERT INTO public.material_returns(return_number, request_key, assignment_id, quantity, returned_by)
  VALUES (return_no, _idempotency_key, _assignment_id, _quantity, uid)
  RETURNING id INTO return_id;

  UPDATE public.assignments
  SET quantity_returned = new_returned,
      status = new_status,
      returned_at = CASE WHEN new_status = 'returned' THEN now() ELSE NULL END
  WHERE id = _assignment_id;

  UPDATE public.locations
  SET quantity = quantity + _quantity
  WHERE id = a.location_id;

  INSERT INTO public.stock_history(component_id, location_id, delta, action, note, user_id)
  VALUES (a.component_id, a.location_id, _quantity, 'return', return_no || ': returned from assignment', uid);

  result := jsonb_build_object(
    'return_id', return_id,
    'return_number', return_no,
    'assignment_id', _assignment_id,
    'status', new_status
  );

  UPDATE public.inventory_transaction_requests
  SET result = result, completed_at = now()
  WHERE request_key = _idempotency_key;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.post_material_issue(uuid,uuid,text,text,jsonb,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_material_issue(uuid,uuid,text,text,jsonb,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.post_material_issue(uuid,uuid,text,text,jsonb,uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.post_material_return(uuid,integer,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_material_return(uuid,integer,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.post_material_return(uuid,integer,uuid) TO authenticated, service_role;
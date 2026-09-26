CREATE OR REPLACE FUNCTION public.manage_component_location(
  _approved_by uuid,
  _component_id uuid,
  _location_id uuid DEFAULT NULL,
  _location_type text DEFAULT NULL,
  _location_label text DEFAULT NULL,
  _delete boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_location public.locations%ROWTYPE;
  saved_location public.locations%ROWTYPE;
BEGIN
  IF _approved_by IS NULL OR NOT (
    public.has_any_permission(_approved_by, ARRAY['inventory.manage', 'procurement.manage'])
    OR public.has_role(_approved_by, 'admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed to manage storage locations';
  END IF;

  IF _component_id IS NULL THEN
    RAISE EXCEPTION 'A component is required';
  END IF;

  IF _location_id IS NOT NULL THEN
    SELECT * INTO existing_location
    FROM public.locations
    WHERE id = _location_id AND component_id = _component_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The selected storage location no longer exists. Refresh and try again.';
    END IF;

    IF _delete THEN
      IF existing_location.quantity <> 0 THEN
        RAISE EXCEPTION 'Remove stock through Stock adjustment before removing a storage location.';
      END IF;
      DELETE FROM public.locations WHERE id = existing_location.id;
      RETURN jsonb_build_object('location_id', existing_location.id, 'deleted', true);
    END IF;

    IF length(trim(coalesce(_location_type, ''))) = 0 OR length(trim(coalesce(_location_label, ''))) = 0 THEN
      RAISE EXCEPTION 'Storage area and bin label are required';
    END IF;

    UPDATE public.locations
    SET location_type = trim(_location_type), label = trim(_location_label)
    WHERE id = existing_location.id
    RETURNING * INTO saved_location;
  ELSE
    IF _delete THEN
      RETURN jsonb_build_object('deleted', false);
    END IF;

    IF length(trim(coalesce(_location_type, ''))) = 0 OR length(trim(coalesce(_location_label, ''))) = 0 THEN
      RAISE EXCEPTION 'Storage area and bin label are required';
    END IF;

    INSERT INTO public.locations(component_id, location_type, label, quantity)
    VALUES (_component_id, trim(_location_type), trim(_location_label), 0)
    RETURNING * INTO saved_location;
  END IF;

  RETURN jsonb_build_object(
    'location_id', saved_location.id,
    'component_id', saved_location.component_id,
    'location_type', saved_location.location_type,
    'location_label', saved_location.label,
    'location_quantity', saved_location.quantity,
    'deleted', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.manage_component_location(uuid,uuid,uuid,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_component_location(uuid,uuid,uuid,text,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.verify_notification_contract()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_event_key text;
  v_id uuid;
  v_unread_before integer;
  v_unread_after integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Administrator access is required';
  END IF;

  v_event_key := 'verification-contract:' || auth.uid()::text || ':' || to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI');

  INSERT INTO public.notifications (
    user_id, category, title, body, target_url, target_entity_type, event_key
  ) VALUES (
    auth.uid(),
    'SYSTEM',
    'TEST ONLY — Notification contract verification',
    'Safe inbox-only verification of unread and read-state handling.',
    '/tasks',
    'notification_verification',
    v_event_key
  )
  ON CONFLICT (user_id, event_key) WHERE event_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.notifications WHERE user_id = auth.uid() AND event_key = v_event_key;
  END IF;

  SELECT count(*)::integer INTO v_unread_before
  FROM public.notifications
  WHERE user_id = auth.uid() AND is_read = false;

  UPDATE public.notifications
  SET is_read = true,
      read_at = COALESCE(read_at, now())
  WHERE id = v_id AND user_id = auth.uid();

  SELECT count(*)::integer INTO v_unread_after
  FROM public.notifications
  WHERE user_id = auth.uid() AND is_read = false;

  RETURN jsonb_build_object(
    'notification_id', v_id,
    'created_for_current_admin_only', true,
    'unread_before_read', v_unread_before,
    'marked_read', jsonb_build_object('id', v_id, 'is_read', true),
    'unread_after_read', v_unread_after,
    'passed', v_unread_after = v_unread_before - 1
  );
END;
$$;
REVOKE ALL ON FUNCTION public.verify_notification_contract() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_notification_contract() TO authenticated, service_role;
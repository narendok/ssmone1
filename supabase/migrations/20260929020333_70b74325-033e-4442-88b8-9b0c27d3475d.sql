CREATE OR REPLACE FUNCTION public.create_notification_verification()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_event_key text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Administrator access is required';
  END IF;

  v_event_key := 'verification:' || auth.uid()::text || ':' || to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI');

  INSERT INTO public.notifications (
    user_id, category, title, body, target_url, target_entity_type, event_key
  ) VALUES (
    auth.uid(),
    'SYSTEM',
    'TEST ONLY — Notification verification',
    'This safe inbox-only verification confirms unread and read-state handling.',
    '/tasks',
    'notification_verification',
    v_event_key
  )
  ON CONFLICT (user_id, event_key) WHERE event_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.notifications
    WHERE user_id = auth.uid() AND event_key = v_event_key;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'event_key', v_event_key);
END;
$$;
REVOKE ALL ON FUNCTION public.create_notification_verification() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_notification_verification() TO authenticated, service_role;
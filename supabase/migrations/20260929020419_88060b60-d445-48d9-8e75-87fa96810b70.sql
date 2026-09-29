CREATE OR REPLACE FUNCTION public.verify_notification_contract()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_event_key text;
  v_id uuid;
  v_state_before jsonb;
  v_marked jsonb;
  v_state_after jsonb;
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

  v_state_before := public.get_notification_inbox_state();
  PERFORM public.mark_notification_read(v_id);
  v_marked := jsonb_build_object('id', v_id, 'is_read', true);
  v_state_after := public.get_notification_inbox_state();

  RETURN jsonb_build_object(
    'notification_id', v_id,
    'created_for_current_admin_only', true,
    'unread_before_read', (v_state_before ->> 'unread_count')::integer,
    'marked_read', v_marked,
    'unread_after_read', (v_state_after ->> 'unread_count')::integer,
    'passed', (v_state_after ->> 'unread_count')::integer = (v_state_before ->> 'unread_count')::integer - 1
  );
END;
$$;
REVOKE ALL ON FUNCTION public.verify_notification_contract() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_notification_contract() TO authenticated, service_role;
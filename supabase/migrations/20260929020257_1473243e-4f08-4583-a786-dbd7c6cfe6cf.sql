ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_recipient_event_key_unique
ON public.notifications (user_id, event_key)
WHERE event_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  _user_id uuid,
  _category text,
  _title text,
  _body text,
  _target_url text,
  _target_entity_type text,
  _target_entity_id uuid,
  _event_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _user_id = auth.uid() THEN
    RETURN;
  END IF;

  IF _target_url IS NOT NULL AND _target_url !~ '^/[A-Za-z0-9_/?=&.-]*$' THEN
    RAISE EXCEPTION 'Invalid notification target';
  END IF;

  INSERT INTO public.notifications (
    user_id, category, title, body, target_url, target_entity_type, target_entity_id, event_key
  ) VALUES (
    _user_id, _category, _title, _body, _target_url, _target_entity_type, _target_entity_id, _event_key
  )
  ON CONFLICT (user_id, event_key) WHERE event_key IS NOT NULL DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_notification(uuid, text, text, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_notification(uuid, text, text, text, text, text, uuid, text) TO service_role;
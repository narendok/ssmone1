ALTER TABLE public.external_contacts ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;
ALTER TABLE public.external_portal_access ADD COLUMN IF NOT EXISTS invitation_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE public.external_portal_access ADD COLUMN IF NOT EXISTS invitation_sent_at timestamptz;
ALTER TABLE public.external_portal_access ADD COLUMN IF NOT EXISTS invitation_accepted_at timestamptz;
ALTER TABLE public.external_portal_access ADD COLUMN IF NOT EXISTS invitation_revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS external_parties_customer_id_idx ON public.external_parties(customer_id);
CREATE INDEX IF NOT EXISTS external_parties_vendor_id_idx ON public.external_parties(vendor_id);
CREATE INDEX IF NOT EXISTS external_contacts_user_id_idx ON public.external_contacts(user_id);
CREATE INDEX IF NOT EXISTS external_contacts_party_id_idx ON public.external_contacts(external_party_id);
CREATE INDEX IF NOT EXISTS external_portal_access_contact_active_idx ON public.external_portal_access(external_contact_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS external_share_snapshots_party_active_idx ON public.external_share_snapshots(external_party_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS external_transmittals_party_idx ON public.external_transmittals(external_party_id);
CREATE INDEX IF NOT EXISTS external_review_requests_party_contact_idx ON public.external_review_requests(external_party_id, external_contact_id);
CREATE INDEX IF NOT EXISTS external_actions_party_contact_idx ON public.external_actions(external_party_id, external_contact_id);
CREATE INDEX IF NOT EXISTS external_upload_requests_party_contact_idx ON public.external_upload_requests(external_party_id, external_contact_id);
CREATE INDEX IF NOT EXISTS external_uploads_party_contact_idx ON public.external_uploads(external_party_id, external_contact_id);
CREATE INDEX IF NOT EXISTS external_data_rooms_party_idx ON public.external_data_rooms(external_party_id);
CREATE INDEX IF NOT EXISTS external_data_room_items_room_idx ON public.external_data_room_items(data_room_id);
CREATE INDEX IF NOT EXISTS external_webhook_deliveries_subscription_idx ON public.external_webhook_deliveries(subscription_id);

CREATE OR REPLACE FUNCTION public.external_current_contact_id(_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ec.id
  FROM public.external_contacts ec
  JOIN public.external_parties ep ON ep.id = ec.external_party_id
  WHERE ec.user_id = _user_id
    AND ec.active
    AND ec.portal_enabled
    AND ep.active
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.external_contact_has_access(_contact_id uuid, _portal_type text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.external_portal_access epa
    WHERE epa.external_contact_id = _contact_id
      AND epa.is_active
      AND epa.deactivated_at IS NULL
      AND epa.invitation_revoked_at IS NULL
      AND (epa.expires_at IS NULL OR epa.expires_at > now())
      AND (_portal_type IS NULL OR epa.portal_type = _portal_type)
  )
$$;

CREATE OR REPLACE FUNCTION public.external_is_current_contact(_contact_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _contact_id = public.external_current_contact_id(auth.uid())
    AND public.external_contact_has_access(_contact_id, NULL)
$$;

CREATE OR REPLACE FUNCTION public.external_current_party_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT external_party_id
  FROM public.external_contacts
  WHERE id = public.external_current_contact_id(auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.external_log_access(
  _entity_type text,
  _entity_id uuid,
  _event_type text,
  _snapshot_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contact_id uuid := public.external_current_contact_id(auth.uid());
  party_id uuid;
BEGIN
  IF contact_id IS NULL OR NOT public.external_contact_has_access(contact_id, NULL) THEN
    RAISE EXCEPTION 'External portal access is not active';
  END IF;
  SELECT external_party_id INTO party_id FROM public.external_contacts WHERE id = contact_id;
  INSERT INTO public.external_access_events(external_party_id, external_contact_id, snapshot_id, entity_type, entity_id, event_type, metadata)
  VALUES (party_id, contact_id, _snapshot_id, _entity_type, _entity_id, _event_type, COALESCE(_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.external_current_contact_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.external_contact_has_access(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.external_is_current_contact(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.external_current_party_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.external_log_access(text, uuid, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.external_current_contact_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.external_contact_has_access(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.external_is_current_contact(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.external_current_party_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.external_log_access(text, uuid, text, uuid, jsonb) TO authenticated, service_role;

DROP POLICY IF EXISTS external_contacts_self_view ON public.external_contacts;
CREATE POLICY external_contacts_self_view ON public.external_contacts FOR SELECT TO authenticated USING (id = public.external_current_contact_id(auth.uid()));
DROP POLICY IF EXISTS external_portal_access_self_view ON public.external_portal_access;
CREATE POLICY external_portal_access_self_view ON public.external_portal_access FOR SELECT TO authenticated USING (public.external_is_current_contact(external_contact_id));
DROP POLICY IF EXISTS external_share_snapshots_partner_view ON public.external_share_snapshots;
CREATE POLICY external_share_snapshots_partner_view ON public.external_share_snapshots FOR SELECT TO authenticated USING (
  external_party_id = public.external_current_party_id()
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > now())
  AND (recipient_email IS NULL OR lower(recipient_email) = lower((SELECT email FROM public.external_contacts WHERE id = public.external_current_contact_id(auth.uid()))))
);
DROP POLICY IF EXISTS external_transmittals_partner_view ON public.external_transmittals;
CREATE POLICY external_transmittals_partner_view ON public.external_transmittals FOR SELECT TO authenticated USING (external_party_id = public.external_current_party_id());
DROP POLICY IF EXISTS external_review_requests_partner_view ON public.external_review_requests;
CREATE POLICY external_review_requests_partner_view ON public.external_review_requests FOR SELECT TO authenticated USING (
  external_party_id = public.external_current_party_id()
  AND (external_contact_id IS NULL OR public.external_is_current_contact(external_contact_id))
);
DROP POLICY IF EXISTS external_review_requests_partner_response ON public.external_review_requests;
CREATE POLICY external_review_requests_partner_response ON public.external_review_requests FOR UPDATE TO authenticated
USING (external_party_id = public.external_current_party_id() AND (external_contact_id IS NULL OR public.external_is_current_contact(external_contact_id)))
WITH CHECK (external_party_id = public.external_current_party_id() AND (external_contact_id IS NULL OR public.external_is_current_contact(external_contact_id)));
DROP POLICY IF EXISTS external_actions_partner_view ON public.external_actions;
CREATE POLICY external_actions_partner_view ON public.external_actions FOR SELECT TO authenticated USING (
  external_party_id = public.external_current_party_id()
  AND (external_contact_id IS NULL OR public.external_is_current_contact(external_contact_id))
);
DROP POLICY IF EXISTS external_upload_requests_partner_view ON public.external_upload_requests;
CREATE POLICY external_upload_requests_partner_view ON public.external_upload_requests FOR SELECT TO authenticated USING (
  external_party_id = public.external_current_party_id()
  AND (external_contact_id IS NULL OR public.external_is_current_contact(external_contact_id))
);
DROP POLICY IF EXISTS external_uploads_partner_view ON public.external_uploads;
CREATE POLICY external_uploads_partner_view ON public.external_uploads FOR SELECT TO authenticated USING (
  external_party_id = public.external_current_party_id()
  AND (external_contact_id IS NULL OR public.external_is_current_contact(external_contact_id))
);
DROP POLICY IF EXISTS external_data_rooms_partner_view ON public.external_data_rooms;
CREATE POLICY external_data_rooms_partner_view ON public.external_data_rooms FOR SELECT TO authenticated USING (
  external_party_id = public.external_current_party_id()
  AND status = 'ACTIVE'
  AND (expires_at IS NULL OR expires_at > now())
);
DROP POLICY IF EXISTS external_data_room_items_partner_view ON public.external_data_room_items;
CREATE POLICY external_data_room_items_partner_view ON public.external_data_room_items FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.external_data_rooms room
    WHERE room.id = external_data_room_items.data_room_id
      AND room.external_party_id = public.external_current_party_id()
      AND room.status = 'ACTIVE'
      AND (room.expires_at IS NULL OR room.expires_at > now())
  )
);

GRANT EXECUTE ON FUNCTION public.phase10_assign_identifiers() TO service_role;
GRANT EXECUTE ON FUNCTION public.phase10_touch_updated_at() TO service_role;
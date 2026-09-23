CREATE TABLE public.external_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_code text NOT NULL UNIQUE,
  party_type text NOT NULL,
  display_name text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  portal_title text,
  support_email text,
  preferred_language text NOT NULL DEFAULT 'en',
  timezone text,
  portal_required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_parties_type_check CHECK (party_type IN ('CUSTOMER','OEM','DEALER','DISTRIBUTOR','SUPPLIER','EMS','CONTRACT_MANUFACTURER','EXTERNAL_LAB','CALIBRATION_LAB','CONSULTANT','CONTRACTOR','SERVICE_PARTNER','LOGISTICS_PARTNER','AUDITOR','CERTIFICATION_BODY','OTHER'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_parties TO authenticated;
GRANT ALL ON public.external_parties TO service_role;
ALTER TABLE public.external_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_parties_access ON public.external_parties FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage','sales.view','procurement.view','quality.view','engineering.view','projects.view'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','sales.manage','procurement.manage']));

CREATE TABLE public.external_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_code text NOT NULL UNIQUE,
  external_party_id uuid NOT NULL REFERENCES public.external_parties(id) ON DELETE CASCADE,
  customer_contact_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  designation text,
  email text NOT NULL,
  phone text,
  contact_role text,
  preferred_language text NOT NULL DEFAULT 'en',
  timezone text,
  portal_enabled boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(external_party_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_contacts TO authenticated;
GRANT ALL ON public.external_contacts TO service_role;
ALTER TABLE public.external_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_contacts_access ON public.external_contacts FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage','sales.view','procurement.view'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','sales.manage','procurement.manage']));

CREATE TABLE public.external_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_contact_id uuid NOT NULL REFERENCES public.external_contacts(id) ON DELETE CASCADE,
  access_role text NOT NULL,
  portal_type text NOT NULL,
  access_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  deactivated_at timestamptz,
  deactivation_reason text,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_portal_access TO authenticated;
GRANT ALL ON public.external_portal_access TO service_role;
ALTER TABLE public.external_portal_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_portal_access_staff ON public.external_portal_access FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage'])) WITH CHECK (public.has_permission(auth.uid(), 'external_collaboration.manage'));

CREATE TABLE public.external_share_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_code text NOT NULL UNIQUE,
  external_party_id uuid NOT NULL REFERENCES public.external_parties(id) ON DELETE CASCADE,
  source_entity_type text NOT NULL,
  source_entity_id uuid NOT NULL,
  share_mode text NOT NULL DEFAULT 'FROZEN_SNAPSHOT',
  permission text NOT NULL DEFAULT 'VIEW',
  recipient_email text,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  checksum text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_share_snapshots_mode_check CHECK (share_mode IN ('LIVE_REFERENCE','FROZEN_SNAPSHOT')),
  CONSTRAINT external_share_snapshots_permission_check CHECK (permission IN ('VIEW','DOWNLOAD','UPLOAD'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_share_snapshots TO authenticated;
GRANT ALL ON public.external_share_snapshots TO service_role;
ALTER TABLE public.external_share_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_share_snapshots_staff ON public.external_share_snapshots FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage','documents.view','projects.view','quality.view','procurement.view'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','documents.manage','projects.manage','quality.manage','procurement.manage']));

CREATE TABLE public.external_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_party_id uuid REFERENCES public.external_parties(id) ON DELETE SET NULL,
  external_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  snapshot_id uuid REFERENCES public.external_share_snapshots(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_access_events TO authenticated;
GRANT ALL ON public.external_access_events TO service_role;
ALTER TABLE public.external_access_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_access_events_staff ON public.external_access_events FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage']));
CREATE POLICY external_access_events_service_write ON public.external_access_events FOR INSERT TO authenticated WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage']));

CREATE TABLE public.external_transmittals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transmittal_number text NOT NULL UNIQUE,
  external_party_id uuid NOT NULL REFERENCES public.external_parties(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  purpose text NOT NULL,
  required_action text NOT NULL DEFAULT 'INFORMATION',
  due_date date,
  message text,
  status text NOT NULL DEFAULT 'DRAFT',
  document_manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  issued_at timestamptz,
  received_at timestamptz,
  acknowledged_by_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_transmittals_status_check CHECK (status IN ('DRAFT','ISSUED','RECEIVED','UNDER_REVIEW','RESPONSE_RECEIVED','CLOSED','SUPERSEDED','CANCELLED'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_transmittals TO authenticated;
GRANT ALL ON public.external_transmittals TO service_role;
ALTER TABLE public.external_transmittals ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_transmittals_staff ON public.external_transmittals FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage','documents.view','projects.view','quality.view','procurement.view'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','documents.manage','projects.manage','quality.manage','procurement.manage']));

CREATE TABLE public.external_review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_party_id uuid NOT NULL REFERENCES public.external_parties(id) ON DELETE CASCADE,
  external_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  source_entity_type text NOT NULL,
  source_entity_id uuid NOT NULL,
  request_type text NOT NULL,
  revision_reference text,
  due_date date,
  status text NOT NULL DEFAULT 'OPEN',
  response text,
  response_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  responded_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_review_requests_type_check CHECK (request_type IN ('REVIEW','COMMENT','CONFIRMATION','APPROVAL','INFORMATION','UPLOAD','ACKNOWLEDGEMENT')),
  CONSTRAINT external_review_requests_status_check CHECK (status IN ('OPEN','VIEWED','IN_PROGRESS','CLARIFICATION_REQUIRED','RESPONDED','ACCEPTED','REJECTED','CLOSED','OVERDUE'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_review_requests TO authenticated;
GRANT ALL ON public.external_review_requests TO service_role;
ALTER TABLE public.external_review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_review_requests_staff ON public.external_review_requests FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage','projects.view','quality.view','procurement.view'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','projects.manage','quality.manage','procurement.manage']));

CREATE TABLE public.external_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_code text NOT NULL UNIQUE,
  external_party_id uuid NOT NULL REFERENCES public.external_parties(id) ON DELETE CASCADE,
  external_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  source_entity_type text,
  source_entity_id uuid,
  title text NOT NULL,
  description text,
  due_date date,
  status text NOT NULL DEFAULT 'OPEN',
  response text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_actions_status_check CHECK (status IN ('OPEN','VIEWED','IN_PROGRESS','CLARIFICATION_REQUIRED','RESPONDED','ACCEPTED','REJECTED','CLOSED','OVERDUE'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_actions TO authenticated;
GRANT ALL ON public.external_actions TO service_role;
ALTER TABLE public.external_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_actions_staff ON public.external_actions FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage','projects.view','quality.view','procurement.view'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','projects.manage','quality.manage','procurement.manage']));

CREATE TABLE public.external_upload_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code text NOT NULL UNIQUE,
  external_party_id uuid NOT NULL REFERENCES public.external_parties(id) ON DELETE CASCADE,
  external_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  source_entity_type text,
  source_entity_id uuid,
  requested_document text NOT NULL,
  description text,
  expected_format text,
  required_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_date date,
  status text NOT NULL DEFAULT 'OPEN',
  destination text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_upload_requests TO authenticated;
GRANT ALL ON public.external_upload_requests TO service_role;
ALTER TABLE public.external_upload_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_upload_requests_staff ON public.external_upload_requests FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage','projects.view','quality.view','procurement.view'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','projects.manage','quality.manage','procurement.manage']));

CREATE TABLE public.external_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_code text NOT NULL UNIQUE,
  request_id uuid REFERENCES public.external_upload_requests(id) ON DELETE SET NULL,
  external_party_id uuid NOT NULL REFERENCES public.external_parties(id) ON DELETE CASCADE,
  external_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  original_filename text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint,
  checksum text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING_REVIEW',
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  accepted_drive_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_uploads_status_check CHECK (status IN ('PENDING_REVIEW','ACCEPTED','REJECTED','REPLACEMENT_REQUESTED','LINKED_TO_RECORD'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_uploads TO authenticated;
GRANT ALL ON public.external_uploads TO service_role;
ALTER TABLE public.external_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_uploads_staff ON public.external_uploads FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage','documents.view','quality.view','procurement.view'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','documents.manage','quality.manage','procurement.manage']));

CREATE TABLE public.external_data_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL UNIQUE,
  external_party_id uuid NOT NULL REFERENCES public.external_parties(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  confidentiality_classification text NOT NULL DEFAULT 'CONFIDENTIAL',
  nda_required boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'DRAFT',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_data_rooms_status_check CHECK (status IN ('DRAFT','ACTIVE','EXPIRED','CLOSED'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_data_rooms TO authenticated;
GRANT ALL ON public.external_data_rooms TO service_role;
ALTER TABLE public.external_data_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_data_rooms_staff ON public.external_data_rooms FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage','documents.view','projects.view','quality.view'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','documents.manage','projects.manage','quality.manage']));

CREATE TABLE public.external_data_room_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_room_id uuid NOT NULL REFERENCES public.external_data_rooms(id) ON DELETE CASCADE,
  source_entity_type text NOT NULL,
  source_entity_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'GENERAL',
  revision_reference text,
  is_favorite_eligible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(data_room_id, source_entity_type, source_entity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_data_room_items TO authenticated;
GRANT ALL ON public.external_data_room_items TO service_role;
ALTER TABLE public.external_data_room_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_data_room_items_staff ON public.external_data_room_items FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.view','external_collaboration.manage','documents.view','projects.view','quality.view'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['external_collaboration.manage','documents.manage','projects.manage','quality.manage']));

CREATE TABLE public.external_api_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL UNIQUE,
  external_party_id uuid REFERENCES public.external_parties(id) ON DELETE SET NULL,
  client_key_hint text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_api_clients TO authenticated;
GRANT ALL ON public.external_api_clients TO service_role;
ALTER TABLE public.external_api_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_api_clients_staff ON public.external_api_clients FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'external_collaboration.manage')) WITH CHECK (public.has_permission(auth.uid(), 'external_collaboration.manage'));

CREATE TABLE public.external_webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_party_id uuid REFERENCES public.external_parties(id) ON DELETE SET NULL,
  endpoint_url text NOT NULL,
  event_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  signing_secret_hint text,
  active boolean NOT NULL DEFAULT true,
  last_delivery_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_webhook_subscriptions TO authenticated;
GRANT ALL ON public.external_webhook_subscriptions TO service_role;
ALTER TABLE public.external_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_webhook_subscriptions_staff ON public.external_webhook_subscriptions FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'external_collaboration.manage')) WITH CHECK (public.has_permission(auth.uid(), 'external_collaboration.manage'));

CREATE TABLE public.external_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.external_webhook_subscriptions(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING',
  response_status integer,
  response_summary text,
  attempted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_webhook_deliveries TO authenticated;
GRANT ALL ON public.external_webhook_deliveries TO service_role;
ALTER TABLE public.external_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_webhook_deliveries_staff ON public.external_webhook_deliveries FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'external_collaboration.manage')) WITH CHECK (public.has_permission(auth.uid(), 'external_collaboration.manage'));

CREATE SEQUENCE public.phase10_identifier_seq START 1001;
CREATE OR REPLACE FUNCTION public.phase10_assign_identifiers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.phase10_identifier_seq');
  IF TG_TABLE_NAME = 'external_parties' AND NEW.party_code IS NULL THEN NEW.party_code := 'EXT-' || lpad(n::text, 6, '0'); END IF;
  IF TG_TABLE_NAME = 'external_contacts' AND NEW.contact_code IS NULL THEN NEW.contact_code := 'EXTC-' || lpad(n::text, 6, '0'); END IF;
  IF TG_TABLE_NAME = 'external_share_snapshots' AND NEW.snapshot_code IS NULL THEN NEW.snapshot_code := 'SHR-' || lpad(n::text, 6, '0'); END IF;
  IF TG_TABLE_NAME = 'external_transmittals' AND NEW.transmittal_number IS NULL THEN NEW.transmittal_number := 'TRN-' || lpad(n::text, 6, '0'); END IF;
  IF TG_TABLE_NAME = 'external_actions' AND NEW.action_code IS NULL THEN NEW.action_code := 'EXTA-' || lpad(n::text, 6, '0'); END IF;
  IF TG_TABLE_NAME = 'external_upload_requests' AND NEW.request_code IS NULL THEN NEW.request_code := 'UPR-' || lpad(n::text, 6, '0'); END IF;
  IF TG_TABLE_NAME = 'external_uploads' AND NEW.upload_code IS NULL THEN NEW.upload_code := 'UPL-' || lpad(n::text, 6, '0'); END IF;
  IF TG_TABLE_NAME = 'external_data_rooms' AND NEW.room_code IS NULL THEN NEW.room_code := 'ROOM-' || lpad(n::text, 6, '0'); END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.phase10_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER phase10_parties_identifier BEFORE INSERT ON public.external_parties FOR EACH ROW EXECUTE FUNCTION public.phase10_assign_identifiers();
CREATE TRIGGER phase10_contacts_identifier BEFORE INSERT ON public.external_contacts FOR EACH ROW EXECUTE FUNCTION public.phase10_assign_identifiers();
CREATE TRIGGER phase10_snapshots_identifier BEFORE INSERT ON public.external_share_snapshots FOR EACH ROW EXECUTE FUNCTION public.phase10_assign_identifiers();
CREATE TRIGGER phase10_transmittals_identifier BEFORE INSERT ON public.external_transmittals FOR EACH ROW EXECUTE FUNCTION public.phase10_assign_identifiers();
CREATE TRIGGER phase10_actions_identifier BEFORE INSERT ON public.external_actions FOR EACH ROW EXECUTE FUNCTION public.phase10_assign_identifiers();
CREATE TRIGGER phase10_upload_requests_identifier BEFORE INSERT ON public.external_upload_requests FOR EACH ROW EXECUTE FUNCTION public.phase10_assign_identifiers();
CREATE TRIGGER phase10_uploads_identifier BEFORE INSERT ON public.external_uploads FOR EACH ROW EXECUTE FUNCTION public.phase10_assign_identifiers();
CREATE TRIGGER phase10_rooms_identifier BEFORE INSERT ON public.external_data_rooms FOR EACH ROW EXECUTE FUNCTION public.phase10_assign_identifiers();
CREATE TRIGGER phase10_parties_touch BEFORE UPDATE ON public.external_parties FOR EACH ROW EXECUTE FUNCTION public.phase10_touch_updated_at();
CREATE TRIGGER phase10_contacts_touch BEFORE UPDATE ON public.external_contacts FOR EACH ROW EXECUTE FUNCTION public.phase10_touch_updated_at();
CREATE TRIGGER phase10_portal_touch BEFORE UPDATE ON public.external_portal_access FOR EACH ROW EXECUTE FUNCTION public.phase10_touch_updated_at();
CREATE TRIGGER phase10_transmittals_touch BEFORE UPDATE ON public.external_transmittals FOR EACH ROW EXECUTE FUNCTION public.phase10_touch_updated_at();
CREATE TRIGGER phase10_review_touch BEFORE UPDATE ON public.external_review_requests FOR EACH ROW EXECUTE FUNCTION public.phase10_touch_updated_at();
CREATE TRIGGER phase10_actions_touch BEFORE UPDATE ON public.external_actions FOR EACH ROW EXECUTE FUNCTION public.phase10_touch_updated_at();
CREATE TRIGGER phase10_upload_requests_touch BEFORE UPDATE ON public.external_upload_requests FOR EACH ROW EXECUTE FUNCTION public.phase10_touch_updated_at();
CREATE TRIGGER phase10_uploads_touch BEFORE UPDATE ON public.external_uploads FOR EACH ROW EXECUTE FUNCTION public.phase10_touch_updated_at();
CREATE TRIGGER phase10_rooms_touch BEFORE UPDATE ON public.external_data_rooms FOR EACH ROW EXECUTE FUNCTION public.phase10_touch_updated_at();
CREATE TRIGGER phase10_api_clients_touch BEFORE UPDATE ON public.external_api_clients FOR EACH ROW EXECUTE FUNCTION public.phase10_touch_updated_at();
CREATE TRIGGER phase10_webhooks_touch BEFORE UPDATE ON public.external_webhook_subscriptions FOR EACH ROW EXECUTE FUNCTION public.phase10_touch_updated_at();

INSERT INTO public.application_modules(key, name, group_key, route_path, icon_key, status, sort_order) VALUES ('external_collaboration','External Collaboration','operations','/external-collaboration','Handshake','ENABLED',88) ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name, group_key=EXCLUDED.group_key, route_path=EXCLUDED.route_path, icon_key=EXCLUDED.icon_key, status=EXCLUDED.status, sort_order=EXCLUDED.sort_order;
INSERT INTO public.permissions(key, module_key, label, description) VALUES ('external_collaboration.view','external_collaboration','View external collaboration','View controlled external collaboration records'),('external_collaboration.manage','external_collaboration','Manage external collaboration','Manage external access, sharing, transmittals and integrations') ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description;
INSERT INTO public.automation_rules(rule_key, trigger_key, name, description, execution_mode, is_enabled) VALUES ('phase10_share_expiry','external.share.expiry','External share expiry','Review expiring external shares before access ends','review_required',true),('phase10_action_overdue','external.action.overdue','External action overdue','Review overdue external collaboration actions','review_required',true),('phase10_upload_review','external.upload.pending_review','External upload review','Review staged external uploads before acceptance','review_required',true),('phase10_webhook_failure','external.webhook.failure','Webhook failure','Review unsuccessful external webhook delivery','review_required',true) ON CONFLICT (rule_key) DO UPDATE SET trigger_key=EXCLUDED.trigger_key, name=EXCLUDED.name, description=EXCLUDED.description, execution_mode=EXCLUDED.execution_mode, is_enabled=EXCLUDED.is_enabled;
ALTER TABLE public.external_parties ALTER COLUMN party_code DROP NOT NULL;
ALTER TABLE public.external_contacts ALTER COLUMN contact_code DROP NOT NULL;
ALTER TABLE public.external_share_snapshots ALTER COLUMN snapshot_code DROP NOT NULL;
ALTER TABLE public.external_transmittals ALTER COLUMN transmittal_number DROP NOT NULL;
ALTER TABLE public.external_actions ALTER COLUMN action_code DROP NOT NULL;
ALTER TABLE public.external_upload_requests ALTER COLUMN request_code DROP NOT NULL;
ALTER TABLE public.external_uploads ALTER COLUMN upload_code DROP NOT NULL;
ALTER TABLE public.external_data_rooms ALTER COLUMN room_code DROP NOT NULL;
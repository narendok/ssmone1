# ANDROID BACKEND HANDOFF

## Safe configuration

Provide the Android project only these non-secret values through the Android build environment:

- `SUPABASE_URL`
- `SUPABASE_ANON_OR_PUBLISHABLE_KEY`

Do not add any service key, database password, signing secret, or third-party credential to Android.

## Environment mapping

A single existing managed backend is evidenced by the current project configuration. DEV/UAT/PROD separation is **not evidenced**. Treat the configured endpoint as the only approved environment until a separately provisioned environment strategy is documented.

## App flow

1. Sign in with the existing managed authentication provider.
2. Resolve the signed-in identity through `profiles`, staff linkage through `employees`, and capabilities through RLS/governed permission tables.
3. Query only RLS-permitted records with the publishable client.
4. Use the documented authenticated server mutation/RPC contracts for controlled actions.
5. For private files, request authorized signed delivery/upload flows; never build public object URLs.

## RLS assumptions

- Every mobile request is made with the current user session.
- RLS is authoritative; an empty result may mean access is not granted.
- Never replace an RLS check with locally cached role state.
- Re-check access and state when an offline draft is submitted.

## Storage pattern

Private buckets remain private. Download delivery uses an authorized signed URL when needed. External staged files use a server-issued signed upload token and remain quarantined until reviewed.

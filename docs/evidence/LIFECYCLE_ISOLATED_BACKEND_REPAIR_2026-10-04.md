# Isolated lifecycle backend repair — 2026-10-04

Status: protected routines installed in an isolated managed backend; complete
document-generation acceptance and original/shared deployment remain pending.

## Confirmed isolated environment

Lovable project `798159a5-659a-4a6a-9fa1-30a2d065c054`, named
**SSM One Template Acceptance 2026-10-04**, uses backend
`egjotuxqguifnvdnflan`. It is unpublished. Its schema was remixed from the
original project; the original backend remains `yyrvduosyyaluifqvwkr`.
Independent Cloud SQL inspection found zero projects, departments, auth users
and storage objects, plus four empty buckets before fixture work.

## Independent corrections

Lovable's initial isolated migration was rejected by its permission-revoke
guard. Its retry installed routines that granted authenticated EXECUTE and
referenced nonexistent columns and a nonexistent two-argument numbering
signature. These were not accepted as a working feature.

Codex inspected the actual column names, numbering signature and policy
references, then replaced the isolated routines with repository definitions.
The repair kept project/department-manager checks, locked ancestry, exact
approved template pins, single-pass multiline rendering and actual Drive,
revision, register and activity-log fields. No table, identity or stored object
was deleted, and no policy or privileged credential was changed.

`pgcrypto` is installed in `extensions`; checksum calls now explicitly use
`extensions.digest`. The commit re-renders and validates source/payload before
replay. A different staging path for an identical concurrent request remains
eligible to reuse the canonical receipt; changed source, checksum, size or MIME
cannot use the same-key shortcut. The receipt lookup keeps the isolated
installation's eight-field return shape, including canonical storage bucket
and path, without dropping the function. The server adapter still exposes only
the validated document receipt to its caller.

An additional regression captured the actual managed template guard and
activation definitions. It reproduced a leaked `lifecycle.template_transition_target`
value because the transport restored only the older transition flag. The transport
now restores both flags on success and error. The failing test passes after repair.

Executing the actual commit routine in the expanded PostgreSQL fixture found
another save blocker: an unqualified `request_key` conflicted with the function's
output parameter. Both receipt and storage-attempt lookups now qualify every
column. The five new transaction tests failed before this correction and pass
after it. This corrected routine was also replaced in the isolated managed DB.

The verified-actor transport is installed in the acceptance copy. Independent
`has_function_privilege` checks confirm all nine protected RPCs deny anon and
authenticated EXECUTE and allow service_role EXECUTE. A read-only policy query
found no RLS expression depending on those mutation routines. The original
application mutation gate and client availability remain disabled.

## Verification boundaries

Local TypeScript, all 198 web tests in 27 files, 24 focused embedded PostgreSQL
tests and the production build pass. The embedded fixture now installs
pgcrypto in the same extension schema as managed Supabase. It executes actual
commit SQL for linked Drive/revision/DRAFT-register/audit persistence, identical
receipt reuse across staged paths, metadata/source conflicts and rollback after
an injected audit failure. Its dependency schema, numbering, permission helpers
and Storage metadata remain explicitly limited test fixtures. Expanded isolated
SQL acceptance adds changed-source/metadata rejection and different-attempt-path
replay checks; these new acceptance cases have not yet been executed with a
complete real managed fixture.

## Persisted managed template and SQL-role checks

The isolated DB now contains a labeled synthetic project and scoped
manager/outsider profile/permission fixtures. `auth.users` remains empty: these
are SQL actor contexts, not login-capable auth identities or verified JWTs.
The template was created as DRAFT through existing protected creation/stage APIs,
then its body was appended and the exact saved revision activated through
`execute_lifecycle_document_action`.

- Template: `203ae4c9-5ff0-4ea6-8c26-b13650e0ac05`.
- Key/version/status: `LC-SYNTHETIC-REPORT` / 1 / ACTIVE.
- Pinned body: `74ac7ee9-0a48-4fe7-8cea-0cb517e8b854`, revision 1.
- Body SHA-256: `56055755fd73efe3c4838b8ab121b48a63199f8edefc0a5d292060f8abc27a4a`.

Real managed SQL checks pass for scoped-manager SELECT RLS, outsider SELECT
denial, authenticated transport EXECUTE denial, exact active-body authorization,
caller actor-argument rejection, immutable/ACTIVE-body edit rejection and restored
request context on success/failure. Missing physical object registration and a
commit without an owned upload attempt are rejected without persisted attempts,
document receipts or fabricated storage objects. These transaction-local checks
use actual managed policies/functions and finish with ROLLBACK.

The physical Storage/server-runtime check was requested, but Lovable paused
because the acceptance workspace exhausted its credits before that step ran.
No actual downloadable object or managed generated-document receipt exists yet.
The available browser control has no file-upload capability, and no suitable
Supabase Storage/deployment connector or authenticated server runtime is exposed
in this session. Do not fabricate `storage.objects` to bypass this boundary.

Physical upload/download checksum, managed successful commit, full rollback and
cleanup, two-session concurrency and real HTTP/JWT acceptance remain pending.
No full acceptance pass, automatic project/change draft generation or production
deployment is claimed. The original app gate is still closed.

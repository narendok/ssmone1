# Real caller acceptance for protected lifecycle SaveDraft

**Target:** isolated remix backend `egjotuxqguifnvdnflan` only. Never run these
steps against original backend `yyrvduosyyaluifqvwkr`, preview, or production.
This is an execution checklist, not a deployment migration and not a fixture
creation recipe.

## Gate before any execution

All of the following must already exist in the isolated backend; do not create,
modify, or grant them while running this checklist:

1. The unapplied document and actor-transport proposals have been reviewed and
   installed only in the isolated backend:
   - `supabase/pending/20261003_lifecycle_document_draft_generation.sql`
   - `supabase/pending/20261004_lifecycle_document_actor_transport.sql`
2. An already-approved, login-capable in-scope non-administrator caller and an
   already-approved, login-capable out-of-scope non-administrator caller.
   SQL-only profiles or manually set JWT GUCs are insufficient.
3. A disposable, already-authorized isolated project with:
   - an owning department and project Drive root;
   - a non-trashed folder inside that exact root;
   - an ACTIVE process template whose exact immutable document revision is
     pinned; and
   - a physical `project-drive` object path that the protected server can upload
     and download using the existing storage policy.
4. The authenticated application server can invoke the existing
   `generateLifecycleDocumentDraft` action with its normal bearer attachment.
   That action must remain behind its current mutation gate until every case
   below passes.
5. Observability that can inspect the resulting Drive node, Drive revision,
   register, audit entry, storage-attempt row, and immutable draft receipt
   without using a service-role request as an end-user substitute.

**Current missing artifact:** approved login-capable scoped manager and
outsider identities with an authenticated application-RPC transport to the
isolated remix backend. The repository contains only structural SQL actors and
no caller session or physical storage runner for that backend. This is why
SaveDraft remains disabled.

## Exact real-caller cases

Run each case through the authenticated application action, not raw SQL, direct
table writes, or a service-role request.

| Case | Caller / setup | Required observation |
| --- | --- | --- |
| Scope denial | outsider | No preflight disclosure, upload, attempt, Drive node, revision, register, audit, or receipt. |
| First save | scoped manager | One uploaded object; exactly one matching attempt, FILE node, Drive revision, DRAFT register, audit event, and immutable receipt. All actor fields match the verified caller. |
| Exact retry | same scoped manager, same immutable identifiers and request key | Same receipt/node/revision/register/audit; no second canonical metadata row or consumed object. |
| Changed payload | same key with target/template/version/request source changed | Conflict; no additional canonical rows. |
| Source/template advance | same key after project or active template source changes | Conflict or server-render mismatch; prior receipt remains unchanged. |
| Commit rollback | injected isolated audit failure after staging | No Drive/revision/register/audit/receipt. The exact staged object is removable only after `can_discard…` confirms no reference. |
| Uncertain outcome | simulated timeout after storage upload | Object is retained unless the server proves its exact unreferenced attempt is discardable. |
| Parallel replay | two scoped-manager requests with the same key and distinct staged object paths | Exactly one canonical receipt; loser path is the only cleanup-eligible object. |
| Read denial | outsider after manager success | No receipt metadata or cleanup authority. |

## Result criteria

Record only observed values and counts from the isolated backend. Do not infer
success from a rendered preview, a structural psql script, embedded PGlite,
service-role response, or local unit test. Any missing actor, target ancestry,
physical storage proof, rollback count, or two-session outcome leaves SaveDraft
blocked.

## After all cases pass

1. Save the isolated execution evidence with request keys redacted.
2. Review whether the installed isolated routine signatures and deployed source
   still match the two pending SQL files and current server bridge.
3. Obtain explicit acceptance of the execution evidence and only then schedule a
   separate original-backend migration review. Do not carry over isolated test
   objects, users, grants, or paths.
4. Keep automatic generation disabled until the original-backend deployment has
   separately passed the same caller/RLS/storage evidence.

# Lifecycle editor and isolated managed rollback checkpoint

Replaced template create, stage-save and clone facade placeholders with the existing governed backend RPCs. Calls use the authenticated middleware client, preserve backend authorization and return actual saved UUIDs. Invalid success responses fail; non-idempotent calls are not retried. The lifecycle acceptance gate remains closed.

Validation: TypeScript passed; 210 Vitest tests across 28 files passed; production Vite build passed. Twelve added cases cover adapter failure/ID handling and the three disabled management routes. Existing build warnings are nonfatal.

## Managed acceptance evidence

Only unpublished Lovable project `798159a5-659a-4a6a-9fa1-30a2d065c054`, backend `egjotuxqguifnvdnflan`, was tested. Original shared backend `yyrvduosyyaluifqvwkr` was not changed.

- Independently read concurrent receipt `87e4a1b0-2589-4639-8f11-d2b2c35a894f`: two owned staging attempts for request `15183491-527a-4444-9b6e-c157274a7203`, one consumed with retained physical object metadata, losing object absent. Actual simultaneous calls/download hash checks are reported by Lovable's guarded server runner; these were not independently rerun through user HTTP sessions.
- New real staged attempt `2665402a-3706-4cd6-815a-aed2ffb2b6b4`, request `17e26e8d-0d3d-42c5-a727-c79121c90459`, 139 bytes, checksum `600f97b417f3f68dbb20b6d7cb9e02b176dce0d7d6996f3e2d05e6a30c0e6d27`, enabled actual SQL rollback tests without fabricating Storage rows.
- Independently executed AFTER-row fault injection at Drive node, revision, register event, register, activity audit, receipt and consumed upload attempt. Each exact injected error restored counts, full attempt rows and full numbering configuration to baseline. Owned unreferenced staging proof passed. Functions/triggers existed only within BEGIN/ROLLBACK; a separate query confirms no fault triggers remain. No persisted receipt exists for this request; staged attempt/object retained.
- Auth users remain zero. These tests use transaction-local SQL fixture actor contexts, not real JWT/browser sessions. Protected transport whitelist, grants, policies and credentials were not relaxed.

Runnable SQL and captured result files reside in the Android workspace `docs/evidence/lifecycle-managed-persistence-rollback-2026-10-05.sql`, `.txt` and `lifecycle-managed-post-rollback-2026-10-05.txt`. Lovable staging runner is `docs/evidence/stage_lifecycle_rollback_fixture.ts` in the acceptance-copy source.

Still incomplete: real signed-in browser/server acceptance; original-backend release; document-generation UI wiring; automatic project-create/change generation. The present renderer is four canonical fields into UTF-8 TXT. No rich document formats, complete company lifecycle or Android parity claim is made.

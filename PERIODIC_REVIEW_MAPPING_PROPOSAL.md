# Periodic and Conditional Reviews mapping proposal

**Status:** source-only, unapplied — 2026-10-03 UTC.

## Contract

- The existing `folder_kind` constraint remains unchanged. Review folders use `STANDARD` plus metadata: `taxonomy: periodic-conditional-review-v1`, `category: PERIODIC_CONDITIONAL_REVIEW`, and `placement: COMMON`.
- The proposed action creates only a new locked child under a verified `DEPARTMENT_STANDARDS` root. It never renames, moves, claims, or alters a historical folder.
- Exact replay returns the existing canonical metadata-marked root. Duplicate roots fail preflight for manual reconciliation.
- Caller and department scope are validated before reads or writes. The proposed action is server-only (`service_role` execute); browser and Android actions are not accepted.

## Preflight and rollback

1. Verify zero or one metadata-marked review root per department.
2. Verify one non-trashed `DEPARTMENT_STANDARDS` root with the same `department_id`.
3. In an isolated database, test authorized and denied callers, replay, duplicate roots, missing standards roots, rollback, and unchanged legacy folders.
4. The SQL ends with `ROLLBACK` until a reviewed deployment replaces it with an approved migration.

## Android parity

- **Existing read contract:** `LIFECYCLE_ANDROID_READ_CONTRACT_2026-10-02.md`.
- **New review route:** `/admin/drive-ownership` (internal ID `/_authenticated/admin/drive-ownership`), Platform Owner only, read-only.
- **Verified mapping:** Common Controlled Documents → `DEPARTMENT_STANDARDS` + `COMMON` templates; Periodic and Conditional Reviews → no current live mapping; Project Deliverables → `INTERNAL_PROJECTS` or `CLIENT_PROJECTS`. Internal/client remains a secondary project filter.
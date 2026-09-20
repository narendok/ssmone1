# Stabilization Patch 02 — Automation-first foundation

## Outcome

Add a shared, human-controlled automation foundation across the existing SSM One application. The patch will reuse known data first, preserve canonical records, record provenance and auditability, and keep every high-impact decision under authorized human control. Phase 6 will not begin.

## What will be built

1. **Automation Center in Administration**
   - Add views for Automation Rules, External Data Sources, AI Features, Recent Runs, Failed Automations, and Data Sync Health.
   - Let administrators enable or disable safe rules and see why an automated action ran or failed.

2. **Reusable data foundation**
   - Additive tables and policies for connector configuration metadata, automation rules, execution runs, external-data cache, field provenance, and manual overrides.
   - Store provider, source identifier, timestamps, freshness, confidence, original values, overrides, and safe error details.
   - Reuse the existing activity log for cross-module traceability rather than adding parallel audit systems.

3. **Safe event-driven automation service**
   - Add server-side helpers to record/execute deterministic, enabled rules with audit outcomes and graceful failure.
   - Support bounded, idempotent background refresh patterns with a database lease, pause/error state, and manual fallback.
   - Include reusable handlers for low-risk events such as project workspace provisioning and due/overdue task reminders; no automatic approvals, hiring outcomes, purchasing, releases, or financial posting.

4. **Existing-module zero-reentry improvements**
   - **Projects / Sales:** approved-baseline handover will create a linked project draft using customer, opportunity, baseline, sales-owner, and requirement data; the user confirms and completes the remaining project decisions.
   - **HR:** job-profile-driven drafting and candidate/onboarding handoff will reuse the candidate, department, role, and plan data without repeated entry; hiring stays human-authorized.
   - **Components / BOM / invoices:** preserve supplier-origin data separately, show source/freshness, avoid overwriting confirmed engineering fields, and make import/extraction output explicitly reviewable before master or stock changes.
   - **Tasks / Drive:** use project context to derive linked customer/manager/department details and provision a project workspace structure without duplicate folders.

5. **AI assistance controls**
   - Introduce a common suggestion state: suggested, needs review, confirmed, rejected, and overridden.
   - Record AI model/service, source records, generated time, confidence, confirmation, and rejection reason where AI is used.
   - Update existing AI integrations to use server-side configuration, clear user-facing errors, and no silent decisions or fabricated records.

6. **Validation and documentation**
   - Add focused tests for deterministic automation, idempotency, manual fallback, and provenance capture.
   - Audit Phases 1–5 and document found, implemented, deferred, and intentionally manual opportunities in the final report.

## Boundaries

- Existing PartsBench and SSM One tables, records, IDs, routes, and workflows remain in place; changes are additive.
- External connections are configured only through the central registry. No secret is exposed to the browser and no unsupported tax, postal, calendar, or business registry validation is fabricated.
- AI remains advisory: it can read, summarize, extract, classify, and draft. It cannot approve, release, hire/reject, select vendors, place orders, post finance data, or silently overwrite confirmed records.
- High-risk automation will be surfaced as a reviewed draft or a one-click, permission-aware confirmation.

## Technical details

- One additive database migration will create the framework tables, grants, RLS policies, indexes, integrity constraints, and safe helper functions.
- Server functions and server-only helpers will provide the shared execution boundary; public scheduled endpoints will be used only for bounded, locked refresh work.
- AI calls use Lovable AI server-side with the required streaming/error semantics; existing supplier and invoice paths are migrated carefully instead of introducing a second AI stack.
- The Admin page gains a new Automation Center tab and supporting settings screens without changing existing navigation behavior.

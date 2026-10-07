# Structured lifecycle template preview — authorized-source review

## Scope

This source-only addition connects the three local previews to the caller-authorized, immutable Master Specification revision for `OPPORTUNITY-2026-0013` / `MASTER-2026-0001` revision 1.

- Statement of Requirements (SOR)
- Contract Review
- Product Requirements Specification (PRS)

The read uses the authenticated server function `fetchStructuredTemplatePreviewSource`, with caller RLS preserved. It verifies the opportunity/customer/specification tuple, retrieves exact revision 1, and returns only source fields used by the preview. Output remains text-only and React renders all data as escaped text. No persistence, generation, storage, database mutation, permission change, or lifecycle action is enabled.

## Exact changed source files

- `src/lib/lifecycle-structured-template-previews.ts`
- `src/lib/lifecycle-structured-template-previews.functions.ts`
- `src/lib/lifecycle-structured-template-previews.test.ts`
- `src/components/lifecycle/StructuredTemplatePreview.tsx`
- `src/routes/_authenticated/settings.lifecycle.tsx`

## Full source review

### Authoritative read contract

```ts
// Caller-authorized only: the protected function queries these deployed tables.
sales_opportunities(opportunity_number = "OPPORTUNITY-2026-0013")
  -> master_specifications(opportunity_id, customer_id, specification_number = "MASTER-2026-0001")
  -> master_specification_versions(specification_id, version_number = 1)
```

The function rejects unavailable rows, incomplete opportunity/customer relationships, mismatched specification tuples, unavailable revisions, and query errors. It does not read controlled requirements or baselines; their absence remains explicit and no customer authorization is inferred.

### `src/lib/lifecycle-structured-template-previews.ts`

```ts
// Verbatim implementation is the current source file. Key public functions:
export function mapMasterSpecificationSource(input: Omit<StructuredTemplateSource, "sourceFields"> & { specificationData: unknown }): StructuredTemplateSource
export function renderStructuredLifecycleTemplatePreview(kind: StructuredLifecycleTemplateKind, source: StructuredTemplateSource | null, userEdits: Record<string, string | null> = {})
```

It maps exact pinned source fields, preserves source literals, maps missing values to `TBC`, and applies local edits only over editable fields.

### `src/lib/lifecycle-structured-template-previews.functions.ts`

```ts
export const fetchStructuredTemplatePreviewSource = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(/* caller-RLS opportunity -> specification -> exact version read */)
```

### Template structures

```ts
export const structuredLifecycleTemplatePreviews = [
  {
    kind: "SOR",
    template: {
      templateKey: "SOR",
      version: 1,
      title: "Statement of Requirements",
      content: "STATEMENT OF REQUIREMENTS\n\nProject: {{PROJECT_CODE}} — {{PROJECT_NAME}}\nRevision: {{PROJECT_REVISION}}\nCustomer: {{CUSTOMER_NAME}}\n\n1. Scope\n{{SCOPE_STATEMENT}}\n\n2. Acceptance criteria\n{{ACCEPTANCE_CRITERIA}}"
    }
  },
  {
    kind: "CONTRACT_REVIEW",
    template: {
      templateKey: "CONTRACT-REVIEW",
      version: 1,
      title: "Contract Review",
      content: "CONTRACT REVIEW\n\n| Review item | Source value | Review disposition |\n| --- | --- | --- |\n| Project | {{PROJECT_CODE}} | TBC |\n| Customer | {{CUSTOMER_NAME}} | TBC |\n| Authoritative source | {{SOURCE_DOCUMENT}} | TBC |\n\nCommitment summary\n{{COMMITMENT_SUMMARY}}\n\nExceptions, conditions and actions\n{{EXCEPTIONS_AND_ACTIONS}}\n\nNo customer authorization is inferred by this local preview."
    }
  },
  {
    kind: "PRS",
    template: {
      templateKey: "PRS",
      version: 1,
      title: "Product Requirements Specification",
      content: "PRODUCT REQUIREMENTS SPECIFICATION\n\nProject: {{PROJECT_CODE}} — {{PROJECT_NAME}}\nRevision: {{PROJECT_REVISION}}\n\n| ID | Requirement | Source | Verification | Status |\n| --- | --- | --- | --- | --- |\n| PRS-001 | {{FUNCTIONAL_REQUIREMENT}} | TBC | {{VERIFICATION_METHOD}} | TBC |\n\nOpen technical values, applicability and approvals remain TBC until verified source data is available."
    }
  }
];
```

## UI route and behavior

- Route: **Settings → Lifecycle templates** (`/_authenticated/settings/lifecycle`)
- Panel: **Structured document previews**
- The panel identifies the source pin, including revision ID, number, saved time, and change note.
- Source fields are read-only in each type-specific table. SOR, Contract Review, and PRS use distinct layouts and local editable fields.
- Local changes visibly remain unsaved. Refresh is disabled while they exist, so it cannot silently replace them. If a source revision advance is observed after local editing, the UI reports a conflict without replacing the edits.
- Save remains disabled and states why; it does not report a successful persistence.

## Safety and source behavior

- Unknown source and technical fields show `TBC`; no technical value or customer authorization is invented.
- Source-field labels and user-edit fields are visibly separated in the preview UI, with source pins visible.
- Literal source/user text is substituted exactly once by the existing renderer; markup such as `<img>` remains visible text, not executable HTML.
- Missing required user-edit fields fail closed in the pure renderer.
- Save, activation, retirement, draft generation, and persistence remain unavailable until the existing protected contracts have isolated acceptance evidence.

## Acceptance setup checklist — still blocked

No database acceptance has run. The isolated target requires all of the following before any execution:

1. Approved existing isolated Sales, reviewer, and negative-test caller identities.
2. The pending protected Master-save, source-bound requirement, reviewer decision, commercial-save, and baseline routines installed on the isolated target.
3. Read-only assertion transport capable of checking persisted IDs, counts, audit rows, receipts, and history without service credentials or JWT-GUC impersonation.
4. An isolated rollback boundary that proves failed cases leave no records.
5. Two independently authenticated caller sessions plus a safe concurrency barrier.

The harness refuses the original target and refuses to run while any prerequisite is missing. This checklist does not request new identities, credentials, grants, or secrets.
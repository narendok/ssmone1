# Structured lifecycle template preview — source review

## Scope

This source-only addition introduces local previews for three distinct document shapes:

- Statement of Requirements (SOR)
- Contract Review
- Product Requirements Specification (PRS)

They use the existing pure `renderLifecycleDocument` contract. Output remains `text/plain` and is rendered in a React `<pre>` element. No HTML is parsed or executed, and no persistence, generation, storage, database, permission, or lifecycle action is enabled.

## Exact changed source files

- `src/lib/lifecycle-structured-template-previews.ts`
- `src/lib/lifecycle-structured-template-previews.test.ts`
- `src/components/lifecycle/StructuredTemplatePreview.tsx`
- `src/routes/_authenticated/settings.lifecycle.tsx`

## Template sources

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

## Safety and source behavior

- Unknown source and technical fields show `TBC`; no technical value or customer authorization is invented.
- Source-field labels and user-edit fields are visibly separated in the preview UI.
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
import { renderLifecycleDocument, type DocumentTemplate } from "@/lib/lifecycle-document-renderer";

export type StructuredLifecycleTemplateKind = "SOR" | "CONTRACT_REVIEW" | "PRS";

export type StructuredLifecycleTemplatePreview = {
  kind: StructuredLifecycleTemplateKind;
  label: string;
  description: string;
  sourceFields: string[];
  editableFields: string[];
  template: DocumentTemplate;
  fields: Record<string, string | null>;
};

const localRevision = "local-preview-only";

export const structuredLifecycleTemplatePreviews: StructuredLifecycleTemplatePreview[] = [
  {
    kind: "SOR",
    label: "Statement of Requirements",
    description: "Source requirements captured for review; technical detail remains TBC until a verified source provides it.",
    sourceFields: ["PROJECT_CODE", "PROJECT_NAME", "PROJECT_REVISION", "CUSTOMER_NAME"],
    editableFields: ["SCOPE_STATEMENT", "ACCEPTANCE_CRITERIA"],
    template: {
      templateKey: "SOR",
      version: 1,
      title: "Statement of Requirements",
      content: "STATEMENT OF REQUIREMENTS\n\nProject: {{PROJECT_CODE}} — {{PROJECT_NAME}}\nRevision: {{PROJECT_REVISION}}\nCustomer: {{CUSTOMER_NAME}}\n\n1. Scope\n{{SCOPE_STATEMENT}}\n\n2. Acceptance criteria\n{{ACCEPTANCE_CRITERIA}}\n\n3. Source status\nVerified source fields are injected. User-authored scope and acceptance text remains separate pending controlled save.",
    },
    fields: {
      PROJECT_CODE: "TBC",
      PROJECT_NAME: "TBC",
      PROJECT_REVISION: "TBC",
      CUSTOMER_NAME: "TBC",
      SCOPE_STATEMENT: "TBC",
      ACCEPTANCE_CRITERIA: "TBC",
    },
  },
  {
    kind: "CONTRACT_REVIEW",
    label: "Contract Review",
    description: "Commercial and customer commitments stay unverified unless an authoritative controlled source supplies them.",
    sourceFields: ["PROJECT_CODE", "CUSTOMER_NAME", "SOURCE_DOCUMENT"],
    editableFields: ["COMMITMENT_SUMMARY", "EXCEPTIONS_AND_ACTIONS"],
    template: {
      templateKey: "CONTRACT-REVIEW",
      version: 1,
      title: "Contract Review",
      content: "CONTRACT REVIEW\n\n| Review item | Source value | Review disposition |\n| --- | --- | --- |\n| Project | {{PROJECT_CODE}} | TBC |\n| Customer | {{CUSTOMER_NAME}} | TBC |\n| Authoritative source | {{SOURCE_DOCUMENT}} | TBC |\n\nCommitment summary\n{{COMMITMENT_SUMMARY}}\n\nExceptions, conditions and actions\n{{EXCEPTIONS_AND_ACTIONS}}\n\nNo customer authorization is inferred by this local preview.",
    },
    fields: {
      PROJECT_CODE: "TBC",
      CUSTOMER_NAME: "TBC",
      SOURCE_DOCUMENT: "TBC",
      COMMITMENT_SUMMARY: "TBC",
      EXCEPTIONS_AND_ACTIONS: "TBC",
    },
  },
  {
    kind: "PRS",
    label: "Product Requirements Specification",
    description: "A structured requirement matrix with unverified technical values visibly held at TBC.",
    sourceFields: ["PROJECT_CODE", "PROJECT_NAME", "PROJECT_REVISION"],
    editableFields: ["FUNCTIONAL_REQUIREMENT", "VERIFICATION_METHOD"],
    template: {
      templateKey: "PRS",
      version: 1,
      title: "Product Requirements Specification",
      content: "PRODUCT REQUIREMENTS SPECIFICATION\n\nProject: {{PROJECT_CODE}} — {{PROJECT_NAME}}\nRevision: {{PROJECT_REVISION}}\n\n| ID | Requirement | Source | Verification | Status |\n| --- | --- | --- | --- | --- |\n| PRS-001 | {{FUNCTIONAL_REQUIREMENT}} | TBC | {{VERIFICATION_METHOD}} | TBC |\n\nOpen technical values, applicability and approvals remain TBC until verified source data is available.",
    },
    fields: {
      PROJECT_CODE: "TBC",
      PROJECT_NAME: "TBC",
      PROJECT_REVISION: "TBC",
      FUNCTIONAL_REQUIREMENT: "TBC",
      VERIFICATION_METHOD: "TBC",
    },
  },
];

export function renderStructuredLifecycleTemplatePreview(
  kind: StructuredLifecycleTemplateKind,
  userEdits: Record<string, string | null> = {},
) {
  const preview = structuredLifecycleTemplatePreviews.find((item) => item.kind === kind);
  if (!preview) throw new Error("Unsupported structured lifecycle template.");
  const fields = { ...preview.fields, ...userEdits };
  return renderLifecycleDocument({ ...preview.template, documentRevisionId: localRevision }, fields);
}
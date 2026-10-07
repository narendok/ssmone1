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

## Full exact source

### `src/lib/lifecycle-structured-template-previews.ts`

```ts
import { renderLifecycleDocument, type DocumentTemplate } from "@/lib/lifecycle-document-renderer";

export type StructuredLifecycleTemplateKind = "SOR" | "CONTRACT_REVIEW" | "PRS";
export type StructuredTemplateSource = {
  opportunityId: string; opportunityNumber: string; opportunityName: string; customerId: string; customerName: string;
  specificationId: string; specificationNumber: string; versionId: string; versionNumber: number; changeSummary: string | null; savedAt: string | null;
  sourceFields: Record<string, string | null>;
};
export type StructuredLifecycleTemplatePreview = {
  kind: StructuredLifecycleTemplateKind; label: string; description: string; sourceFields: string[];
  editableFields: Array<{ key: string; label: string; kind: "text" | "textarea" }>;
  template: DocumentTemplate; fields: Record<string, string | null>;
};

const localRevision = "local-preview-only";
const tbc = "TBC";
export const structuredLifecycleTemplatePreviews: StructuredLifecycleTemplatePreview[] = [
  { kind: "SOR", label: "Statement of Requirements", description: "Source requirements and review-owned scope remain separate until a controlled save contract is accepted.", sourceFields: ["PROJECT_CODE", "PROJECT_NAME", "PROJECT_REVISION", "CUSTOMER_NAME", "REQUIREMENT_SUMMARY"], editableFields: [{ key: "SCOPE_STATEMENT", label: "Scope statement", kind: "textarea" }, { key: "ACCEPTANCE_CRITERIA", label: "Acceptance criteria", kind: "textarea" }], template: { templateKey: "SOR", version: 1, title: "Statement of Requirements", content: "STATEMENT OF REQUIREMENTS\n\nProject: {{PROJECT_CODE}} — {{PROJECT_NAME}}\nMaster Specification: {{MASTER_SPECIFICATION}}\nRevision: {{PROJECT_REVISION}}\nCustomer: {{CUSTOMER_NAME}}\n\n1. Source requirement\n{{REQUIREMENT_SUMMARY}}\n\n2. Scope\n{{SCOPE_STATEMENT}}\n\n3. Acceptance criteria\n{{ACCEPTANCE_CRITERIA}}" }, fields: { PROJECT_CODE: tbc, PROJECT_NAME: tbc, PROJECT_REVISION: tbc, CUSTOMER_NAME: tbc, MASTER_SPECIFICATION: tbc, REQUIREMENT_SUMMARY: tbc, SCOPE_STATEMENT: tbc, ACCEPTANCE_CRITERIA: tbc } },
  { kind: "CONTRACT_REVIEW", label: "Contract Review", description: "Commercial authorization is never inferred; review fields remain local and unsaved.", sourceFields: ["PROJECT_CODE", "CUSTOMER_NAME", "MASTER_SPECIFICATION", "SOURCE_DOCUMENT", "REQUIREMENT_SUMMARY"], editableFields: [{ key: "COMMITMENT_SUMMARY", label: "Commitment summary", kind: "textarea" }, { key: "EXCEPTIONS_AND_ACTIONS", label: "Exceptions, conditions and actions", kind: "textarea" }], template: { templateKey: "CONTRACT-REVIEW", version: 1, title: "Contract Review", content: "CONTRACT REVIEW\n\n| Review item | Verified source | Local review |\n| --- | --- | --- |\n| Opportunity | {{PROJECT_CODE}} | TBC |\n| Customer | {{CUSTOMER_NAME}} | TBC |\n| Master Specification | {{MASTER_SPECIFICATION}} | TBC |\n| Source record | {{SOURCE_DOCUMENT}} | TBC |\n\nSource requirement\n{{REQUIREMENT_SUMMARY}}\n\nCommitment summary\n{{COMMITMENT_SUMMARY}}\n\nExceptions, conditions and actions\n{{EXCEPTIONS_AND_ACTIONS}}\n\nCustomer authorization: TBC (not inferred)." }, fields: { PROJECT_CODE: tbc, CUSTOMER_NAME: tbc, MASTER_SPECIFICATION: tbc, SOURCE_DOCUMENT: tbc, REQUIREMENT_SUMMARY: tbc, COMMITMENT_SUMMARY: tbc, EXCEPTIONS_AND_ACTIONS: tbc } },
  { kind: "PRS", label: "Product Requirements Specification", description: "Technical attributes are mapped from the pinned Master Specification; unknowns remain TBC.", sourceFields: ["PROJECT_CODE", "PROJECT_NAME", "PROJECT_REVISION", "POWER_AND_UNITS", "INTERFACES", "ENVIRONMENT_AND_IP"], editableFields: [{ key: "FUNCTIONAL_REQUIREMENT", label: "Functional requirement", kind: "textarea" }, { key: "VERIFICATION_METHOD", label: "Verification method", kind: "text" }], template: { templateKey: "PRS", version: 1, title: "Product Requirements Specification", content: "PRODUCT REQUIREMENTS SPECIFICATION\n\nProject: {{PROJECT_CODE}} — {{PROJECT_NAME}}\nMaster Specification: {{MASTER_SPECIFICATION}}\nRevision: {{PROJECT_REVISION}}\n\n| ID | Requirement | Source / constraint | Verification | Status |\n| --- | --- | --- | --- | --- |\n| PRS-001 | {{FUNCTIONAL_REQUIREMENT}} | {{REQUIREMENT_SUMMARY}} | {{VERIFICATION_METHOD}} | TBC |\n\n| Technical field | Pinned source value |\n| --- | --- |\n| Power / units | {{POWER_AND_UNITS}} |\n| Interfaces | {{INTERFACES}} |\n| Environment / IP | {{ENVIRONMENT_AND_IP}} |" }, fields: { PROJECT_CODE: tbc, PROJECT_NAME: tbc, PROJECT_REVISION: tbc, MASTER_SPECIFICATION: tbc, REQUIREMENT_SUMMARY: tbc, POWER_AND_UNITS: tbc, INTERFACES: tbc, ENVIRONMENT_AND_IP: tbc, FUNCTIONAL_REQUIREMENT: tbc, VERIFICATION_METHOD: tbc } },
];

function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : tbc; }
export function mapMasterSpecificationSource(input: Omit<StructuredTemplateSource, "sourceFields"> & { specificationData: unknown }): StructuredTemplateSource {
  const data = input.specificationData && typeof input.specificationData === "object" && !Array.isArray(input.specificationData) ? input.specificationData as Record<string, unknown> : {};
  return { ...input, sourceFields: { PROJECT_CODE: input.opportunityNumber, PROJECT_NAME: input.opportunityName, PROJECT_REVISION: `Master Specification rev ${input.versionNumber}`, CUSTOMER_NAME: input.customerName, MASTER_SPECIFICATION: `${input.specificationNumber} rev ${input.versionNumber}`, SOURCE_DOCUMENT: `${input.specificationNumber} revision ${input.versionNumber}`, REQUIREMENT_SUMMARY: text(data.requirementSummary), POWER_AND_UNITS: text(data.powerAndUnits), INTERFACES: text(data.interfaces), ENVIRONMENT_AND_IP: text(data.environmentAndIp) } };
}
export function renderStructuredLifecycleTemplatePreview(kind: StructuredLifecycleTemplateKind, source: StructuredTemplateSource | null, userEdits: Record<string, string | null> = {}) {
  const preview = structuredLifecycleTemplatePreviews.find((item) => item.kind === kind);
  if (!preview) throw new Error("Unsupported structured lifecycle template.");
  return renderLifecycleDocument({ ...preview.template, documentRevisionId: localRevision }, { ...preview.fields, ...(source?.sourceFields ?? {}), ...userEdits });
}```

### `src/lib/lifecycle-structured-template-previews.functions.ts`

```ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mapMasterSpecificationSource } from "@/lib/lifecycle-structured-template-previews";

type ReadInput = { opportunityNumber: string; specificationNumber: string; versionNumber: number };
function validate(input: ReadInput) { if (!/^OPPORTUNITY-\d{4}-\d{4}$/.test(input.opportunityNumber) || !/^MASTER-\d{4}-\d{4}$/.test(input.specificationNumber) || !Number.isInteger(input.versionNumber) || input.versionNumber < 1) throw new Error("A valid pinned opportunity, Master Specification, and revision are required."); return input; }
export const fetchStructuredTemplatePreviewSource = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(validate).handler(async ({ data, context }) => {
  const { data: opportunity, error: opportunityError } = await context.supabase.from("sales_opportunities").select("id,opportunity_number,name,customer_id,customer:customers(id,legal_name)").eq("opportunity_number", data.opportunityNumber).maybeSingle();
  if (opportunityError) throw new Error("The opportunity source could not be read with your current access.");
  if (!opportunity) throw new Error("The requested opportunity is unavailable with your current access.");
  const customer = opportunity.customer as unknown as { id: string; legal_name: string } | null;
  if (!customer || customer.id !== opportunity.customer_id) throw new Error("The opportunity customer source is incomplete.");
  const { data: specification, error: specificationError } = await context.supabase.from("master_specifications").select("id,specification_number,opportunity_id,customer_id,current_version").eq("opportunity_id", opportunity.id).eq("customer_id", opportunity.customer_id).eq("specification_number", data.specificationNumber).maybeSingle();
  if (specificationError) throw new Error("The Master Specification source could not be read with your current access.");
  if (!specification || specification.current_version < data.versionNumber) throw new Error("The requested Master Specification revision is unavailable.");
  const { data: version, error: versionError } = await context.supabase.from("master_specification_versions").select("id,specification_id,version_number,change_summary,created_at,specification_data").eq("specification_id", specification.id).eq("version_number", data.versionNumber).maybeSingle();
  if (versionError) throw new Error("The pinned Master Specification revision could not be read with your current access.");
  if (!version || version.specification_id !== specification.id) throw new Error("The pinned Master Specification revision is unavailable.");
  return mapMasterSpecificationSource({ opportunityId: opportunity.id, opportunityNumber: opportunity.opportunity_number ?? data.opportunityNumber, opportunityName: opportunity.name, customerId: customer.id, customerName: customer.legal_name, specificationId: specification.id, specificationNumber: specification.specification_number, versionId: version.id, versionNumber: version.version_number, changeSummary: version.change_summary, savedAt: version.created_at, specificationData: version.specification_data });
});```

### `src/components/lifecycle/StructuredTemplatePreview.tsx`

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Eye, LockKeyhole, RefreshCw, Save } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchStructuredTemplatePreviewSource } from "@/lib/lifecycle-structured-template-previews.functions";
import { renderStructuredLifecycleTemplatePreview, structuredLifecycleTemplatePreviews, type StructuredLifecycleTemplateKind, type StructuredTemplateSource } from "@/lib/lifecycle-structured-template-previews";

const sampleSource = { opportunityNumber: "OPPORTUNITY-2026-0013", specificationNumber: "MASTER-2026-0001", versionNumber: 1 };
const editKey = (kind: StructuredLifecycleTemplateKind, field: string) => `${kind}:${field}`;
export function StructuredTemplatePreview() {
  const [kind, setKind] = useState<StructuredLifecycleTemplateKind>("SOR"); const [userEdits, setUserEdits] = useState<Record<string, string>>({}); const initialVersionId = useRef<string | null>(null);
  const source = useQuery({ queryKey: ["structured-template-source", sampleSource.opportunityNumber, sampleSource.specificationNumber, sampleSource.versionNumber], queryFn: () => fetchStructuredTemplatePreviewSource({ data: sampleSource }), retry: false });
  const dirty = Object.keys(userEdits).length > 0; const sourceAdvanced = Boolean(source.data && initialVersionId.current && initialVersionId.current !== source.data.versionId);
  useEffect(() => { if (source.data && !initialVersionId.current) initialVersionId.current = source.data.versionId; }, [source.data]);
  const rendered = useMemo(() => { try { const edits = Object.fromEntries(Object.entries(userEdits).filter(([key]) => key.startsWith(`${kind}:`)).map(([key, value]) => [key.slice(kind.length + 1), value])); return { content: renderStructuredLifecycleTemplatePreview(kind, source.data ?? null, edits).content, error: null }; } catch (error) { return { content: "", error: error instanceof Error ? error.message : "Preview unavailable." }; } }, [kind, source.data, userEdits]);
  return <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><Eye className="mt-0.5 size-5 text-primary" /><div><CardTitle>Structured document previews</CardTitle><CardDescription>Read-only authorized source: {sampleSource.opportunityNumber} · {sampleSource.specificationNumber} rev 1.</CardDescription></div></div><Button size="sm" variant="outline" onClick={() => void source.refetch()} disabled={source.isFetching || dirty}><RefreshCw className="size-4" /> Refresh source</Button></div></CardHeader><CardContent>
    {source.isLoading && <p className="border p-3 text-sm text-muted-foreground">Loading authorized source…</p>}{source.isError && <p role="alert" className="border border-destructive/40 p-3 text-sm text-destructive">Authorized source could not be loaded: {source.error instanceof Error ? source.error.message : "Unexpected read error"}</p>}{source.data && <SourcePin source={source.data} />}{dirty && <p role="status" className="mt-3 border border-amber-500/40 bg-amber-500/5 p-3 text-sm">Local edits are unsaved. Refresh is paused so source data cannot overwrite them silently.</p>}{sourceAdvanced && <p role="alert" className="mt-3 border border-amber-500/40 bg-amber-500/5 p-3 text-sm">The source pin advanced while local edits exist. Review the conflict before starting a new draft; no edit was replaced.</p>}
    <Tabs value={kind} onValueChange={(value) => setKind(value as StructuredLifecycleTemplateKind)} className="mt-4"><TabsList className="h-auto flex-wrap justify-start">{structuredLifecycleTemplatePreviews.map((item) => <TabsTrigger key={item.kind} value={item.kind}>{item.label}</TabsTrigger>)}</TabsList>{structuredLifecycleTemplatePreviews.map((item) => <TabsContent key={item.kind} value={item.kind} className="space-y-4 pt-4"><p className="text-sm text-muted-foreground">{item.description}</p><div className="grid gap-4 xl:grid-cols-2"><div className="space-y-4"><SourceTable item={item} source={source.data ?? null} /><section className="space-y-3 border p-3"><div className="flex items-center gap-2"><LockKeyhole className="size-4 text-muted-foreground" /><p className="text-xs font-medium text-muted-foreground">Local review edits · unsaved</p></div>{item.editableFields.map((field) => <div key={field.key} className="space-y-1.5"><Label htmlFor={`${item.kind}-${field.key}`}>{field.label}</Label>{field.kind === "textarea" ? <Textarea id={`${item.kind}-${field.key}`} value={userEdits[editKey(item.kind, field.key)] ?? "TBC"} onChange={(event) => setUserEdits((current) => ({ ...current, [editKey(item.kind, field.key)]: event.target.value }))} maxLength={8000} /> : <Input id={`${item.kind}-${field.key}`} value={userEdits[editKey(item.kind, field.key)] ?? "TBC"} onChange={(event) => setUserEdits((current) => ({ ...current, [editKey(item.kind, field.key)]: event.target.value }))} maxLength={1000} />}</div>)}</section></div><section><p className="mb-2 text-sm font-medium">Controlled text preview</p>{rendered.error ? <p role="alert" className="border border-destructive/40 p-3 text-sm text-destructive">{rendered.error}</p> : <pre className="min-h-80 whitespace-pre-wrap break-words border bg-muted/30 p-3 text-sm">{rendered.content}</pre>}</section></div></TabsContent>)}</Tabs><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-muted-foreground">Saving and controlled document generation remain unavailable until the accepted backend contract is installed and independently verified.</p><Button disabled><Save className="size-4" /> Save unavailable</Button></div>
  </CardContent></Card>;
}
function SourcePin({ source }: { source: StructuredTemplateSource }) { return <section className="border p-3"><div className="flex items-center gap-2"><AlertCircle className="size-4 text-primary" /><p className="text-sm font-medium">Pinned authorized source</p></div><div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><p>Opportunity: <span className="font-mono text-foreground">{source.opportunityNumber}</span></p><p>Customer: <span className="text-foreground">{source.customerName}</span></p><p>Master Specification: <span className="font-mono text-foreground">{source.specificationNumber} rev {source.versionNumber}</span></p><p>Revision ID: <span className="font-mono text-foreground">{source.versionId}</span></p></div><p className="mt-2 text-xs text-muted-foreground">Saved {source.savedAt ? new Date(source.savedAt).toLocaleString() : "TBC"} · {source.changeSummary ?? "Change note TBC"}</p></section>; }
function SourceTable({ item, source }: { item: typeof structuredLifecycleTemplatePreviews[number]; source: StructuredTemplateSource | null }) { return <section className="border p-3"><p className="text-xs font-medium text-muted-foreground">Injected source fields · read-only</p><div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Field</th><th className="p-2">Pinned value</th></tr></thead><tbody>{item.sourceFields.map((field) => <tr key={field} className="border-b last:border-0"><td className="p-2 font-mono">{field}</td><td className="p-2 whitespace-pre-wrap">{source?.sourceFields[field] ?? "TBC"}</td></tr>)}</tbody></table></div></section>; }```

### `src/lib/lifecycle-structured-template-previews.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { mapMasterSpecificationSource, renderStructuredLifecycleTemplatePreview, structuredLifecycleTemplatePreviews } from "./lifecycle-structured-template-previews";

const source = mapMasterSpecificationSource({ opportunityId: "opportunity-id", opportunityNumber: "OPPORTUNITY-2026-0013", opportunityName: "Tracker <script>alert(1)</script>", customerId: "customer-id", customerName: "SAMPLE ONLY", specificationId: "specification-id", specificationNumber: "MASTER-2026-0001", versionId: "version-id", versionNumber: 1, changeSummary: "Initial intake", savedAt: "2026-10-05T18:37:27.589Z", specificationData: { requirementSummary: "24V tracker", powerAndUnits: "12/24V nominal input", interfaces: "CAN requested", environmentAndIp: "" } });

describe("structured lifecycle template previews", () => {
  it("defines distinct SOR, Contract Review, and PRS structures", () => {
    expect(structuredLifecycleTemplatePreviews.map((template) => template.kind)).toEqual(["SOR", "CONTRACT_REVIEW", "PRS"]);
    expect(renderStructuredLifecycleTemplatePreview("SOR", source).content).toContain("2. Scope");
    expect(renderStructuredLifecycleTemplatePreview("CONTRACT_REVIEW", source).content).toContain("| Review item | Verified source | Local review |");
    expect(renderStructuredLifecycleTemplatePreview("PRS", source).content).toContain("| ID | Requirement | Source / constraint | Verification | Status |");
  });

  it("keeps unknown source values visibly TBC and never infers authorization", () => {
    const contractReview = renderStructuredLifecycleTemplatePreview("CONTRACT_REVIEW", source).content;
    expect(contractReview).toContain("TBC");
    expect(contractReview).toContain("Customer authorization: TBC (not inferred).");
  });

  it("substitutes user edits once and preserves HTML as literal text", () => {
    const rendered = renderStructuredLifecycleTemplatePreview("SOR", source, {
      SCOPE_STATEMENT: "<img src=x onerror=alert(1)> {{PROJECT_CODE}}",
      ACCEPTANCE_CRITERIA: "Inspection only",
    }).content;
    expect(rendered).toContain("<img src=x onerror=alert(1)> {{PROJECT_CODE}}");
    expect(rendered).not.toContain("<img src=x onerror=alert(1)> TBC");
  });

  it("fails closed when a required editable field is missing", () => {
    expect(() => renderStructuredLifecycleTemplatePreview("PRS", source, { FUNCTIONAL_REQUIREMENT: null })).toThrow("FUNCTIONAL_REQUIREMENT");
  });

  it("maps the exact pinned Master Specification source and preserves literal injected text", () => {
    const rendered = renderStructuredLifecycleTemplatePreview("SOR", source).content;
    expect(rendered).toContain("OPPORTUNITY-2026-0013");
    expect(rendered).toContain("MASTER-2026-0001 rev 1");
    expect(rendered).toContain("Tracker <script>alert(1)</script>");
    expect(source.sourceFields.ENVIRONMENT_AND_IP).toBe("TBC");
  });

  it("keeps different document schema fields type-specific", () => {
    expect(structuredLifecycleTemplatePreviews.find((item) => item.kind === "SOR")?.editableFields.map((field) => field.key)).toEqual(["SCOPE_STATEMENT", "ACCEPTANCE_CRITERIA"]);
    expect(structuredLifecycleTemplatePreviews.find((item) => item.kind === "CONTRACT_REVIEW")?.editableFields.map((field) => field.key)).toEqual(["COMMITMENT_SUMMARY", "EXCEPTIONS_AND_ACTIONS"]);
    expect(structuredLifecycleTemplatePreviews.find((item) => item.kind === "PRS")?.editableFields.map((field) => field.key)).toEqual(["FUNCTIONAL_REQUIREMENT", "VERIFICATION_METHOD"]);
  });
});```


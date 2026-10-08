import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CircleAlert, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLifecycleDeploymentObservation } from "@/lib/lifecycle-deployment-observation.functions";
import { ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND, ORIGINAL_LIFECYCLE_BACKEND } from "@/lib/lifecycle-deployment-observation";

type FormState = { backendRef: string; projectId: string; requestKey: string; templateId: string; templateDocumentRevisionId: string; sourceFingerprint: string };
type ObservationResult = { status: "BLOCKED"; missingContract: string; backendRef: string; capabilities: Record<string, { status: "OBSERVED" | "BLOCKED"; reason?: string }>; readback?: Record<string, { status: "OBSERVED" | "BLOCKED"; reason?: string }> };

const initialForm: FormState = { backendRef: ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND, projectId: "", requestKey: "", templateId: "", templateDocumentRevisionId: "", sourceFingerprint: "" };

export function LifecycleAcceptanceDiagnostics() {
  const observe = useServerFn(getLifecycleDeploymentObservation);
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<ObservationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isOriginal = form.backendRef.trim() === ORIGINAL_LIFECYCLE_BACKEND;
  const completeScope = Boolean(form.projectId && form.requestKey && form.templateId && form.templateDocumentRevisionId && form.sourceFingerprint);

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setResult(null);
    setError(null);
  }

  async function runCheck() {
    if (busy || !completeScope || isOriginal) return;
    setBusy(true); setResult(null); setError(null);
    try {
      const response = await observe({ data: {
        backendRef: form.backendRef.trim(), projectId: form.projectId.trim(), requestKey: form.requestKey.trim(),
        expectedSource: { templateId: form.templateId.trim(), templateDocumentRevisionId: form.templateDocumentRevisionId.trim(), sourceFingerprint: form.sourceFingerprint.trim() },
      } });
      setResult(response as ObservationResult);
    } catch {
      setError("The scoped read-only check could not be completed with your current access.");
    } finally { setBusy(false); }
  }

  return <Card className="space-y-5 border-dashed p-5">
    <div className="flex gap-3"><Activity className="mt-0.5 size-5 text-muted-foreground" /><div><h1 className="text-xl font-semibold">Lifecycle acceptance diagnostics</h1><p className="mt-1 text-sm text-muted-foreground">A manual, read-only check for one approved isolated project receipt and immutable source record.</p></div></div>
    <div className="flex gap-2 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0" /><p>No draft generation, file upload, role change, or record update is available here.</p></div>
    <div className="grid gap-3 md:grid-cols-2">
      <Field id="acceptance-backend" label="Isolated backend reference" value={form.backendRef} onChange={(value) => update("backendRef", value)} />
      <Field id="acceptance-project" label="Project ID" value={form.projectId} onChange={(value) => update("projectId", value)} />
      <Field id="acceptance-request" label="Draft request key" value={form.requestKey} onChange={(value) => update("requestKey", value)} />
      <Field id="acceptance-template" label="Template ID" value={form.templateId} onChange={(value) => update("templateId", value)} />
      <Field id="acceptance-revision" label="Template document revision ID" value={form.templateDocumentRevisionId} onChange={(value) => update("templateDocumentRevisionId", value)} />
      <Field id="acceptance-fingerprint" label="Source fingerprint (SHA-256)" value={form.sourceFingerprint} onChange={(value) => update("sourceFingerprint", value)} />
    </div>
    {isOriginal && <p role="alert" className="flex gap-2 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" />The original backend is unavailable for acceptance diagnostics.</p>}
    {!isOriginal && <Button onClick={() => void runCheck()} disabled={!completeScope || busy}>{busy ? "Checking scoped records…" : "Run scoped read-only check"}</Button>}
    {!isOriginal && !completeScope && <p className="text-xs text-muted-foreground">Provide the isolated project, request, template, revision, and fingerprint before running a check.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {result && <section aria-live="polite" className="space-y-3 border-t pt-4"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">Result: BLOCKED</strong><span className="text-xs text-muted-foreground">{result.missingContract}</span></div><CapabilityList title="Observed scope" capabilities={result.readback} /><CapabilityList title="Acceptance capabilities" capabilities={result.capabilities} /><p className="text-xs text-muted-foreground">This diagnostic does not establish full acceptance. Physical file bytes, catalog verification, and audit evidence remain unavailable until separately supported.</p></section>}
  </Card>;
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" spellCheck={false} /></div>;
}

function CapabilityList({ title, capabilities }: { title: string; capabilities?: Record<string, { status: "OBSERVED" | "BLOCKED"; reason?: string }> }) {
  const entries = Object.entries(capabilities ?? {});
  if (!entries.length) return null;
  return <div><h2 className="text-sm font-medium">{title}</h2><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{entries.map(([name, value]) => <li key={name}><span className="font-medium text-foreground">{name}</span>: {value.status}{value.reason ? ` — ${value.reason}` : ""}</li>)}</ul></div>;
}
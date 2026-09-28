import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ClipboardList, FileText, Layers3, Plus, Settings2, ShieldCheck, Users, Workflow, ArrowRight, UserCog } from "lucide-react";
import { PermissionGate } from "@/components/PermissionGate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveDepartment, saveNumberingRule, saveOrganizationSettings } from "@/lib/admin.functions";
import { confirmProvenance, updateAutomationRule } from "@/lib/automation.functions";
import { bootstrapSsmOneFoundation } from "@/lib/ssm-admin.functions";
import { toast } from "sonner";

const areas = [
  { title: "Organization settings", detail: "Brand, legal entity, and contact defaults.", icon: Building2, tab: "organization" as const },
  { title: "Departments", detail: "Department directory and active status.", icon: Users, tab: "departments" as const },
  { title: "Numbering & ID rules", detail: "Formats and future record sequences.", icon: FileText, tab: "numbering" as const },
  { title: "Automation", detail: "Automation controls and review queue.", icon: Workflow, tab: "automation" as const },
];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Administration — SSM One" }, { name: "description", content: "Organization administration for SSM One." },
    { property: "og:title", content: "Administration — SSM One" }, { property: "og:description", content: "Organization administration for SSM One." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminHome,
});

function AdminHome() {
  const [tab, setTab] = useState<"overview" | "organization" | "departments" | "numbering" | "automation">("overview");
  return <PermissionGate permission="admin.view" fallback={<AccessDenied />}>
    <section className="mx-auto max-w-6xl space-y-8">
      <div><p className="text-sm font-medium text-primary">System</p><h1 className="mt-1 text-2xl font-semibold">Administration</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage the organization foundation, access model, and configuration for SSM One.</p></div>
      <div className="flex flex-wrap gap-1 border-b"><Button variant={tab === "overview" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("overview")}>Overview</Button><Button variant={tab === "organization" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("organization")}>Organization</Button><Button variant={tab === "departments" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("departments")}>Departments</Button><Button variant={tab === "numbering" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("numbering")}>Numbering rules</Button><Button variant={tab === "automation" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("automation")}>Automation</Button></div>
      {tab === "organization" ? <OrganizationSettings /> : tab === "departments" ? <DepartmentSettings /> : tab === "numbering" ? <NumberingRules /> : tab === "automation" ? <AutomationCenter /> : <AdminOverview />}
    </section>
  </PermissionGate>;
}

function AdminOverview() { const [isSynchronizing, setIsSynchronizing] = useState(false); const sync = useServerFn(bootstrapSsmOneFoundation); return <div className="space-y-4"><div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
  {areas.map((area) => <div key={area.title} className="bg-card p-5"><area.icon className="size-5 text-primary" /><h2 className="mt-4 text-sm font-semibold">{area.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{area.detail}</p><span className="mt-5 inline-block text-xs font-medium text-muted-foreground">Use the tabs above</span></div>)}
 </div><div className="grid gap-4 md:grid-cols-3"><Link to="/hr/access" className="border bg-card p-5 transition-colors hover:bg-muted/50"><UserCog className="size-5 text-primary" /><h2 className="mt-4 font-semibold">Employees & access</h2><p className="mt-1 text-sm text-muted-foreground">Assign departments, roles, and active workspace access.</p><span className="mt-4 flex items-center gap-1 text-sm font-medium text-primary">Manage people <ArrowRight className="size-4" /></span></Link><Link to="/history" className="border bg-card p-5 transition-colors hover:bg-muted/50"><ClipboardList className="size-5 text-primary" /><h2 className="mt-4 font-semibold">Activity history</h2><p className="mt-1 text-sm text-muted-foreground">Review recorded administrative and operational changes.</p><span className="mt-4 flex items-center gap-1 text-sm font-medium text-primary">Open history <ArrowRight className="size-4" /></span></Link><div className="border bg-card p-5"><Settings2 className="size-5 text-primary" /><h2 className="mt-4 font-semibold">System configuration</h2><p className="mt-1 text-sm text-muted-foreground">Synchronize the supported catalogue after an application update.</p><Button className="mt-4" size="sm" disabled={isSynchronizing} onClick={async () => { setIsSynchronizing(true); try { await sync(); toast.success("System configuration synchronized."); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not synchronize system configuration."); } finally { setIsSynchronizing(false); } }}>{isSynchronizing ? "Synchronizing…" : "Synchronize"}</Button></div></div></div>; }

function OrganizationSettings() {
  const [organization, setOrganization] = useState<{ id: string; legal_name: string; brand_name: string; default_email: string | null; phone: string | null; website: string | null; address: string | null; footer_text: string | null } | null>(null);
  const save = useServerFn(saveOrganizationSettings);
  useEffect(() => { void supabase.from("organizations").select("id, legal_name, brand_name, default_email, phone, website, address, footer_text").limit(1).maybeSingle().then(({ data }) => setOrganization(data)); }, []);
  if (!organization) return <p className="text-sm text-muted-foreground">Loading organization settings…</p>;
  const update = (key: keyof typeof organization, value: string) => setOrganization({ ...organization, [key]: value || null } as typeof organization);
  return <form className="max-w-3xl space-y-5 rounded-lg border bg-card p-5" onSubmit={async (event) => { event.preventDefault(); try { await save({ data: organization }); toast.success("Organization settings saved"); } catch { toast.error("Could not save organization settings"); } }}>
    <div><h2 className="font-semibold">Organization settings</h2><p className="mt-1 text-sm text-muted-foreground">These values drive company branding and defaults without code changes.</p></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Legal company name" value={organization.legal_name} onChange={(v) => update("legal_name", v)} /><Field label="Brand / trading name" value={organization.brand_name} onChange={(v) => update("brand_name", v)} /><Field label="Default email" value={organization.default_email ?? ""} onChange={(v) => update("default_email", v)} /><Field label="Phone" value={organization.phone ?? ""} onChange={(v) => update("phone", v)} /><Field label="Website" value={organization.website ?? ""} onChange={(v) => update("website", v)} /><Field label="Footer text" value={organization.footer_text ?? ""} onChange={(v) => update("footer_text", v)} /></div>
    <Button>Save changes</Button>
  </form>;
}

function DepartmentSettings() {
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string | null; description: string | null; aliases: string[]; is_active: boolean; document_code_enabled: boolean }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<typeof departments[number] | null>(null);
  const load = () => void supabase.from("departments").select("id, name, code, description, aliases, is_active, document_code_enabled").order("sort_order").then(({ data, error }) => { setLoadError(error?.message ?? null); setDepartments(data ?? []); });
  useEffect(load, []);
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Department master</h2><p className="text-sm text-muted-foreground">Official company departments and controlled-document settings.</p></div><Button size="sm" onClick={() => setEditing({ id: "", name: "", code: null, description: null, aliases: [], is_active: true, document_code_enabled: false })}><Plus /> Add department</Button></div>
    {loadError && <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">Could not load departments: {loadError}</p>}<div className="overflow-hidden rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="p-3 font-medium">Department</th><th className="p-3 font-medium">Code</th><th className="p-3 font-medium">Status</th><th className="p-3" /></tr></thead><tbody>{departments.map((department) => <tr key={department.id} className="border-t"><td className="p-3"><p className="font-medium">{department.name}</p>{department.description && <p className="text-xs text-muted-foreground">{department.description}</p>}</td><td className="p-3 text-muted-foreground">{department.code ?? "—"}</td><td className="p-3">{department.is_active ? "Active" : "Inactive"}</td><td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing(department)}>Edit</Button></td></tr>)}{!loadError && !departments.length && <tr><td className="p-5 text-center text-muted-foreground" colSpan={4}>No departments were returned. Refresh this page to try again.</td></tr>}</tbody></table></div>
    <DepartmentDialog department={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
  </div>;
}

function DepartmentDialog({ department, onClose, onSaved }: { department: { id: string; name: string; code: string | null; description: string | null; aliases: string[]; is_active: boolean; document_code_enabled: boolean } | null; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(department); const [saving, setSaving] = useState(false); const save = useServerFn(saveDepartment);
  useEffect(() => setDraft(department), [department]);
  if (!draft) return null;
  return <Dialog open={!!department} onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{draft.id ? "Edit department" : "Add department"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); setSaving(true); try { await save({ data: { ...draft, id: draft.id || undefined } }); toast.success("Department saved"); onSaved(); } catch (error: unknown) { toast.error(error instanceof Error ? error.message : "Could not save department"); } finally { setSaving(false); } }}><Field label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><Field label="Code" value={draft.code ?? ""} onChange={(code) => setDraft({ ...draft, code: code || null })} /><Field label="Aliases" value={draft.aliases.join(", ")} onChange={(aliases) => setDraft({ ...draft, aliases: aliases.split(",") })} /><Field label="Description" value={draft.description ?? ""} onChange={(description) => setDraft({ ...draft, description: description || null })} /><div className="flex items-center justify-between rounded-md border p-3"><div><p className="text-sm font-medium">Department status</p><p className="text-xs text-muted-foreground">Inactive departments remain in history but cannot receive new assignments.</p></div><Button type="button" size="sm" variant={draft.is_active ? "outline" : "default"} onClick={() => setDraft({ ...draft, is_active: !draft.is_active })}>{draft.is_active ? "Deactivate" : "Activate"}</Button></div><div className="flex items-center justify-between rounded-md border p-3"><div><p className="text-sm font-medium">Document code</p><p className="text-xs text-muted-foreground">Allow this department’s code in controlled-document formats.</p></div><Button type="button" size="sm" variant={draft.document_code_enabled ? "default" : "outline"} onClick={() => setDraft({ ...draft, document_code_enabled: !draft.document_code_enabled })}>{draft.document_code_enabled ? "Enabled" : "Enable"}</Button></div><DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={!draft.name.trim() || saving}>{saving ? "Saving…" : "Save department"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

type NumberingRule = { id: string; key: string; label: string; entity_type: string | null; prefix_template: string; include_year: boolean; include_department: boolean; include_project: boolean; separator: string; serial_padding: number; starting_number: number; reset_policy: string; current_sequence: number; is_active: boolean };

function NumberingRules() {
  const [rules, setRules] = useState<NumberingRule[]>([]);
  const [editing, setEditing] = useState<NumberingRule | null>(null);
  const load = () => void supabase.from("document_numbering_config").select("id,key,label,entity_type,prefix_template,include_year,include_department,include_project,separator,serial_padding,starting_number,reset_policy,current_sequence,is_active").order("label").then(({ data }) => setRules((data ?? []) as NumberingRule[]));
  useEffect(load, []);
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Numbering & ID rules</h2><p className="text-sm text-muted-foreground">Generated codes are locked after creation. Changes apply only to future records.</p></div><Button size="sm" onClick={() => setEditing({ id: "", key: "", label: "", entity_type: null, prefix_template: "", include_year: true, include_department: false, include_project: false, separator: "-", serial_padding: 4, starting_number: 1, reset_policy: "yearly", current_sequence: 0, is_active: true })}><Plus /> Add rule</Button></div><div className="overflow-hidden rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="p-3">Rule</th><th className="p-3">Format</th><th className="p-3">Next sequence</th><th className="p-3">Status</th><th className="p-3" /></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id} className="border-t"><td className="p-3"><p className="font-medium">{rule.label}</p><p className="text-xs text-muted-foreground">{rule.entity_type ?? rule.key}</p></td><td className="p-3 font-mono text-xs">{[rule.prefix_template, rule.include_year ? "YYYY" : null, rule.include_department ? "DEPT" : null, rule.include_project ? "PROJECT" : null, "#".repeat(rule.serial_padding)].filter(Boolean).join(rule.separator)}</td><td className="p-3">{rule.current_sequence + 1}</td><td className="p-3">{rule.is_active ? "Active" : "Inactive"}</td><td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(rule)}><Settings2 className="size-4" /></Button></td></tr>)}</tbody></table></div><NumberingRuleDialog rule={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /></div>;
}

function NumberingRuleDialog({ rule, onClose, onSaved }: { rule: NumberingRule | null; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(rule); const save = useServerFn(saveNumberingRule); useEffect(() => setDraft(rule), [rule]);
  if (!draft) return null;
  const update = (key: keyof NumberingRule, value: string | number | boolean | null) => setDraft({ ...draft, [key]: value });
  const preview = [draft.prefix_template || "CODE", draft.include_year ? "2026" : null, draft.include_department ? "DEPT" : null, draft.include_project ? "PROJECT" : null, String(draft.starting_number).padStart(draft.serial_padding, "0")].filter(Boolean).join(draft.separator || "-");
  return <Dialog open={!!rule} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{draft.id ? "Edit numbering rule" : "Add numbering rule"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); try { await save({ data: { ...draft, id: draft.id || undefined, key: draft.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"), label: draft.label.trim(), entity_type: draft.entity_type?.trim() || null, prefix_template: draft.prefix_template.trim() } }); toast.success("Numbering rule saved"); onSaved(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save numbering rule"); } }}><Field label="Rule name" value={draft.label} onChange={(value) => update("label", value)} /><Field label="Rule key" value={draft.key} onChange={(value) => update("key", value)} /><Field label="Entity type" value={draft.entity_type ?? ""} onChange={(value) => update("entity_type", value || null)} /><Field label="Prefix" value={draft.prefix_template} onChange={(value) => update("prefix_template", value)} /><div className="grid grid-cols-2 gap-3"><Field label="Separator" value={draft.separator} onChange={(value) => update("separator", value)} /><div className="space-y-1.5"><Label>Sequence length</Label><Input type="number" min="1" max="10" value={draft.serial_padding} onChange={(event) => update("serial_padding", Number(event.target.value))} /></div></div><p className="rounded-md border bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Preview: </span><span className="font-mono">{preview}</span></p><div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={draft.include_year} onChange={(event) => update("include_year", event.target.checked)} /> Year</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.include_department} onChange={(event) => update("include_department", event.target.checked)} /> Department</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.include_project} onChange={(event) => update("include_project", event.target.checked)} /> Project</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.is_active} onChange={(event) => update("is_active", event.target.checked)} /> Active</label></div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!draft.label.trim() || !draft.key.trim() || !draft.prefix_template.trim()}>Save rule</Button></DialogFooter></form></DialogContent></Dialog>;
}

type AutomationRule = { id: string; name: string; description: string | null; trigger_key: string; execution_mode: string; is_enabled: boolean };
type ProvenanceReview = { id: string; entity_type: string; field_key: string; provider: string | null; source_kind: string; state: string; confidence: number | null; fetched_at: string };
type AutomationRun = { id: string; trigger_key: string; status: string; error_message: string | null; created_at: string; completed_at: string | null };

function AutomationCenter() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [reviews, setReviews] = useState<ProvenanceReview[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const toggleRule = useServerFn(updateAutomationRule);
  const reviewProvenance = useServerFn(confirmProvenance);
  const load = () => {
    void Promise.all([
      supabase.from("automation_rules").select("id,name,description,trigger_key,execution_mode,is_enabled").order("priority"),
      supabase.from("data_provenance").select("id,entity_type,field_key,provider,source_kind,state,confidence,fetched_at").in("state", ["suggested", "needs_review"]).order("fetched_at", { ascending: false }).limit(30),
      supabase.from("automation_runs").select("id,trigger_key,status,error_message,created_at,completed_at").order("created_at", { ascending: false }).limit(12),
    ]).then(([ruleResult, reviewResult, runResult]) => {
      if (ruleResult.error || reviewResult.error || runResult.error) toast.error("Could not load the automation center");
      setRules((ruleResult.data ?? []) as AutomationRule[]);
      setReviews((reviewResult.data ?? []) as ProvenanceReview[]);
      setRuns((runResult.data ?? []) as AutomationRun[]);
    });
  };
  useEffect(load, []);
  const handleRuleToggle = async (rule: AutomationRule) => {
    setBusy(rule.id);
    try { await toggleRule({ data: { id: rule.id, isEnabled: !rule.is_enabled } }); toast.success(rule.is_enabled ? "Automation paused" : "Automation enabled"); load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not update automation"); }
    finally { setBusy(null); }
  };
  const handleReview = async (item: ProvenanceReview, state: "confirmed" | "rejected") => {
    setBusy(item.id);
    try { await reviewProvenance({ data: { id: item.id, state, overrideValue: null, overrideReason: null } }); toast.success(state === "confirmed" ? "Suggestion confirmed" : "Suggestion rejected"); load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not review suggestion"); }
    finally { setBusy(null); }
  };
  return <div className="space-y-8">
    <div><h2 className="font-semibold">Automation center</h2><p className="mt-1 text-sm text-muted-foreground">Automation stays reviewable: pause a rule, approve a suggested value, and inspect the latest activity.</p></div>
    <section className="space-y-3"><div><h3 className="text-sm font-semibold">Automation rules</h3><p className="text-sm text-muted-foreground">Only enabled rules may run. High-impact actions remain subject to review.</p></div><div className="overflow-hidden rounded-lg border">{rules.length ? <table className="w-full text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="p-3 font-medium">Rule</th><th className="p-3 font-medium">Trigger</th><th className="p-3 font-medium">Mode</th><th className="p-3 font-medium">State</th><th className="p-3" /></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id} className="border-t"><td className="p-3"><p className="font-medium">{rule.name}</p>{rule.description && <p className="mt-0.5 text-xs text-muted-foreground">{rule.description}</p>}</td><td className="p-3 font-mono text-xs text-muted-foreground">{rule.trigger_key}</td><td className="p-3 capitalize">{rule.execution_mode.replaceAll("_", " ")}</td><td className="p-3">{rule.is_enabled ? "Enabled" : "Paused"}</td><td className="p-3 text-right"><Button size="sm" variant={rule.is_enabled ? "outline" : "default"} disabled={busy === rule.id} onClick={() => void handleRuleToggle(rule)}>{rule.is_enabled ? "Pause" : "Enable"}</Button></td></tr>)}</tbody></table> : <p className="p-5 text-sm text-muted-foreground">No automation rules have been configured yet.</p>}</div></section>
    <section className="space-y-3"><div><h3 className="text-sm font-semibold">Review queue</h3><p className="text-sm text-muted-foreground">External and AI-suggested values require a human decision before they are treated as verified.</p></div><div className="overflow-hidden rounded-lg border">{reviews.length ? <table className="w-full text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="p-3 font-medium">Record</th><th className="p-3 font-medium">Source</th><th className="p-3 font-medium">Confidence</th><th className="p-3" /></tr></thead><tbody>{reviews.map((item) => <tr key={item.id} className="border-t"><td className="p-3"><p className="font-medium">{item.entity_type} · {item.field_key}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.state.replaceAll("_", " ")} · {new Date(item.fetched_at).toLocaleDateString()}</p></td><td className="p-3">{item.provider ?? item.source_kind}</td><td className="p-3">{item.confidence == null ? "—" : `${Math.round(item.confidence * 100)}%`}</td><td className="p-3 text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void handleReview(item, "rejected")}>Reject</Button><Button size="sm" disabled={busy === item.id} onClick={() => void handleReview(item, "confirmed")}>Confirm</Button></div></td></tr>)}</tbody></table> : <p className="p-5 text-sm text-muted-foreground">No suggestions are waiting for review.</p>}</div></section>
    <section className="space-y-3"><div><h3 className="text-sm font-semibold">Recent runs</h3><p className="text-sm text-muted-foreground">A short operational record of background work and any failures.</p></div><div className="overflow-hidden rounded-lg border">{runs.length ? <table className="w-full text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="p-3 font-medium">Trigger</th><th className="p-3 font-medium">Outcome</th><th className="p-3 font-medium">Started</th><th className="p-3 font-medium">Detail</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-t"><td className="p-3 font-mono text-xs">{run.trigger_key}</td><td className="p-3 capitalize">{run.status}</td><td className="p-3 text-muted-foreground">{new Date(run.created_at).toLocaleString()}</td><td className="p-3 text-xs text-muted-foreground">{run.error_message ?? "—"}</td></tr>)}</tbody></table> : <p className="p-5 text-sm text-muted-foreground">No automation runs have been recorded yet.</p>}</div></section>
  </div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} /></div>; }

function AccessDenied() { return <section className="mx-auto max-w-lg py-20 text-center"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-sm text-muted-foreground">Your account does not have access to administration.</p><Link to="/" className="mt-5 inline-block text-sm font-medium text-primary">Return to workspace</Link></section>; }

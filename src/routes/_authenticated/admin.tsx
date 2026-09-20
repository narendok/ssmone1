import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ClipboardList, FileText, Layers3, Plus, Settings2, ShieldCheck, Users } from "lucide-react";
import { PermissionGate } from "@/components/PermissionGate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveDepartment, saveOrganizationSettings } from "@/lib/admin.functions";
import { toast } from "sonner";

const areas = [
  { title: "Organization settings", detail: "Brand, legal entity, regional defaults, and document presentation.", icon: Building2 },
  { title: "Departments", detail: "Official department directory, leads, hierarchy, and active status.", icon: Users },
  { title: "Users & assignments", detail: "Employee identity, access state, roles, and department membership.", icon: ShieldCheck },
  { title: "Roles & permissions", detail: "Reusable role catalogue and permission assignments.", icon: Layers3 },
  { title: "Numbering & ID rules", detail: "Central code formats and sequences for company records.", icon: FileText },
  { title: "Audit log", detail: "Administrative activity and change history.", icon: ClipboardList },
];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Administration — SSM One" }, { name: "description", content: "Organization administration for SSM One." },
    { property: "og:title", content: "Administration — SSM One" }, { property: "og:description", content: "Organization administration for SSM One." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminHome,
});

function AdminHome() {
  const [tab, setTab] = useState<"overview" | "organization" | "departments" | "numbering">("overview");
  return <PermissionGate permission="admin.view" fallback={<AccessDenied />}>
    <section className="mx-auto max-w-6xl space-y-8">
      <div><p className="text-sm font-medium text-primary">System</p><h1 className="mt-1 text-2xl font-semibold">Administration</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage the organization foundation, access model, and configuration for SSM One.</p></div>
      <div className="flex gap-1 border-b"><Button variant={tab === "overview" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("overview")}>Overview</Button><Button variant={tab === "organization" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("organization")}>Organization</Button><Button variant={tab === "departments" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("departments")}>Departments</Button><Button variant={tab === "numbering" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("numbering")}>Numbering rules</Button></div>
      {tab === "organization" ? <OrganizationSettings /> : tab === "departments" ? <DepartmentSettings /> : tab === "numbering" ? <NumberingRules /> : <AdminOverview />}
    </section>
  </PermissionGate>;
}

function AdminOverview() { return <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
  {areas.map((area) => <div key={area.title} className="bg-card p-5"><area.icon className="size-5 text-primary" /><h2 className="mt-4 text-sm font-semibold">{area.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{area.detail}</p><span className="mt-5 inline-block text-xs font-medium text-muted-foreground">Configuration workspace</span></div>)}
</div>; }

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
  const [editing, setEditing] = useState<typeof departments[number] | null>(null);
  const load = () => void supabase.from("departments").select("id, name, code, description, aliases, is_active, document_code_enabled").order("sort_order").then(({ data }) => setDepartments(data ?? []));
  useEffect(load, []);
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Department master</h2><p className="text-sm text-muted-foreground">Official company departments and controlled-document settings.</p></div><Button size="sm" onClick={() => setEditing({ id: "", name: "", code: null, description: null, aliases: [], is_active: true, document_code_enabled: false })}><Plus /> Add department</Button></div>
    <div className="overflow-hidden rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="p-3 font-medium">Department</th><th className="p-3 font-medium">Code</th><th className="p-3 font-medium">Status</th><th className="p-3" /></tr></thead><tbody>{departments.map((department) => <tr key={department.id} className="border-t"><td className="p-3"><p className="font-medium">{department.name}</p>{department.description && <p className="text-xs text-muted-foreground">{department.description}</p>}</td><td className="p-3 text-muted-foreground">{department.code ?? "—"}</td><td className="p-3">{department.is_active ? "Active" : "Inactive"}</td><td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing(department)}>Edit</Button></td></tr>)}</tbody></table></div>
    <DepartmentDialog department={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
  </div>;
}

function DepartmentDialog({ department, onClose, onSaved }: { department: { id: string; name: string; code: string | null; description: string | null; aliases: string[]; is_active: boolean; document_code_enabled: boolean } | null; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(department); const save = useServerFn(saveDepartment);
  useEffect(() => setDraft(department), [department]);
  if (!draft) return null;
  return <Dialog open={!!department} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{draft.id ? "Edit department" : "Add department"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); try { await save({ data: { ...draft, id: draft.id || undefined } }); toast.success("Department saved"); onSaved(); } catch (error: any) { toast.error(error?.message ?? "Could not save department"); } }}><Field label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><Field label="Code" value={draft.code ?? ""} onChange={(code) => setDraft({ ...draft, code: code || null })} /><Field label="Aliases" value={draft.aliases.join(", ")} onChange={(aliases) => setDraft({ ...draft, aliases: aliases.split(",") })} /><Field label="Description" value={draft.description ?? ""} onChange={(description) => setDraft({ ...draft, description: description || null })} /><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!draft.name}>Save department</Button></DialogFooter></form></DialogContent></Dialog>;
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
  const [draft, setDraft] = useState(rule); useEffect(() => setDraft(rule), [rule]);
  if (!draft) return null;
  const update = (key: keyof NumberingRule, value: string | number | boolean | null) => setDraft({ ...draft, [key]: value });
  const preview = [draft.prefix_template || "CODE", draft.include_year ? "2026" : null, draft.include_department ? "DEPT" : null, draft.include_project ? "PROJECT" : null, String(draft.starting_number).padStart(draft.serial_padding, "0")].filter(Boolean).join(draft.separator || "-");
  return <Dialog open={!!rule} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{draft.id ? "Edit numbering rule" : "Add numbering rule"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); const payload = { ...draft, key: draft.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"), label: draft.label.trim(), entity_type: draft.entity_type?.trim() || null, prefix_template: draft.prefix_template.trim() }; const { error } = draft.id ? await supabase.from("document_numbering_config").update(payload).eq("id", draft.id) : await supabase.from("document_numbering_config").insert(payload); if (error) return toast.error(error.message); toast.success("Numbering rule saved"); onSaved(); }}><Field label="Rule name" value={draft.label} onChange={(value) => update("label", value)} /><Field label="Entity type" value={draft.entity_type ?? ""} onChange={(value) => update("entity_type", value || null)} /><Field label="Prefix" value={draft.prefix_template} onChange={(value) => update("prefix_template", value)} /><div className="grid grid-cols-2 gap-3"><Field label="Separator" value={draft.separator} onChange={(value) => update("separator", value)} /><div className="space-y-1.5"><Label>Sequence length</Label><Input type="number" min="1" max="10" value={draft.serial_padding} onChange={(event) => update("serial_padding", Number(event.target.value))} /></div></div><p className="rounded-md border bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Preview: </span><span className="font-mono">{preview}</span></p><div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={draft.include_year} onChange={(event) => update("include_year", event.target.checked)} /> Year</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.include_department} onChange={(event) => update("include_department", event.target.checked)} /> Department</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.include_project} onChange={(event) => update("include_project", event.target.checked)} /> Project</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.is_active} onChange={(event) => update("is_active", event.target.checked)} /> Active</label></div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!draft.label.trim() || !draft.prefix_template.trim()}>Save rule</Button></DialogFooter></form></DialogContent></Dialog>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} /></div>; }

function AccessDenied() { return <section className="mx-auto max-w-lg py-20 text-center"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-sm text-muted-foreground">Your account does not have access to administration.</p><Link to="/" className="mt-5 inline-block text-sm font-medium text-primary">Return to workspace</Link></section>; }

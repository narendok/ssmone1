import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWorkspacePreference, saveWorkspacePreference } from "@/lib/department-workspace";
import { useAuth } from "@/hooks/useAuth";

const filters = [{ value: "all", label: "All files" }, { value: "common", label: "Common documents" }, { value: "internal", label: "Internal projects" }, { value: "client", label: "Client projects" }, { value: "ppap", label: "PPAP" }, { value: "starred", label: "Starred" }, { value: "boms", label: "Project BOMs" }];

export function DepartmentWorkspacePreferences({ departmentId }: { departmentId: string }) {
  const { role } = useAuth();
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const preference = useQuery({ queryKey: ["department_workspace_preferences", departmentId], queryFn: () => fetchWorkspacePreference(departmentId) });
  const current = preference.data;
  const update = async (patch: Parameters<typeof saveWorkspacePreference>[1]) => { setSaving(true); try { await saveWorkspacePreference(departmentId, patch); await client.invalidateQueries({ queryKey: ["department_workspace_preferences", departmentId] }); toast.success("Workspace preference saved"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save workspace preference"); } finally { setSaving(false); } };
  return <section className="space-y-3"><div><h2 className="text-lg font-semibold">Workspace settings</h2><p className="mt-1 text-sm text-muted-foreground">Personal defaults for this department workspace.</p></div><Card><CardHeader><CardTitle className="text-base">Drive view</CardTitle><CardDescription>Choose which department Drive area opens first.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div><p className="mb-1.5 text-sm font-medium">Default filter</p><Select value={current?.drive_default_filter ?? "all"} onValueChange={(drive_default_filter) => void update({ drive_default_filter })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{filters.map((filter) => <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>)}</SelectContent></Select></div><ToggleRow label="Show documents on dashboard" checked={current?.show_dashboard_documents ?? true} disabled={saving} onCheckedChange={(show_dashboard_documents) => void update({ show_dashboard_documents })} /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Project tracker</CardTitle><CardDescription>Set how project progress is presented in this workspace.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div><p className="mb-1.5 text-sm font-medium">Preferred layout</p><Select value={current?.project_tracker_view ?? "cards"} onValueChange={(project_tracker_view) => void update({ project_tracker_view })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cards">Project cards</SelectItem><SelectItem value="table">Table</SelectItem></SelectContent></Select></div>{role === "admin" && <ToggleRow label="Lead digest" description="Keep this department’s lead digest enabled." checked={current?.lead_digest_enabled ?? true} disabled={saving} onCheckedChange={(lead_digest_enabled) => void update({ lead_digest_enabled })} />}</CardContent></Card><Button variant="outline" size="sm" disabled={saving} onClick={() => void preference.refetch()}>Refresh settings</Button></section>;
}

function ToggleRow({ label, description, checked, disabled, onCheckedChange }: { label: string; description?: string; checked: boolean; disabled: boolean; onCheckedChange: (value: boolean) => void }) { return <div className="flex items-center justify-between gap-3 border p-3"><div><p className="text-sm font-medium">{label}</p>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div><Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} /></div>; }
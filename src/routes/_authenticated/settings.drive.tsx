import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsNav } from "@/components/SettingsNav";
import { fetchCanonicalDepartments, type CanonicalDepartment } from "@/lib/tasks";
import { fetchDriveCategoryTemplates, slugify, type DriveCategoryPlacement, type DriveCategoryTemplate } from "@/lib/drive";
import { supabase } from "@/integrations/supabase/client";

const placements: Array<{ value: DriveCategoryPlacement; label: string; hint: string }> = [
  { value: "COMMON", label: "Common documents", hint: "Rules, standards and department-wide records" },
  { value: "INTERNAL_PROJECT", label: "Internal projects", hint: "Folders added to new internal project spaces" },
  { value: "CLIENT_PROJECT", label: "Client projects", hint: "Folders added to new client project spaces" },
];

export const Route = createFileRoute("/_authenticated/settings/drive")({
  head: () => ({ meta: [{ title: "Drive Structure — SSM One" }, { name: "description", content: "Department Drive categories and project folder templates." }, { property: "og:title", content: "Drive Structure — SSM One" }, { property: "og:description", content: "Department Drive categories and project folder templates." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: DriveStructureSettings,
});

function DriveStructureSettings() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState("");
  const [placement, setPlacement] = useState<DriveCategoryPlacement>("COMMON");
  const { data: departments = [] } = useQuery({ queryKey: ["active-departments"], queryFn: fetchCanonicalDepartments });
  const { data: categories = [], isLoading } = useQuery({ queryKey: ["drive_category_templates", departmentId], queryFn: () => fetchDriveCategoryTemplates(departmentId), enabled: Boolean(departmentId) });
  const department = useMemo(() => departments.find((item) => item.id === departmentId) ?? null, [departmentId, departments]);
  useEffect(() => { if (!departmentId && departments[0]) setDepartmentId(departments[0].id); }, [departmentId, departments]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["drive_category_templates", departmentId] });
  const update = async (template: DriveCategoryTemplate, patch: Partial<DriveCategoryTemplate>) => {
    const { error } = await supabase.from("drive_category_templates").update(patch).eq("id", template.id);
    if (error) return toast.error(error.message);
    refresh();
  };
  const remove = async (template: DriveCategoryTemplate) => {
    const { error } = await supabase.from("drive_category_templates").delete().eq("id", template.id);
    if (error) return toast.error(error.message);
    toast.success("Folder category removed from future projects");
    refresh();
  };
  const add = async () => {
    if (!departmentId) return;
    const label = window.prompt("Folder category name");
    if (!label?.trim()) return;
    const { error } = await supabase.from("drive_category_templates").insert({ department_id: departmentId, placement, label: label.trim(), slug: slugify(label), sort_order: categories.filter((item) => item.placement === placement).length + 1 });
    if (error) return toast.error(error.message);
    toast.success("Folder category added for future projects");
    refresh();
  };
  if (role !== "admin") return <section className="mx-auto max-w-lg py-20 text-center"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-sm text-muted-foreground">Only a Platform Owner can change the Drive structure.</p></section>;

  const items = categories.filter((item) => item.placement === placement);
  return <div className="mx-auto max-w-5xl space-y-5"><SettingsNav /><div><h1 className="text-2xl font-semibold">Drive structure</h1><p className="mt-1 text-sm text-muted-foreground">Common documents stay with the department; project folders are applied when a new internal or client project is created.</p></div><div className="flex flex-wrap gap-2">{departments.map((item: CanonicalDepartment) => <Button key={item.id} size="sm" variant={item.id === departmentId ? "default" : "outline"} onClick={() => setDepartmentId(item.id)}>{item.name}</Button>)}</div><Tabs value={placement} onValueChange={(value) => setPlacement(value as DriveCategoryPlacement)}><TabsList className="h-auto flex-wrap">{placements.map((item) => <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>)}</TabsList></Tabs><Card className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{department?.name ?? "Department"} · {placements.find((item) => item.value === placement)?.label}</h2><p className="text-sm text-muted-foreground">{placements.find((item) => item.value === placement)?.hint}</p></div><Button size="sm" onClick={add}><Plus className="mr-1 h-4 w-4" /> Add folder</Button></div></Card>{isLoading ? <Card className="p-8 text-center text-muted-foreground">Loading folder categories…</Card> : items.length === 0 ? <Card className="p-8 text-center text-muted-foreground">No folder categories yet.</Card> : <div className="space-y-2">{items.map((item) => <Card key={item.id} className="flex flex-wrap items-center gap-3 p-3"><Input aria-label={`Folder name ${item.label}`} defaultValue={item.label} className="min-w-[200px] flex-1" onBlur={(event) => { const label = event.currentTarget.value.trim(); if (label && label !== item.label) void update(item, { label, slug: slugify(label) }); }} /><div className="flex items-center gap-2"><Label htmlFor={`active-${item.id}`} className="text-xs text-muted-foreground">Use for new folders</Label><Switch id={`active-${item.id}`} checked={item.is_active} onCheckedChange={(is_active) => void update(item, { is_active })} /></div><Button size="icon" variant="ghost" aria-label={`Remove ${item.label}`} onClick={() => void remove(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button></Card>)}</div>}<p className="text-xs text-muted-foreground">Changes affect new folders only. Existing controlled folders remain unchanged.</p></div>;
}
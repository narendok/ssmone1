import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { savePhase10Record } from "@/lib/phase10.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const sb = supabase as any;
type Phase10Table = "external_parties" | "external_contacts" | "external_portal_access" | "external_share_snapshots" | "external_transmittals" | "external_review_requests" | "external_actions" | "external_upload_requests" | "external_data_rooms" | "external_data_room_items" | "external_api_clients" | "external_webhook_subscriptions";
type InputConfig = { key: string; label: string; type?: "text" | "date" | "number" | "textarea" | "select"; options?: { value: string; label: string }[]; required?: boolean; description?: string };
export type Phase10Config = { eyebrow: string; title: string; description: string; table: Phase10Table; columns: { key: string; label: string }[]; inputs: InputConfig[]; createLabel?: string };

export function Phase10ListPage({ config }: { config: Phase10Config }) {
  const [open, setOpen] = useState(false); const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: [config.table], queryFn: async () => { const { data, error } = await sb.from(config.table).select("*").order("created_at", { ascending: false }); if (error) throw error; return data as Record<string, unknown>[]; } });
  return <section className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-primary">{config.eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{config.title}</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{config.description}</p></div><Button onClick={() => setOpen(true)}><Plus className="size-4" />{config.createLabel ?? "New record"}</Button></div><Card className="border-primary/10 bg-primary/[0.02] p-3 text-xs text-muted-foreground"><ShieldCheck className="mr-2 inline size-4 text-primary" />Records are internal and permission-controlled. External visibility must be explicitly published through an approved portal flow.</Card><Card className="overflow-x-auto"><Table><TableHeader><TableRow>{config.columns.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{isLoading ? <TableRow><TableCell colSpan={config.columns.length} className="py-12 text-center">Loading…</TableCell></TableRow> : data.length ? data.map(record => <TableRow key={String(record.id)}>{config.columns.map(column => <TableCell key={column.key}>{String(record[column.key] ?? "—").replaceAll("_", " ")}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={config.columns.length} className="py-12 text-center text-muted-foreground">No records yet.</TableCell></TableRow>}</TableBody></Table></Card><CreateDialog config={config} open={open} onOpenChange={setOpen} onSaved={() => queryClient.invalidateQueries({ queryKey: [config.table] })} /></section>;
}
function CreateDialog({ config, open, onOpenChange, onSaved }: { config: Phase10Config; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const mutation = useMutation({ mutationFn: () => { const payload = Object.fromEntries(config.inputs.filter(i => values[i.key] !== undefined && values[i.key] !== "").map(i => [i.key, i.type === "number" ? Number(values[i.key]) : values[i.key]])); return savePhase10Record({ data: { table: config.table, payload } }); }, onSuccess: () => { toast.success("Record saved"); setValues({}); onSaved(); onOpenChange(false); }, onError: (error: Error) => toast.error(error.message) });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{config.createLabel ?? "New record"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2">{config.inputs.map(input => <div className="grid gap-2" key={input.key}><Label>{input.label}{input.required ? " *" : ""}</Label>{input.description && <p className="text-xs text-muted-foreground">{input.description}</p>}{input.type === "textarea" ? <Textarea value={values[input.key] ?? ""} onChange={e => setValues({ ...values, [input.key]: e.target.value })} /> : input.options ? <Select value={values[input.key] ?? ""} onValueChange={value => setValues({ ...values, [input.key]: value })}><SelectTrigger><SelectValue placeholder={`Select ${input.label.toLowerCase()}`} /></SelectTrigger><SelectContent>{input.options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select> : <Input type={input.type ?? "text"} value={values[input.key] ?? ""} onChange={e => setValues({ ...values, [input.key]: e.target.value })} />}</div>)}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending || config.inputs.some(i => i.required && !values[i.key]?.trim())} onClick={() => mutation.mutate()}>{mutation.isPending ? "Saving…" : "Save"}</Button></DialogFooter></DialogContent></Dialog>;
}

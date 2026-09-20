import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Play, TestTube2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { recordPhase7UnitExecution, recordPhase7UnitInspection, recordPhase7UnitTest } from "@/lib/production.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/production/shopfloor")({
  component: ShopFloorPage,
  head: () => ({ meta: [{ title: "Shop floor — SSM One" }, { name: "description", content: "Record serialized unit execution, in-process inspection, and test evidence." }, { property: "og:title", content: "Shop floor — SSM One" }, { property: "og:description", content: "Controlled production execution and unit traceability." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
});

const sb = supabase as any;
const pretty = (value: string) => value.replaceAll("_", " ");

function ShopFloorPage() {
  const qc = useQueryClient();
  const [unit, setUnit] = useState<any | null>(null);
  const [mode, setMode] = useState<"execution" | "inspection" | "test">("execution");
  const { data: units = [], isLoading } = useQuery({ queryKey: ["production_units_shop_floor"], queryFn: async () => { const { data, error } = await sb.from("production_units").select("*, work_order:work_orders(work_order_number,product_name,status,route_id), current_step:production_route_steps(name,step_number)").order("created_at", { ascending: false }); if (error) throw error; return data as any[]; } });
  const stats = useMemo(() => ({ active: units.filter((item) => ["IN_PROCESS", "TESTING"].includes(item.unit_status)).length, hold: units.filter((item) => item.unit_status === "HOLD").length, passed: units.filter((item) => item.unit_status === "PASSED").length }), [units]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["production_units_shop_floor"] }); qc.invalidateQueries({ queryKey: ["work_orders"] }); };
  return <div className="space-y-4 p-4 md:p-6"><div className="flex items-center gap-2"><div className="flex-1"><h1 className="text-xl font-semibold">Shop floor</h1><p className="text-sm text-muted-foreground">Capture execution, inspection, and test evidence against serialized production units.</p></div></div><div className="grid gap-3 sm:grid-cols-3"><Stat label="Active units" value={stats.active} icon={<Play className="size-4" />} /><Stat label="On hold" value={stats.hold} icon={<ClipboardCheck className="size-4" />} /><Stat label="Passed test" value={stats.passed} icon={<CheckCircle2 className="size-4" />} /></div><Card className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Serial number</TableHead><TableHead>Work order</TableHead><TableHead>Current step</TableHead><TableHead>Unit status</TableHead><TableHead>Record</TableHead></TableRow></TableHeader><TableBody>{isLoading ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow> : units.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No serialized units are available yet.</TableCell></TableRow> : units.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.serial_number}</TableCell><TableCell><div>{item.work_order?.work_order_number ?? "—"}</div><div className="text-xs text-muted-foreground">{item.work_order?.product_name ?? ""}</div></TableCell><TableCell>{item.current_step ? `${item.current_step.step_number}. ${item.current_step.name}` : "Not started"}</TableCell><TableCell><Badge variant={item.unit_status === "FAILED" || item.unit_status === "SCRAPPED" ? "destructive" : "secondary"}>{pretty(item.unit_status)}</Badge></TableCell><TableCell><div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => { setMode("execution"); setUnit(item); }}>Execute</Button><Button size="sm" variant="outline" onClick={() => { setMode("inspection"); setUnit(item); }}>Inspect</Button><Button size="sm" onClick={() => { setMode("test"); setUnit(item); }}>Test</Button></div></TableCell></TableRow>)}</TableBody></Table></Card><RecordUnitDialog unit={unit} mode={mode} onOpenChange={(open) => { if (!open) setUnit(null); }} onSaved={() => { refresh(); setUnit(null); }} /></div>;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <Card className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className="mt-1 text-2xl font-semibold">{value}</p></Card>; }

function RecordUnitDialog({ unit, mode, onOpenChange, onSaved }: { unit: any | null; mode: "execution" | "inspection" | "test"; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [result, setResult] = useState("STARTED"); const [testType, setTestType] = useState("Functional test"); const [notes, setNotes] = useState("");
  const { data: steps = [] } = useQuery({ queryKey: ["production_steps", unit?.work_order_id], queryFn: async () => { if (!unit?.work_order_id) return []; const { data, error } = await sb.from("production_route_steps").select("id,name,step_number").eq("route_id", unit.work_order?.route_id ?? "").order("step_number"); if (error) throw error; return data as any[]; }, enabled: Boolean(unit) });
  const mutation = useMutation({ mutationFn: async () => { if (!unit) return; const stepId = unit.current_step_id ?? steps[0]?.id ?? null; if (mode === "execution") return recordPhase7UnitExecution({ data: { workOrderId: unit.work_order_id, unitId: unit.id, routeStepId: stepId, status: result as "STARTED" | "COMPLETED" | "HOLD" | "REWORK", notes } }); if (mode === "inspection") return recordPhase7UnitInspection({ data: { workOrderId: unit.work_order_id, unitId: unit.id, routeStepId: stepId, result: result as "PASS" | "HOLD" | "FAIL" | "REWORK", findings: notes } }); return recordPhase7UnitTest({ data: { workOrderId: unit.work_order_id, unitId: unit.id, testType, result: result as "PASS" | "FAIL" | "INCONCLUSIVE", notes } }); }, onSuccess: () => { toast.success(`${mode === "test" ? "Test" : mode === "inspection" ? "Inspection" : "Execution"} record saved`); setNotes(""); onSaved(); }, onError: (error: Error) => toast.error(error.message) });
  const title = mode === "execution" ? "Record shop-floor execution" : mode === "inspection" ? "Record in-process inspection" : "Record unit test"; const options = mode === "execution" ? ["STARTED", "COMPLETED", "HOLD", "REWORK"] : mode === "inspection" ? ["PASS", "HOLD", "FAIL", "REWORK"] : ["PASS", "FAIL", "INCONCLUSIVE"];
  return <Dialog open={Boolean(unit)} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{unit?.serial_number ?? ""}</DialogDescription></DialogHeader><div className="grid gap-4 py-2">{mode === "test" && <div className="grid gap-2"><Label>Test type</Label><Input value={testType} onChange={(event) => setTestType(event.target.value)} /></div>}<div className="grid gap-2"><Label>Result</Label><Select value={result} onValueChange={setResult}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem value={option} key={option}>{pretty(option)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Findings, evidence, or handover note" /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending || (mode === "test" && !testType.trim())} onClick={() => mutation.mutate()}><TestTube2 className="size-4" /> Save record</Button></DialogFooter></DialogContent></Dialog>;
}
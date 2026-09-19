import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/assignments")({
  head: () => ({ meta: [{ title: "Assignments — SSM One" }, { name: "description", content: "Component assignment and return tracking." }, { property: "og:title", content: "Assignments — SSM One" }, { property: "og:description", content: "Component assignment and return tracking." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [returning, setReturning] = useState<any | null>(null);
  const [retQty, setRetQty] = useState(0);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["assignments_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, component:components(*), assignee:rd_members(*), location:locations(*)")
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  async function returnRow(row: any, qty: number) {
    const newReturned = row.quantity_returned + qty;
    const newStatus = newReturned >= row.quantity ? "returned" : "partial";

    await supabase.from("assignments").update({
      quantity_returned: newReturned,
      status: newStatus,
      returned_at: newStatus === "returned" ? new Date().toISOString() : null,
    }).eq("id", row.id);

    if (row.location_id) {
      const { data: loc } = await supabase.from("locations").select("quantity").eq("id", row.location_id).single();
      if (loc) await supabase.from("locations").update({ quantity: loc.quantity + qty }).eq("id", row.location_id);
    }

    await supabase.from("stock_history").insert({
      component_id: row.component_id,
      location_id: row.location_id,
      delta: qty,
      action: "return",
      note: `Returned from ${row.assignee?.name}`,
      user_id: user?.id,
      user_email: user?.email,
    });
  }

  function refreshLists() {
    qc.invalidateQueries({ queryKey: ["assignments_all"] });
    qc.invalidateQueries({ queryKey: ["components"] });
  }

  async function handleReturn() {
    if (!returning) return;
    const remaining = returning.quantity - returning.quantity_returned;
    if (retQty <= 0 || retQty > remaining) return toast.error(`Return 1–${remaining}`);
    await returnRow(returning, retQty);
    toast.success(`Returned ${retQty} pcs`);
    setReturning(null);
    refreshLists();
  }

  async function handleReturnBundle(bundle: any[]) {
    const pending = bundle.filter((r) => r.quantity - r.quantity_returned > 0);
    for (const r of pending) await returnRow(r, r.quantity - r.quantity_returned);
    toast.success(`Returned all ${pending.length} item${pending.length === 1 ? "" : "s"} in the bundle`);
    refreshLists();
  }

  const open = rows.filter((r) => r.status !== "returned");
  const closed = rows.filter((r) => r.status === "returned");

  const bundles: { key: string; rows: any[] }[] = [];
  for (const r of open) {
    const key = r.batch_id ?? `single-${r.id}`;
    const found = bundles.find((b) => b.key === key);
    if (found) found.rows.push(r);
    else bundles.push({ key, rows: [r] });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Assignments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Parts currently out with the R&amp;D team.</p>
      </div>

      <div className="space-y-4">
        <div className="font-semibold">Open ({open.length})</div>
        {isLoading && <Card><div className="p-6 text-center text-muted-foreground">Loading…</div></Card>}
        {!isLoading && bundles.length === 0 && <Card><div className="p-6 text-center text-muted-foreground">Nothing out right now.</div></Card>}
        {bundles.map((b) => {
          const first = b.rows[0];
          const isBundle = b.rows.length > 1 || !!first.batch_id;
          return (
            <Card key={b.key}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
                <div className="text-sm">
                  <div className="font-medium">
                    {first.assignee?.name}
                    {first.project_name ? <span className="text-muted-foreground"> · {first.project_name}</span> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isBundle && first.batch_id ? <>Bundle #{String(first.batch_id).slice(0, 8)} · {b.rows.length} item{b.rows.length === 1 ? "" : "s"} · </> : null}
                    {format(new Date(first.assigned_at), "MMM d, p")}
                  </div>
                </div>
                {b.rows.length > 1 && (
                  <Button size="sm" variant="outline" onClick={() => handleReturnBundle(b.rows)}>Return all</Button>
                )}
              </div>
              <AssignTable rows={b.rows} isLoading={false} onReturn={(r) => { setReturning(r); setRetQty(r.quantity - r.quantity_returned); }} />
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="p-4 border-b font-semibold">History ({closed.length})</div>
        <AssignTable rows={closed} isLoading={isLoading} />
      </Card>

      <Dialog open={!!returning} onOpenChange={(o) => !o && setReturning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return parts</DialogTitle>
          </DialogHeader>
          {returning && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{returning.component?.name}</strong> assigned to{" "}
                <strong>{returning.assignee?.name}</strong>.<br />
                Outstanding: {returning.quantity - returning.quantity_returned} of {returning.quantity}
              </p>
              <Input type="number" min={1} max={returning.quantity - returning.quantity_returned} value={retQty} onChange={(e) => setRetQty(Number(e.target.value))} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturning(null)}>Cancel</Button>
            <Button onClick={handleReturn}>Confirm return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssignTable({ rows, isLoading, onReturn }: { rows: any[]; isLoading: boolean; onReturn?: (r: any) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Component</TableHead>
          <TableHead>Assignee</TableHead>
          <TableHead>Project</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Returned</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>When</TableHead>
          {onReturn && <TableHead></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>}
        {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Nothing here.</TableCell></TableRow>}
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <div className="font-medium">{r.component?.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{r.component?.part_number}</div>
            </TableCell>
            <TableCell>{r.assignee?.name}<div className="text-xs text-muted-foreground">{r.assignee?.email}</div></TableCell>
            <TableCell>{r.project_name ?? "—"}</TableCell>
            <TableCell className="text-right font-semibold">{r.quantity}</TableCell>
            <TableCell className="text-right">{r.quantity_returned}</TableCell>
            <TableCell>
              {r.status === "returned" && <Badge className="bg-success text-success-foreground">Returned</Badge>}
              {r.status === "partial" && <Badge className="bg-warning text-warning-foreground">Partial</Badge>}
              {r.status === "assigned" && <Badge>Out</Badge>}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{format(new Date(r.assigned_at), "MMM d, p")}</TableCell>
            {onReturn && (
              <TableCell><Button size="sm" variant="outline" onClick={() => onReturn(r)}>Return</Button></TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

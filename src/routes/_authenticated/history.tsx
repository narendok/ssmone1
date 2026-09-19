import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Minus, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_history")
        .select("*, component:components(name,part_number), location:locations(label,location_type)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Activity log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Latest stock changes and assignments.</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Component</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Δ</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No activity yet.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(r.created_at), "MMM d, p")}</TableCell>
                <TableCell><ActionTag action={r.action} /></TableCell>
                <TableCell>
                  <div className="font-medium">{r.component?.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.component?.part_number}</div>
                </TableCell>
                <TableCell className="text-sm">{r.location ? `${r.location.location_type} — ${r.location.label}` : "—"}</TableCell>
                <TableCell className={`text-right font-mono font-semibold ${r.delta > 0 ? "text-success" : "text-destructive"}`}>
                  {r.delta > 0 ? "+" : ""}{r.delta}
                </TableCell>
                <TableCell className="text-xs">{r.user_email ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{r.note ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function ActionTag({ action }: { action: string }) {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    add: { label: "Added", cls: "bg-success/15 text-success", Icon: Plus },
    remove: { label: "Removed", cls: "bg-destructive/15 text-destructive", Icon: Minus },
    assign: { label: "Assigned", cls: "bg-primary/15 text-primary", Icon: ArrowRight },
    return: { label: "Returned", cls: "bg-accent text-accent-foreground", Icon: ArrowLeft },
  };
  const m = map[action] ?? { label: action, cls: "bg-muted", Icon: Plus };
  const I = m.Icon;
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${m.cls}`}><I className="h-3 w-3" /> {m.label}</span>;
}

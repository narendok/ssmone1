import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, ShoppingCart, PackageCheck, IndianRupee, AlarmClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreatePODialog, type PoDraftLine } from "@/components/procurement/CreatePODialog";
import { PODetailView } from "@/components/procurement/PODetailView";
import { CreateGRNDialog } from "@/components/procurement/CreateGRNDialog";
import {
  fetchPurchaseOrders,
  inr,
  isOverdue,
  PO_STATUSES,
  poPendingQty,
  statusLabel,
  statusVariant,
  type PurchaseOrder,
} from "@/lib/procurement";

export const Route = createFileRoute("/_authenticated/procurement/orders")({
  component: OrdersPage,
  head: () => ({
    meta: [
      { title: "Purchase orders — PartsBench procurement" },
      { name: "description", content: "Raise purchase orders from stock shortages, track open and overdue deliveries, and print vendor-ready POs." },
      { property: "og:title", content: "Purchase orders — PartsBench procurement" },
      { property: "og:description", content: "Create, send and track component purchase orders with GST totals in Indian rupees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function OrdersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [prefill, setPrefill] = useState<PoDraftLine[] | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [grnFor, setGrnFor] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({ queryKey: ["purchase_orders"], queryFn: fetchPurchaseOrders });

  const stats = useMemo(() => {
    const open = orders.filter((o) => o.status === "DRAFT" || o.status === "SENT" || o.status === "PARTIALLY_RECEIVED");
    const pendingInward = orders.filter((o) => o.status === "SENT" || o.status === "PARTIALLY_RECEIVED");
    const value = open.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    const overdue = orders.filter(isOverdue);
    return { open: open.length, pendingInward: pendingInward.length, value, overdue: overdue.length };
  }, [orders]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (pendingOnly && poPendingQty(o) <= 0) return false;
      if (s && !(o.po_number.toLowerCase().includes(s) || (o.vendor?.name ?? "").toLowerCase().includes(s))) return false;
      const d = o.created_at.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [orders, q, status, from, to, pendingOnly]);

  const detail = useMemo(() => orders.find((o) => o.id === detailId) ?? null, [orders, detailId]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold flex-1">Purchase orders</h1>
        <Button onClick={() => { setPrefill(undefined); setCreating(true); }}>
          <Plus className="h-4 w-4" /> Create purchase order
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<ShoppingCart className="h-4 w-4" />} label="Open POs" value={String(stats.open)} />
        <StatCard icon={<PackageCheck className="h-4 w-4" />} label="Pending inwarding" value={String(stats.pendingInward)} />
        <StatCard icon={<IndianRupee className="h-4 w-4" />} label="Total ordered value" value={inr(stats.value)} />
        <StatCard icon={<AlarmClock className="h-4 w-4" />} label="Overdue deliveries" value={String(stats.overdue)} danger={stats.overdue > 0} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search PO number or vendor…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PO_STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        <Button variant={pendingOnly ? "default" : "outline"} onClick={() => setPendingOnly((v) => !v)}>
          Has pending items
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO number</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead className="text-right">Pending units</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No purchase orders match these filters</TableCell></TableRow>
            )}
            {rows.map((o) => (
              <TableRow key={o.id} className="cursor-pointer" onClick={() => setDetailId(o.id)}>
                <TableCell className="font-medium">{o.po_number}</TableCell>
                <TableCell>{o.vendor?.name ?? "—"}</TableCell>
                <TableCell><Badge variant={statusVariant(o.status)}>{statusLabel(o.status)}</Badge></TableCell>
                <TableCell className="text-right">{o.items?.length ?? 0}</TableCell>
                <TableCell className="text-right">{poPendingQty(o) || "—"}</TableCell>
                <TableCell className="text-right">{inr(o.total_amount)}</TableCell>
                <TableCell className={isOverdue(o) ? "text-destructive font-medium" : ""}>{o.expected_delivery_date ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("en-IN")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CreatePODialog open={creating} onOpenChange={setCreating} prefill={prefill} />
      <PODetailView
        po={detail}
        onOpenChange={(v) => !v && setDetailId(null)}
        onReceive={(po) => { setDetailId(null); setGrnFor(po.id); }}
      />
      <CreateGRNDialog open={!!grnFor} onOpenChange={(v) => !v && setGrnFor(null)} poId={grnFor} />
    </div>
  );
}

function StatCard({ icon, label, value, danger }: { icon: React.ReactNode; label: string; value: string; danger?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">{icon}<span>{label}</span></div>
      <div className={`mt-1 text-2xl font-semibold ${danger ? "text-destructive" : ""}`}>{value}</div>
    </Card>
  );
}

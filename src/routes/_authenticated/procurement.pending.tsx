import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, Download, PackageSearch, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchGrns,
  fetchPurchaseOrders,
  inr,
  pendingLines,
  rejectedLines,
} from "@/lib/procurement";

export const Route = createFileRoute("/_authenticated/procurement/pending")({
  component: PendingDeliveriesPage,
  head: () => ({
    meta: [
      { title: "Pending deliveries | PartsBench" },
      { name: "description", content: "Every part still owed by vendors across open purchase orders, with overdue alerts and rejections." },
      { property: "og:title", content: "Pending deliveries | PartsBench" },
      { property: "og:description", content: "Track undelivered purchase order lines, overdue shipments and rejected goods in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PendingDeliveriesPage() {
  const { data: orders = [] } = useQuery({ queryKey: ["purchase_orders"], queryFn: fetchPurchaseOrders });
  const { data: grns = [] } = useQuery({ queryKey: ["grns"], queryFn: fetchGrns });

  const [search, setSearch] = useState("");
  const [vendor, setVendor] = useState("all");

  const lines = useMemo(() => pendingLines(orders), [orders]);
  const rejections = useMemo(() => rejectedLines(grns), [grns]);

  const vendors = useMemo(() => {
    const set = new Map<string, string>();
    lines.forEach((l) => l.po.vendor && set.set(l.po.vendor.id, l.po.vendor.name));
    return [...set.entries()];
  }, [lines]);

  const filtered = useMemo(
    () =>
      lines.filter((l) => {
        if (vendor !== "all" && l.po.vendor_id !== vendor) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          l.item.mpn.toLowerCase().includes(q) ||
          (l.item.description ?? "").toLowerCase().includes(q) ||
          l.po.po_number.toLowerCase().includes(q) ||
          (l.po.vendor?.name ?? "").toLowerCase().includes(q)
        );
      }),
    [lines, vendor, search],
  );

  const overdueCount = filtered.filter((l) => l.overdue).length;
  const pendingUnits = filtered.reduce((s, l) => s + l.pending, 0);
  const pendingValue = filtered.reduce((s, l) => s + l.pending * l.item.unit_cost, 0);

  function exportCsv() {
    const header = ["PO", "Vendor", "MPN", "Description", "Ordered", "Received", "Rejected", "Pending", "Unit cost", "Pending value", "Expected", "Overdue"];
    const rows = filtered.map((l) => [
      l.po.po_number,
      l.po.vendor?.name ?? "",
      l.item.mpn,
      l.item.description ?? "",
      l.item.quantity_ordered,
      l.item.quantity_received,
      l.item.quantity_rejected,
      l.pending,
      l.item.unit_cost,
      l.pending * l.item.unit_cost,
      l.po.expected_delivery_date ?? "",
      l.overdue ? "YES" : "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pending-deliveries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pending deliveries</h1>
          <p className="text-sm text-muted-foreground">Everything still owed by vendors, oldest promise date first.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><PackageSearch className="h-3.5 w-3.5" /> Open lines</div>
          <div className="text-2xl font-semibold">{filtered.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Units pending</div>
          <div className="text-2xl font-semibold">{pendingUnits}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Value pending</div>
          <div className="text-2xl font-semibold">{inr(pendingValue)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><AlarmClock className="h-3.5 w-3.5" /> Overdue lines</div>
          <div className={`text-2xl font-semibold ${overdueCount ? "text-destructive" : ""}`}>{overdueCount}</div>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({filtered.length})</TabsTrigger>
          <TabsTrigger value="rejections">Rejections ({rejections.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="Search part, PO or vendor" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={vendor} onValueChange={setVendor}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vendors</SelectItem>
                {vendors.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Purchase order</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead>Expected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nothing pending — every order is fully delivered.</TableCell></TableRow>
                )}
                {filtered.map((l) => (
                  <TableRow key={l.item.id} className={l.overdue ? "bg-destructive/5" : undefined}>
                    <TableCell>
                      <div className="font-medium">{l.item.mpn}</div>
                      <div className="text-xs text-muted-foreground">{l.item.description ?? l.item.component?.name ?? ""}</div>
                    </TableCell>
                    <TableCell>{l.po.po_number}</TableCell>
                    <TableCell>{l.po.vendor?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">{l.item.quantity_ordered}</TableCell>
                    <TableCell className="text-right">
                      {l.item.quantity_received}
                      {l.item.quantity_rejected > 0 && <span className="text-destructive text-xs"> · {l.item.quantity_rejected} rejected</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">{l.pending}</TableCell>
                    <TableCell>
                      {l.po.expected_delivery_date ?? "—"}
                      {l.overdue && <Badge variant="destructive" className="ml-2">Overdue</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="rejections">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Purchase order</TableHead>
                  <TableHead className="text-right">Rejected</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejections.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No rejected goods recorded.</TableCell></TableRow>
                )}
                {rejections.map(({ grn, item }) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.component?.part_number ?? item.component?.name ?? "—"}</TableCell>
                    <TableCell>{grn.grn_number}</TableCell>
                    <TableCell>{grn.po?.po_number ?? "—"}</TableCell>
                    <TableCell className="text-right text-destructive font-medium">{item.quantity_rejected}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5 text-destructive" />{item.rejection_reason ?? "—"}</div>
                      {item.rejection_note && <div className="text-xs text-muted-foreground">{item.rejection_note}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

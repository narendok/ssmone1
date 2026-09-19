import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VendorDialog } from "@/components/procurement/VendorDialog";
import { fetchPurchaseOrders, fetchVendors, type Vendor } from "@/lib/procurement";

export const Route = createFileRoute("/_authenticated/procurement/vendors")({
  component: VendorsPage,
  head: () => ({
    meta: [
      { title: "Vendors — PartsBench procurement" },
      { name: "description", content: "Manage component suppliers: contacts, GSTIN, payment terms and open purchase orders per vendor." },
      { property: "og:title", content: "Vendors — PartsBench procurement" },
      { property: "og:description", content: "Supplier directory with contacts, GSTIN, payment terms and active purchase order counts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function VendorsPage() {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [open, setOpen] = useState(false);

  const { data: vendors = [], isLoading, refetch } = useQuery({ queryKey: ["vendors"], queryFn: fetchVendors });
  const { data: orders = [] } = useQuery({ queryKey: ["purchase_orders"], queryFn: fetchPurchaseOrders });

  const activeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) {
      if (o.status === "RECEIVED" || o.status === "CANCELLED" || !o.vendor_id) continue;
      m.set(o.vendor_id, (m.get(o.vendor_id) ?? 0) + 1);
    }
    return m;
  }, [orders]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vendors;
    return vendors.filter((v) =>
      [v.name, v.contact_person, v.email, v.phone, v.gstin].some((f) => (f ?? "").toLowerCase().includes(s)),
    );
  }, [vendors, q]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold flex-1">Vendors</h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Add vendor
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search vendors…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Payment terms</TableHead>
              <TableHead className="text-right">Active POs</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No vendors yet</TableCell></TableRow>
            )}
            {rows.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  {v.name}{" "}
                  {!v.is_active && <Badge variant="outline" className="ml-1">Inactive</Badge>}
                </TableCell>
                <TableCell>{v.contact_person ?? "—"}</TableCell>
                <TableCell>{v.phone ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{v.email ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{v.gstin ?? "—"}</TableCell>
                <TableCell>{v.payment_terms}</TableCell>
                <TableCell className="text-right">{activeCounts.get(v.id) ?? 0}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(v); setOpen(true); }}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <VendorDialog open={open} onOpenChange={setOpen} vendor={editing} onSaved={() => refetch()} />
    </div>
  );
}

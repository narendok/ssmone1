import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateGRNDialog } from "@/components/procurement/CreateGRNDialog";
import { fetchGrns } from "@/lib/procurement";

export const Route = createFileRoute("/_authenticated/procurement/inward")({
  component: InwardPage,
  head: () => ({
    meta: [
      { title: "Inwarding (GRN) — PartsBench procurement" },
      { name: "description", content: "Receive purchase order shipments against vendor invoices and push the quantities straight into basement store stock." },
      { property: "og:title", content: "Inwarding (GRN) — PartsBench procurement" },
      { property: "og:description", content: "Goods receipt notes that update component stock and the activity log automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function InwardPage() {
  const [open, setOpen] = useState(false);
  const { data: grns = [], isLoading } = useQuery({ queryKey: ["grns"], queryFn: fetchGrns });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold flex-1">Material inwarding</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New goods receipt note</Button>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GRN</TableHead>
              <TableHead>PO</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Received items</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && grns.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nothing received yet</TableCell></TableRow>
            )}
            {grns.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.grn_number}</TableCell>
                <TableCell>{g.po?.po_number ?? "—"}</TableCell>
                <TableCell>{g.po?.vendor?.name ?? "—"}</TableCell>
                <TableCell>
                  {g.vendor_invoice_number}
                  {g.vendor_invoice_date && <div className="text-xs text-muted-foreground">{g.vendor_invoice_date}</div>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(g.items ?? []).map((i) => (
                      <Badge key={i.id} variant="secondary" className="font-normal">
                        {i.component?.part_number ?? "part"} ×{i.quantity_received}
                        {i.location ? ` → ${i.location.label}` : ""}
                      </Badge>
                    ))}
                  </div>
                  {g.storage_location_notes && (
                    <div className="text-xs text-muted-foreground mt-1">{g.storage_location_notes}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {(g.items ?? []).reduce((s, i) => s + i.quantity_received, 0)}
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(g.created_at).toLocaleDateString("en-IN")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CreateGRNDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

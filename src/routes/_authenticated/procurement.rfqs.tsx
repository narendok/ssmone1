import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createQuotation, createRfq, reviewPhase6Record } from "@/lib/phase6.functions";
import { fetchVendors, inr, type Vendor } from "@/lib/procurement";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/procurement/rfqs")({
  component: RfqsPage,
  head: () => ({
    meta: [
      { title: "RFQs and quotations — SSM One" },
      { name: "description", content: "Invite suppliers, record quotations, and confirm commercial decisions with traceable purchasing controls." },
      { property: "og:title", content: "RFQs and quotations — SSM One" },
      { property: "og:description", content: "Manage supplier RFQs and quotation review decisions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const sb = supabase as any;
type Rfq = { id: string; rfq_number: string; status: string; response_due_date: string | null; terms: string | null; created_at: string; purchase_request?: { request_number: string } | null; vendors?: { id: string; vendor_id: string; status: string; vendor?: { name: string } | null }[] };
type Quotation = { id: string; quotation_number: string; status: string; quoted_at: string | null; valid_until: string | null; lead_time_days: number | null; vendor?: { name: string } | null; rfq?: { rfq_number: string } | null; items?: { quantity: number; unit_price: number }[] };
type QuoteLine = { mpn: string; description: string; quantity: number; unit_price: number; moq: string; lead_time_days: string; notes: string };

function RfqsPage() {
  const [rfqOpen, setRfqOpen] = useState(false);
  const [quoteFor, setQuoteFor] = useState<Rfq | null>(null);
  const qc = useQueryClient();
  const { data: rfqs = [], isLoading: rfqsLoading } = useQuery({ queryKey: ["rfqs"], queryFn: async () => {
    const { data, error } = await sb.from("rfqs").select("*, purchase_request:purchase_requests(request_number), vendors:rfq_vendors(id,vendor_id,status,vendor:vendors(name))").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Rfq[];
  } });
  const { data: quotations = [], isLoading: quotationsLoading } = useQuery({ queryKey: ["quotations"], queryFn: async () => {
    const { data, error } = await sb.from("quotations").select("*, vendor:vendors(name), rfq:rfqs(rfq_number), items:quotation_items(quantity,unit_price)").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Quotation[];
  } });
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) => reviewPhase6Record({ data: { recordType: "quotation", recordId: id, decision } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotations"] }); toast.success("Quotation decision recorded"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const totals = useMemo(() => ({
    awaiting: quotations.filter((quote) => quote.status === "NEEDS_REVIEW").length,
    confirmed: quotations.filter((quote) => quote.status === "CONFIRMED").length,
  }), [quotations]);

  return <div className="space-y-4 p-4 md:p-6">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex-1"><h1 className="text-xl font-semibold">RFQs and quotations</h1><p className="text-sm text-muted-foreground">Invite suppliers, capture responses, and confirm commercial decisions.</p></div>
      <Button onClick={() => setRfqOpen(true)}><Plus className="h-4 w-4" /> New RFQ</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3"><Stat label="Open RFQs" value={rfqs.filter((rfq) => !["CLOSED", "CANCELLED"].includes(rfq.status)).length} /><Stat label="Quotations awaiting review" value={totals.awaiting} /><Stat label="Confirmed quotations" value={totals.confirmed} /></div>
    <Card className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>RFQ</TableHead><TableHead>Purchase request</TableHead><TableHead>Suppliers</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>
      {rfqsLoading ? <LoadingRow span={6} /> : rfqs.length === 0 ? <EmptyRow span={6} label="No RFQs recorded" /> : rfqs.map((rfq) => <TableRow key={rfq.id}><TableCell className="font-medium">{rfq.rfq_number}</TableCell><TableCell>{rfq.purchase_request?.request_number ?? "—"}</TableCell><TableCell>{rfq.vendors?.map((entry) => entry.vendor?.name ?? "Supplier").join(", ") || "—"}</TableCell><TableCell>{rfq.response_due_date ?? "—"}</TableCell><TableCell><Badge variant="secondary">{label(rfq.status)}</Badge></TableCell><TableCell><Button size="sm" variant="outline" onClick={() => setQuoteFor(rfq)}><FileText className="h-4 w-4" /> Record quotation</Button></TableCell></TableRow>)}
    </TableBody></Table></Card>
    <div className="pt-2"><h2 className="text-lg font-semibold">Supplier quotations</h2><p className="text-sm text-muted-foreground">Line totals support a quick commercial comparison before confirmation.</p></div>
    <Card className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Quotation</TableHead><TableHead>Supplier</TableHead><TableHead>RFQ</TableHead><TableHead>Value</TableHead><TableHead>Valid until</TableHead><TableHead>Status</TableHead><TableHead>Decision</TableHead></TableRow></TableHeader><TableBody>
      {quotationsLoading ? <LoadingRow span={7} /> : quotations.length === 0 ? <EmptyRow span={7} label="No supplier quotations recorded" /> : quotations.map((quote) => { const value = quote.items?.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0) ?? 0; const done = ["CONFIRMED", "REJECTED", "EXPIRED"].includes(quote.status); return <TableRow key={quote.id}><TableCell className="font-medium">{quote.quotation_number}</TableCell><TableCell>{quote.vendor?.name ?? "—"}</TableCell><TableCell>{quote.rfq?.rfq_number ?? "Direct"}</TableCell><TableCell>{inr(value)}</TableCell><TableCell>{quote.valid_until ?? "—"}</TableCell><TableCell><Badge variant={quote.status === "REJECTED" ? "destructive" : "secondary"}>{label(quote.status)}</Badge></TableCell><TableCell className="flex gap-2"><Button size="sm" variant="outline" disabled={done || review.isPending} onClick={() => review.mutate({ id: quote.id, decision: "CONFIRMED" })}><Check className="h-4 w-4" /> Confirm</Button><Button size="sm" variant="ghost" disabled={done || review.isPending} onClick={() => review.mutate({ id: quote.id, decision: "REJECTED" })}>Reject</Button></TableCell></TableRow>; })}
    </TableBody></Table></Card>
    <CreateRfqDialog open={rfqOpen} onOpenChange={setRfqOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["rfqs"] })} />
    <CreateQuotationDialog rfq={quoteFor} onOpenChange={(open) => { if (!open) setQuoteFor(null); }} onCreated={() => qc.invalidateQueries({ queryKey: ["quotations"] })} />
  </div>;
}

function CreateRfqDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [requestId, setRequestId] = useState(""); const [dueDate, setDueDate] = useState(""); const [terms, setTerms] = useState(""); const [vendorIds, setVendorIds] = useState<string[]>([]);
  const { data: requests = [] } = useQuery({ queryKey: ["approved_purchase_requests"], queryFn: async () => { const { data, error } = await sb.from("purchase_requests").select("id,request_number").eq("status", "APPROVED").order("created_at", { ascending: false }); if (error) throw error; return data as { id: string; request_number: string }[]; } });
  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: fetchVendors });
  const mutation = useMutation({ mutationFn: () => createRfq({ data: { purchaseRequestId: requestId || null, responseDueDate: dueDate || null, terms: terms || null, vendorIds } }), onSuccess: () => { toast.success("RFQ created"); onCreated(); onOpenChange(false); setRequestId(""); setDueDate(""); setTerms(""); setVendorIds([]); }, onError: (error: Error) => toast.error(error.message) });
  const toggleVendor = (id: string) => setVendorIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>New RFQ</DialogTitle><DialogDescription>Link approved demand and invite one or more active suppliers.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>Approved purchase request</Label><Select value={requestId || "__none"} onValueChange={(value) => setRequestId(value === "__none" ? "" : value)}><SelectTrigger><SelectValue placeholder="Optional request" /></SelectTrigger><SelectContent><SelectItem value="__none">No linked request</SelectItem>{requests.map((request) => <SelectItem key={request.id} value={request.id}>{request.request_number}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Response due date</Label><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div><div className="grid gap-2"><Label>Invited suppliers</Label><div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border p-3">{vendors.filter((vendor) => vendor.is_active).map((vendor) => <label key={vendor.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={vendorIds.includes(vendor.id)} onChange={() => toggleVendor(vendor.id)} />{vendor.name}</label>)}{vendors.length === 0 && <p className="text-sm text-muted-foreground">No active suppliers available.</p>}</div></div><div className="grid gap-2"><Label>Terms</Label><Textarea value={terms} onChange={(event) => setTerms(event.target.value)} placeholder="Commercial, technical, and delivery requirements" /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}><Send className="h-4 w-4" /> Create RFQ</Button></DialogFooter></DialogContent></Dialog>;
}

function CreateQuotationDialog({ rfq, onOpenChange, onCreated }: { rfq: Rfq | null; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [vendorId, setVendorId] = useState(""); const [quotedAt, setQuotedAt] = useState(""); const [validUntil, setValidUntil] = useState(""); const [leadTimeDays, setLeadTimeDays] = useState(""); const [paymentTerms, setPaymentTerms] = useState(""); const [lines, setLines] = useState<QuoteLine[]>([{ mpn: "", description: "", quantity: 1, unit_price: 0, moq: "", lead_time_days: "", notes: "" }]);
  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: fetchVendors });
  const allowedVendors = useMemo(() => { const invited = rfq?.vendors?.map((entry) => entry.vendor_id) ?? []; return invited.length ? vendors.filter((vendor) => invited.includes(vendor.id)) : vendors; }, [rfq, vendors]);
  const mutation = useMutation({ mutationFn: () => createQuotation({ data: { rfqId: rfq?.id ?? null, vendorId, quotedAt: quotedAt || null, validUntil: validUntil || null, leadTimeDays: leadTimeDays ? Number(leadTimeDays) : null, paymentTerms: paymentTerms || null, items: lines.map((line) => ({ mpn: line.mpn || null, description: line.description || null, quantity: Number(line.quantity), unit_price: Number(line.unit_price), moq: line.moq ? Number(line.moq) : null, lead_time_days: line.lead_time_days ? Number(line.lead_time_days) : null, notes: line.notes || null })) } }), onSuccess: () => { toast.success("Supplier quotation recorded for review"); onCreated(); onOpenChange(false); }, onError: (error: Error) => toast.error(error.message) });
  const update = (index: number, patch: Partial<QuoteLine>) => setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  return <Dialog open={Boolean(rfq)} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Record supplier quotation</DialogTitle><DialogDescription>{rfq ? `Response for ${rfq.rfq_number}` : ""}</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-3"><div className="grid gap-2 sm:col-span-2"><Label>Supplier</Label><Select value={vendorId} onValueChange={setVendorId}><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{allowedVendors.map((vendor: Vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Quoted on</Label><Input type="date" value={quotedAt} onChange={(event) => setQuotedAt(event.target.value)} /></div><div className="grid gap-2"><Label>Valid until</Label><Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></div><div className="grid gap-2"><Label>Overall lead time (days)</Label><Input type="number" min="0" value={leadTimeDays} onChange={(event) => setLeadTimeDays(event.target.value)} /></div><div className="grid gap-2"><Label>Payment terms</Label><Input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} placeholder="e.g. 30 days net" /></div></div><div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>MPN</TableHead><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>Unit price</TableHead><TableHead>MOQ</TableHead><TableHead>Lead days</TableHead><TableHead /></TableRow></TableHeader><TableBody>{lines.map((line, index) => <TableRow key={index}><TableCell><Input value={line.mpn} onChange={(event) => update(index, { mpn: event.target.value })} /></TableCell><TableCell><Input value={line.description} onChange={(event) => update(index, { description: event.target.value })} /></TableCell><TableCell><Input type="number" min="1" value={line.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} /></TableCell><TableCell><Input type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => update(index, { unit_price: Number(event.target.value) })} /></TableCell><TableCell><Input type="number" min="1" value={line.moq} onChange={(event) => update(index, { moq: event.target.value })} /></TableCell><TableCell><Input type="number" min="0" value={line.lead_time_days} onChange={(event) => update(index, { lead_time_days: event.target.value })} /></TableCell><TableCell><Button size="icon" variant="ghost" aria-label="Remove quotation line" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>)}</TableBody></Table></div><Button variant="outline" onClick={() => setLines((current) => [...current, { mpn: "", description: "", quantity: 1, unit_price: 0, moq: "", lead_time_days: "", notes: "" }])}><Plus className="h-4 w-4" /> Add line</Button><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}><Send className="h-4 w-4" /> Save quotation</Button></DialogFooter></DialogContent></Dialog>;
}

function Stat({ label: text, value }: { label: string; value: number }) { return <Card className="p-4"><p className="text-sm text-muted-foreground">{text}</p><p className="mt-1 text-2xl font-semibold">{value}</p></Card>; }
function label(value: string) { return value.replaceAll("_", " "); }
function LoadingRow({ span }: { span: number }) { return <TableRow><TableCell colSpan={span} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>; }
function EmptyRow({ span, label: text }: { span: number; label: string }) { return <TableRow><TableCell colSpan={span} className="py-10 text-center text-muted-foreground">{text}</TableCell></TableRow>; }
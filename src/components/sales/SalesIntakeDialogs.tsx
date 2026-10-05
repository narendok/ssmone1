import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createSalesEnquiry, createSalesOpportunity } from "@/lib/sales.functions";
import type { SalesContact, SalesCustomer, SalesEnquiry } from "@/lib/sales";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NONE = "none";
const refresh = (queryClient: ReturnType<typeof useQueryClient>) => queryClient.invalidateQueries({ queryKey: ["sales_overview"] });

export function EnquiryDialog({ open, onOpenChange, customers, contacts }: { open: boolean; onOpenChange: (open: boolean) => void; customers: SalesCustomer[]; contacts: SalesContact[] }) {
  const create = useServerFn(createSalesEnquiry);
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState(NONE);
  const [contactId, setContactId] = useState(NONE);
  const [source, setSource] = useState<"manual" | "website" | "email" | "gmail" | "referral" | "existing_customer" | "marketing" | "other">("manual");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const contactsForCustomer = useMemo(() => contacts.filter((contact) => customerId === NONE || contact.customer_id === customerId), [contacts, customerId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const requirementSummary = String(form.get("requirementSummary") ?? "").trim();
    if (requirementSummary.length < 3) return toast.error("Add a concise requirement summary.");
    try {
      await create({ data: { enquiryNumber: null, customerId: customerId === NONE ? null : customerId, contactId: contactId === NONE ? null : contactId, source, enquiryDate: String(form.get("enquiryDate")), requirementSummary, application: blank(form, "application"), productType: blank(form, "productFamily"), estimatedVolume: blank(form, "estimatedVolume"), expectedTimeline: blank(form, "expectedTimeline"), priority, salesOwnerUserId: null, nextAction: blank(form, "nextAction"), nextActionDate: blank(form, "nextActionDate") } });
      await refresh(queryClient); toast.success("Enquiry created"); onOpenChange(false);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not create enquiry."); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>New enquiry</DialogTitle><DialogDescription>Capture an initial customer need. This does not create or commit a project.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => void submit(event)}><div className="grid gap-3 sm:grid-cols-2"><FieldSelect label="Customer" value={customerId} onValueChange={(value) => { setCustomerId(value); setContactId(NONE); }} options={[{ value: NONE, label: "Unknown / not linked yet" }, ...customers.map((customer) => ({ value: customer.id, label: `${customer.customer_code} · ${customer.legal_name}` }))]} /><FieldSelect label="Contact" value={contactId} onValueChange={setContactId} options={[{ value: NONE, label: "Unknown / not linked yet" }, ...contactsForCustomer.map((contact) => ({ value: contact.id, label: contact.full_name }))]} /></div><div className="grid gap-3 sm:grid-cols-3"><FieldSelect label="Source" value={source} onValueChange={(value) => setSource(value as typeof source)} options={["manual", "website", "email", "gmail", "referral", "existing_customer", "marketing", "other"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} /><FieldSelect label="Priority" value={priority} onValueChange={(value) => setPriority(value as typeof priority)} options={["low", "medium", "high", "urgent"].map((value) => ({ value, label: value }))} /><div><Label>Enquiry date</Label><Input name="enquiryDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div></div><div><Label>Requirement summary</Label><Textarea name="requirementSummary" maxLength={4000} required placeholder="What is being requested? Use Unknown or To be confirmed where details are not available." /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Industry / application</Label><Input name="application" maxLength={240} placeholder="Unknown / To be confirmed" /></div><div><Label>Product family</Label><Input name="productFamily" maxLength={240} placeholder="Distinct from delivery project type" /></div><div><Label>Estimated volume</Label><Input name="estimatedVolume" maxLength={240} placeholder="Unknown / To be confirmed" /></div><div><Label>Expected timeline</Label><Input name="expectedTimeline" maxLength={240} placeholder="Unknown / To be confirmed" /></div></div><div><Label>Next action</Label><Input name="nextAction" maxLength={1000} placeholder="Optional" /></div><div><Label>Next action date</Label><Input name="nextActionDate" type="date" /></div><DialogFooter><Button type="submit">Create enquiry</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function OpportunityDialog({ open, onOpenChange, customers, contacts, enquiries }: { open: boolean; onOpenChange: (open: boolean) => void; customers: SalesCustomer[]; contacts: SalesContact[]; enquiries: SalesEnquiry[] }) {
  const create = useServerFn(createSalesOpportunity);
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState(""); const [contactId, setContactId] = useState(NONE); const [enquiryId, setEnquiryId] = useState(NONE); const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium"); const [ndaRequired, setNdaRequired] = useState(false);
  const contactsForCustomer = useMemo(() => contacts.filter((contact) => contact.customer_id === customerId), [contacts, customerId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get("name") ?? "").trim();
    if (!customerId) return toast.error("Select a customer."); if (name.length < 3) return toast.error("Enter a proposed project name.");
    try {
      await create({ data: { opportunityNumber: null, customerId, contactId: contactId === NONE ? null : contactId, enquiryId: enquiryId === NONE ? null : enquiryId, name, application: blank(form, "application"), productType: blank(form, "productFamily"), primarySalesOwnerUserId: null, ndaRequired, estimatedVolume: blank(form, "estimatedVolume"), targetTimeline: blank(form, "targetTimeline"), priority, nextAction: blank(form, "nextAction"), nextActionDate: blank(form, "nextActionDate") } });
      await refresh(queryClient); toast.success("Proposed project saved as an opportunity"); onOpenChange(false);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not create opportunity."); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>New proposed project</DialogTitle><DialogDescription>This is a sales opportunity, not a committed development project or customer confirmation.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => void submit(event)}><div className="grid gap-3 sm:grid-cols-2"><FieldSelect label="Customer" required value={customerId} onValueChange={(value) => { setCustomerId(value); setContactId(NONE); }} placeholder="Select customer" options={customers.map((customer) => ({ value: customer.id, label: `${customer.customer_code} · ${customer.legal_name}` }))} /><FieldSelect label="Contact" value={contactId} onValueChange={setContactId} options={[{ value: NONE, label: "Unknown / not linked yet" }, ...contactsForCustomer.map((contact) => ({ value: contact.id, label: contact.full_name }))]} /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Proposed name</Label><Input name="name" required maxLength={240} placeholder="Possible / proposed project name" /></div><FieldSelect label="Source enquiry" value={enquiryId} onValueChange={setEnquiryId} options={[{ value: NONE, label: "No linked enquiry" }, ...enquiries.filter((enquiry) => !customerId || enquiry.customer?.id === customerId).map((enquiry) => ({ value: enquiry.id, label: `${enquiry.enquiry_number} · ${enquiry.requirement_summary.slice(0, 48)}` }))]} /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Industry / application</Label><Input name="application" maxLength={240} placeholder="Unknown / To be confirmed" /></div><div><Label>Product family</Label><Input name="productFamily" maxLength={240} placeholder="Not a delivery project type" /></div><div><Label>Estimated volume</Label><Input name="estimatedVolume" maxLength={240} placeholder="Unknown / To be confirmed" /></div><div><Label>Target timeline</Label><Input name="targetTimeline" maxLength={240} placeholder="Unknown / To be confirmed" /></div></div><div className="grid gap-3 sm:grid-cols-3"><FieldSelect label="Priority" value={priority} onValueChange={(value) => setPriority(value as typeof priority)} options={["low", "medium", "high", "urgent"].map((value) => ({ value, label: value }))} /><div><Label>Next action</Label><Input name="nextAction" maxLength={1000} /></div><div><Label>Next action date</Label><Input name="nextActionDate" type="date" /></div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ndaRequired} onChange={(event) => setNdaRequired(event.target.checked)} /> NDA required before detailed requirement intake</label><DialogFooter><Button type="submit">Save proposed project</Button></DialogFooter></form></DialogContent></Dialog>;
}

function FieldSelect({ label, value, onValueChange, options, placeholder, required = false }: { label: string; value: string; onValueChange: (value: string) => void; options: Array<{ value: string; label: string }>; placeholder?: string; required?: boolean }) { return <div><Label>{label}</Label><Select value={value} onValueChange={onValueChange} required={required}><SelectTrigger><SelectValue placeholder={placeholder ?? `Select ${label.toLowerCase()}`} /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>; }
function blank(form: FormData, field: string) { const value = String(form.get(field) ?? "").trim(); return value || null; }
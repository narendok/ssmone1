import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertVendor, type Vendor } from "@/lib/procurement";

const TERMS = ["Advance", "Immediate", "15 Days Net", "30 Days Net", "45 Days Net", "60 Days Net"];

export function VendorDialog({
  open,
  onOpenChange,
  vendor,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vendor?: Vendor | null;
  onSaved?: (name: string) => void;
}) {
  const [form, setForm] = useState<Partial<Vendor>>({ payment_terms: "30 Days Net", is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(vendor ?? { payment_terms: "30 Days Net", is_active: true });
  }, [open, vendor]);

  async function save() {
    if (!form.name?.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    setSaving(true);
    try {
      await upsertVendor({ ...form, name: form.name.trim() } as Vendor);
      toast.success(vendor ? "Vendor updated" : "Vendor added");
      onSaved?.(form.name.trim());
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not save vendor");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof Vendor) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit vendor" : "Add vendor"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1">
            <Label>Vendor name *</Label>
            <Input value={form.name ?? ""} onChange={set("name")} placeholder="Acme Electronics Pvt Ltd" />
          </div>
          <div className="space-y-1">
            <Label>Contact person</Label>
            <Input value={form.contact_person ?? ""} onChange={set("contact_person")} />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone ?? ""} onChange={set("phone")} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={set("email")} />
          </div>
          <div className="space-y-1">
            <Label>GSTIN</Label>
            <Input value={form.gstin ?? ""} onChange={set("gstin")} />
          </div>
          <div className="space-y-1">
            <Label>Payment terms</Label>
            <Select value={form.payment_terms ?? "30 Days Net"} onValueChange={(v) => setForm((f) => ({ ...f, payment_terms: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.is_active === false ? "inactive" : "active"} onValueChange={(v) => setForm((f) => ({ ...f, is_active: v === "active" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>Address</Label>
            <Textarea rows={3} value={form.address ?? ""} onChange={set("address")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save vendor"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

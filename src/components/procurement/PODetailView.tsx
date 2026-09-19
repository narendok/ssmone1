import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Printer, Send, PackageCheck, Mail, Copy, CircleSlash, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { printHtmlDocument, renderPoHtml } from "@/lib/po-html";
import { sendPoEmail } from "@/lib/po-email.functions";
import {
  inr,
  markPoSent,
  pendingQty,
  poPendingQty,
  poReceivedPct,
  shortClosePoItem,
  statusLabel,
  statusVariant,
  type PurchaseOrder,
} from "@/lib/procurement";

export function PODetailView({
  po,
  onOpenChange,
  onReceive,
}: {
  po: PurchaseOrder | null;
  onOpenChange: (v: boolean) => void;
  onReceive: (po: PurchaseOrder) => void;
}) {
  const qc = useQueryClient();
  const send = useServerFn(sendPoEmail);
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState<{ subject: string; html: string; reason?: string } | null>(null);
  const [closing, setClosing] = useState<{ id: string; mpn: string } | null>(null);
  const [closeReason, setCloseReason] = useState("");

  useEffect(() => {
    if (po) {
      setTo(po.sent_to ?? po.vendor?.email ?? "");
      setCc("");
      setMessage(`Dear ${po.vendor?.contact_person || po.vendor?.name || "Sir/Madam"},\n\nPlease find our purchase order ${po.po_number} below. Kindly confirm receipt and the delivery schedule.\n\nRegards,\nPartsBench Purchase Team`);
      setFallback(null);
    }
  }, [po?.id]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  }

  async function markSentOnly() {
    if (!po) return;
    setBusy(true);
    try {
      await markPoSent(po.id, to.trim() || "manually marked");
      toast.success(`${po.po_number} marked as sent`);
      refresh();
      setSendOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not update the purchase order");
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail() {
    if (!po) return;
    if (!to.trim()) {
      toast.error("Add the vendor's e-mail address first — you can save it on the vendor record");
      return;
    }
    setBusy(true);
    try {
      const res = await send({ data: { po_id: po.id, to: to.trim(), cc: cc.trim() || null, message: message.trim() || null } });
      if (res.sent) {
        toast.success(`${res.po_number} e-mailed to ${res.to}`);
        setFallback(null);
        setSendOpen(false);
        refresh();
      } else {
        setFallback({ subject: res.subject, html: res.html, reason: res.reason });
        toast.message("E-mail service not connected yet", {
          description: "Copy the order or open it in your own mail app — nothing is lost.",
        });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Could not send the purchase order");
    } finally {
      setBusy(false);
    }
  }

  async function copyFallback() {
    if (!fallback) return;
    const plain = fallback.html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    await navigator.clipboard.writeText(`${fallback.subject}\n\n${plain}`);
    toast.success("Order copied — paste it into your mail app");
  }

  function openInMailApp() {
    if (!po || !fallback) return;
    const plain = fallback.html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const url = `mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(fallback.subject)}&body=${encodeURIComponent(plain.slice(0, 1800))}`;
    window.location.href = url;
  }

  async function confirmShortClose(undo = false) {
    if (!po || !closing) return;
    setBusy(true);
    try {
      await shortClosePoItem(closing.id, closeReason.trim() || "Vendor cannot supply the balance", undo);
      toast.success(undo ? `${closing.mpn} reopened` : `${closing.mpn} short-closed`);
      setClosing(null);
      setCloseReason("");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Could not update the line");
    } finally {
      setBusy(false);
    }
  }

  const subtotal = (po?.items ?? []).reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0);
  const pendingTotal = po ? poPendingQty(po) : 0;
  const pct = po ? poReceivedPct(po) : 0;

  return (
    <>
      <Dialog open={!!po} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {po && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {po.po_number}
                  <Badge variant={statusVariant(po.status)}>{statusLabel(po.status)}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <div><span className="text-muted-foreground">Vendor</span><div className="font-medium">{po.vendor?.name ?? "—"}</div></div>
                <div><span className="text-muted-foreground">Expected delivery</span><div>{po.expected_delivery_date ?? "—"}</div></div>
                <div><span className="text-muted-foreground">Payment terms</span><div>{po.vendor?.payment_terms ?? "—"}</div></div>
              </div>

              {po.sent_at && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Sent to <span className="font-medium">{po.sent_to}</span> on{" "}
                  {new Date(po.sent_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery progress</span>
                  <span>{pct}% complete{pendingTotal > 0 && ` · ${pendingTotal} units still pending`}</span>
                </div>
                <Progress value={pct} />
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MPN</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Rejected</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(po.items ?? []).map((i) => {
                      const pend = pendingQty(i);
                      return (
                        <TableRow key={i.id}>
                          <TableCell>
                            <div className="font-medium">{i.mpn}</div>
                            <div className="text-xs text-muted-foreground">{i.description ?? i.component?.name ?? ""}</div>
                            {i.short_closed && (
                              <div className="text-xs text-amber-600">Short-closed: {i.short_close_reason}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{i.quantity_ordered}</TableCell>
                          <TableCell className="text-right">{i.quantity_received}</TableCell>
                          <TableCell className="text-right">{i.quantity_rejected > 0 ? <span className="text-destructive font-medium">{i.quantity_rejected}</span> : "—"}</TableCell>
                          <TableCell className="text-right">{pend > 0 ? <span className="font-medium">{pend}</span> : "—"}</TableCell>
                          <TableCell className="text-right">{inr(i.unit_cost)}</TableCell>
                          <TableCell className="text-right">{inr(i.quantity_ordered * i.unit_cost)}</TableCell>
                          <TableCell className="text-right">
                            {i.short_closed ? (
                              <Button variant="ghost" size="sm" onClick={() => { setClosing({ id: i.id, mpn: i.mpn }); setCloseReason(i.short_close_reason ?? ""); }}>
                                <Undo2 className="h-4 w-4" />
                              </Button>
                            ) : pend > 0 ? (
                              <Button variant="ghost" size="sm" title="Short-close this line"
                                onClick={() => { setClosing({ id: i.id, mpn: i.mpn }); setCloseReason(""); }}>
                                <CircleSlash className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="ml-auto w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{inr(po.tax_amount)}</span></div>
                <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{inr(po.total_amount)}</span></div>
              </div>

              {po.notes && <p className="text-sm text-muted-foreground">{po.notes}</p>}

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={() => printHtmlDocument(renderPoHtml(po), () => toast.error("Allow pop-ups to print the purchase order"))}>
                  <Printer className="h-4 w-4" /> Download PO PDF
                </Button>
                {po.status !== "CANCELLED" && (
                  <Button variant="secondary" onClick={() => setSendOpen(true)}>
                    <Send className="h-4 w-4" /> {po.sent_at ? "Re-send to vendor" : "Send to vendor"}
                  </Button>
                )}
                {(po.status === "SENT" || po.status === "PARTIALLY_RECEIVED") && (
                  <Button onClick={() => onReceive(po)}><PackageCheck className="h-4 w-4" /> Receive shipment (GRN)</Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Send {po?.po_number} to {po?.vendor?.name ?? "vendor"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Vendor e-mail *</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="sales@vendor.com" />
              {!po?.vendor?.email && (
                <p className="text-xs text-muted-foreground">No e-mail is saved for this vendor — add one on the Vendors page so it fills in next time.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>CC</Label>
              <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="purchase@yourcompany.com" />
            </div>
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>

            {fallback && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm space-y-2">
                <p className="font-medium">The order is ready but no mail service is connected yet.</p>
                <p className="text-muted-foreground text-xs">{fallback.reason === "no_mail_provider" ? "Connect an e-mail service and this button will deliver it automatically." : fallback.reason}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={copyFallback}><Copy className="h-4 w-4" /> Copy the order</Button>
                  <Button size="sm" variant="outline" onClick={openInMailApp}><Mail className="h-4 w-4" /> Open in my mail app</Button>
                  <Button size="sm" variant="outline" onClick={() => printHtmlDocument(fallback.html, () => toast.error("Allow pop-ups"))}>
                    <Printer className="h-4 w-4" /> Print copy
                  </Button>
                  <Button size="sm" onClick={markSentOnly} disabled={busy}>Mark as sent</Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={sendEmail} disabled={busy}><Send className="h-4 w-4" /> {busy ? "Sending…" : "Send order"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closing} onOpenChange={(v) => !v && setClosing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Short-close {closing?.mpn}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            The balance quantity stops being expected from the vendor and leaves the pending list.
          </p>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="Vendor cannot supply the balance" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => confirmShortClose(true)} disabled={busy}>Reopen line</Button>
            <Button onClick={() => confirmShortClose(false)} disabled={busy}>Short-close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

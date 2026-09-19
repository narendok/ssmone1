import { inr, type PurchaseOrder } from "@/lib/procurement";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/** Full printable / e-mailable HTML document for a purchase order. */
export function renderPoHtml(po: PurchaseOrder, opts?: { message?: string | null }): string {
  const items = po.items ?? [];
  const rows = items
    .map(
      (i, n) => `<tr>
        <td>${n + 1}</td>
        <td>${escapeHtml(i.mpn)}</td>
        <td>${escapeHtml(i.description ?? i.component?.name ?? "")}</td>
        <td class="r">${i.quantity_ordered}</td>
        <td class="r">${inr(i.unit_cost)}</td>
        <td class="r">${inr(i.quantity_ordered * i.unit_cost)}</td>
      </tr>`,
    )
    .join("");
  const subtotal = items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(po.po_number)}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;color:#111;padding:32px;font-size:12px}
  h1{font-size:20px;margin:0}
  .muted{color:#666}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
  th{background:#f3f4f6}
  .r{text-align:right}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px}
  .totals{margin-top:12px;width:280px;margin-left:auto}
  .sign{margin-top:64px;text-align:right}
  .msg{margin-top:16px;padding:10px 12px;background:#f8fafc;border-left:3px solid #94a3b8;white-space:pre-wrap}
</style></head><body>
<div class="head">
  <div><h1>PartsBench</h1><div class="muted">Purchase Order</div></div>
  <div class="r">
    <div><strong>${escapeHtml(po.po_number)}</strong></div>
    <div class="muted">Date: ${new Date(po.created_at).toLocaleDateString("en-IN")}</div>
    <div class="muted">Expected: ${escapeHtml(po.expected_delivery_date ?? "—")}</div>
  </div>
</div>
${opts?.message ? `<div class="msg">${escapeHtml(opts.message)}</div>` : ""}
<div style="margin-top:16px"><strong>Vendor</strong><br>
${escapeHtml(po.vendor?.name ?? "—")}<br>
${escapeHtml(po.vendor?.address ?? "")}<br>
${po.vendor?.gstin ? "GSTIN: " + escapeHtml(po.vendor.gstin) + "<br>" : ""}
${escapeHtml(po.vendor?.contact_person ?? "")} ${escapeHtml(po.vendor?.phone ?? "")}<br>
Payment terms: ${escapeHtml(po.vendor?.payment_terms ?? "—")}
</div>
<table><thead><tr><th>#</th><th>MPN</th><th>Description</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead>
<tbody>${rows}</tbody></table>
<table class="totals">
  <tr><td>Subtotal</td><td class="r">${inr(subtotal)}</td></tr>
  <tr><td>Tax (GST)</td><td class="r">${inr(po.tax_amount)}</td></tr>
  <tr><td><strong>Total</strong></td><td class="r"><strong>${inr(po.total_amount)}</strong></td></tr>
</table>
${po.notes ? `<p><strong>Notes:</strong> ${escapeHtml(po.notes)}</p>` : ""}
<div class="sign">_______________________<br>Authorised signatory</div>
</body></html>`;
}

export function printHtmlDocument(html: string, onBlocked: () => void) {
  const w = window.open("", "_blank");
  if (!w) return onBlocked();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

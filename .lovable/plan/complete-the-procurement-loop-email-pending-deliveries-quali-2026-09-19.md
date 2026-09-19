# Complete the procurement loop: email, pending deliveries, quality check

Most of the chain already works today — a BOM shortage list becomes a purchase order, the order can be marked as sent and printed, and receiving a shipment adds stock and writes a history entry. This plan closes the three gaps you picked.

## 1. Email the order to the vendor

- "Send to vendor" on a purchase order emails the order to the vendor's saved email address, with a CC field you can edit and an optional message.
- The email contains the full order: order number, your details, vendor details, every line with quantity and price, tax, total, expected delivery date and payment terms — plus a printable HTML copy attached.
- If the vendor has no email saved, the button tells you and opens the vendor so you can add one.
- Sending records the send (who, when, which address) on the order and flips its status to Sent. Sending again is allowed and logged as a re-send.
- Each order shows a "Sent to vendor@… on 19 Sep" line so there is never a doubt whether it went out.

Note: sending real email needs an email provider key. I will wire the sending through a key you provide (Resend is the simplest); until that key is set, the button will still compose the email and let you copy or open it in your own mail client, so nothing is blocked.

## 2. Partial deliveries and a pending list

- Every order line gets a clear "ordered / received / still pending" breakdown, with a progress bar per order.
- New **Pending deliveries** page under Procurement: every line still owed across all open orders, sorted by expected date, with overdue rows flagged in red, filters by vendor and project, and a CSV export.
- Order list gains "Pending units" and "Overdue" indicators, and a filter for "Has pending items".
- Short-closing: if a vendor will never ship the rest, you can close a line as short-closed with a reason; the order then counts as complete and the line stops appearing in the pending list.
- If it's a new parts order, it will be added to the component add dialog box to fill details with still option to skip. And this quick adding part will be in the review list of the inventory even skip. 

## 3. Quality check while receiving

- The receive screen gains, per line, an accepted quantity and a rejected quantity with a reason (damaged, wrong part, failed test, quantity short, other) and an optional note.
- Only accepted quantity goes into stock and into the order's received count. Rejected quantity is recorded against the goods receipt and shown on the order so you can chase a replacement or credit note.
- Rejected quantity stays visible in the pending list, so an order is only finished once good parts have actually arrived or the line is short-closed.
- Each goods receipt shows an accepted/rejected summary, and rejected lines appear on a "Rejections" tab of the Pending deliveries page.

## Technical notes

- Database: `purchase_orders` gains `sent_at`, `sent_to`, `sent_by`; `purchase_order_items` gains `quantity_rejected`, `short_closed`, `short_close_reason`; `goods_receipt_items` gains `quantity_rejected`, `rejection_reason`, `rejection_note`. All with grants and RLS matching the existing procurement tables.
- `create_grn` is rewritten to take accepted + rejected per line: stock and `quantity_received` move by accepted only; rejected is stored on the receipt item; order status becomes RECEIVED when every line has `quantity_received >= quantity_ordered` or is short-closed, otherwise PARTIALLY_RECEIVED. `stock_history` keeps `action = 'inward_purchase'` with the GRN and PO in the note.
- New `mark_po_sent(po_id, address)` helper guarded by `can_purchase`, and a `short_close_po_item` helper for short-closing.
- Email goes through a new authenticated server function (`src/lib/po-email.functions.ts`) that renders the same HTML used by the existing print view and posts it to the email provider; the provider key is read inside the handler. No key set means the function returns the rendered email for the copy/mail-client fallback instead of failing.
- UI: `PODetailView` gains a send dialog and a receive-progress panel; `CreateGRNDialog` gains accepted/rejected columns; new route `src/routes/_authenticated/procurement.pending.tsx` plus a sidebar entry under Procurement.

## Out of scope

- Approval workflow before sending (you did not pick it).
- Vendor-side portal, credit notes and debit notes, and payment/invoice reconciliation.
# R&D kits, AI parts requests, and email alerts

## What will be added

1. Add an **R&D parts request** screen where a team member describes what they need, optionally selects a project and quantity, then receives a ranked set of compatible stocked components and their available storage locations.
2. Use Lovable AI on the server to interpret the request and evaluate only the current inventory details supplied to it. Every recommendation will show the matched part, available quantity, location, and a short compatibility reason; the requester chooses what to add to a kit.
3. Strengthen the existing assignment flow into a complete kit checkout workflow:
   - record the responsible R&D user, project, items, quantities, locations, notes, checkout date, and due-back date;
   - retain item-by-item and whole-kit return status;
   - add an overdue view/filter and clear outstanding quantities;
   - ensure inventory and stock history updates remain consistent with the kit record.
4. Add an administrator-controlled notification settings screen for four independent email alerts: kit assigned, kit overdue, low stock, and stock adjustment completed.
5. Send in-app notices alongside enabled emails, with recipient selection appropriate to each event. Email delivery failures will be visible without blocking inventory or return records.
6. Add a scheduled, guarded overdue/low-stock sweep that respects each enabled notification setting and avoids duplicate alerts for the same condition.

## Technical details

- Add additive database changes only: kit due/notification state and notification-preference records, plus security policies and grants for every new table.
- Keep AI calls server-side through Lovable AI Gateway using `openai/gpt-6-astra`; validate AI output against the inventory rows before returning recommendations.
- Reuse existing `components`, `locations`, `assignment_batches`, `assignments`, `stock_history`, R&D members, the in-app `notifications` table, and the current protected server-function pattern.
- Use a configured mail connection when available. If it is not configured, preserve the operational action, create the in-app notice, and show a clear delivery-status message.
- Add focused tests for recommendation validation, notification preferences/deduplication, due-date status, and assignment/return stock effects.

## Boundaries

- No Phase 11 work, mobile implementation, or unrelated inventory redesign.
- Existing kit assignment and return records remain intact.

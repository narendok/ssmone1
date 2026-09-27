# Department Workspaces and Google Drive Links

## Goal
Make the Department Center the daily operating view for leads, with clear access to each department's requests, tasks, approvals/gates, and documents. Add Google Drive as a safe per-user link-and-reference source.

## What will be added
- Expand each department dashboard into consistent workspace sections for Requests, Tasks, Approvals & Gates, Documents, and Reports.
- Reuse existing Procurement, task, project, quality, HR, sales, production, and Drive screens as the action destinations; do not duplicate their underlying workflows.
- Add a central approval/gate queue view that can summarize established approval-bearing records and clearly point users to the correct action screen.
- Add a Google Drive connection area in user-facing document settings.
- Implement per-user Google Drive connection, read-only browsing, searching, and linking of Drive files to existing operational records. Users retain Google-controlled file permissions.
- Store each user's Drive connection securely on the server, encrypted and scoped to their signed-in identity. Keep provider credentials out of the browser.
- Start with link-and-reference only: no Drive file uploads, moves, deletes, or sharing-permission changes.

## User experience
- Selecting a department heading opens its focused command center.
- Leads see request, approval, task, and document signals together, then open the established workflow to act.
- Users connect Google Drive once from the document area, browse only files they can access, and attach a Drive reference to supported records.
- A disconnected or expired Drive connection presents a clear reconnect action.

## Technical details
- Extend the existing read-only department aggregation without weakening record-level permissions.
- Use existing protected workflow contracts for purchase and gate actions; no new direct client-side writes to controlled operational data.
- Use the Google Drive per-user OAuth connection with read-only Drive scope, secure server-side calls, encrypted connection-key storage, and a popup consent flow.
- Add a narrowly scoped persisted file-reference model and RLS policies so users only see links for records they already have permission to view.

## Validation
- Verify role-filtered department navigation and focused dashboard links.
- Verify each department queue opens the relevant existing workflow.
- Verify Google Drive connection/reconnection states, no browser exposure of credentials, and link visibility under authorized accounts.
- Run focused tests and confirm the preview remains healthy.
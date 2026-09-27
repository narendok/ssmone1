# Lean Connected Operations Portal Blueprint

## Goal
Create a fresh, startup-sized operations portal that keeps the strongest SSM One capabilities while replacing the dense navigation with a single connected operating system. It must be easy for one lead to manage, clear for teams, safe for clients, and prepared for one unified mobile app.

## Product model
The portal is organized around five daily workspaces, not dozens of isolated modules:

1. **Command Center** — company pulse, today’s priorities, pending approvals, overdue work, and cross-department progress.
2. **Work** — tasks, requests, approvals, decisions, comments, linked records, and personal/department queues.
3. **Delivery** — projects, engineering, BOMs, procurement, production, quality, dispatch, and customer commitments.
4. **Records** — controlled documents, Drive references, files, revisions, vendors, customers, parts, assets, and searchable history.
5. **Setup** — guided one-time configuration for company, team, roles, workflows, numbering, locations, categories, templates, and client visibility.

## Lean department workspaces
Use a small department set with a shared layout and only the controls each lead needs:

- **R&D & Projects:** product roadmap, projects, design inputs, BOMs, engineering tasks, parts, prototype/PCB work, gates, and change control.
- **Supply & Stores:** purchase requests, suppliers, RFQs, orders, receiving, stock, locations, shortages, assignments, and returns.
- **Production & Quality:** work orders, material readiness, kitting, build progress, inspections, NCR/CAPA, release, and dispatch.
- **Sales & Customer:** customers, enquiries, opportunities, requirements, quotes/orders, milestones, and role-controlled client updates.
- **People & Admin:** people, onboarding, training, policies, leave, facilities, assets, access, and operating setup.

Every workspace has the same first screen: **Today**, **Priority**, **Pending**, **Approvals**, **Progress**, and **Quick actions**. Department-specific pages open only when needed.

## Connected-record standard
Every operational record should carry consistent links where applicable:

- owner, department, project/product, customer/order, supplier, task, approval/gate, document/file, timeline, and status
- a single activity timeline for decisions, notes, changes, and attachments
- a role-based visibility setting for internal teams, leadership, and clients
- global and scoped search across parts, tasks, projects, orders, vendors, customers, documents, and codes

Existing protected workflows and audit trails remain the source of truth; the redesign changes the experience and shared navigation, not the controlled business rules.

## Dashboard and visibility model
- **Company Command Center:** operating health, key milestones, urgent risks, pending approvals, cash/fulfilment indicators where authorized, and department workload.
- **Department Command Center:** today’s work, priority/past-due work, request/approval queue, team workload, delivery progress, and linked documents.
- **Project/Product workspace:** stage timeline, task completion, BOM/material readiness, purchasing, build/test/quality state, files, decisions, risks, and client-shareable status.
- **Sales order/customer workspace:** commercial progress, delivery milestones, approved documents, support/quality status, and selected client updates.
- **Client portal:** only explicitly shared milestones, documents, status, and requests. Internal pricing, supplier, personnel, stock, and decision detail remain hidden unless deliberately shared.

## One-time setup wizard
Build a guided, resumable setup with a progress checklist. The setup asks for one small input set at a time and creates only the needed configuration:

1. Company identity, locations, working calendar, and document numbering.
2. Departments and leads: R&D, Supply & Stores, Production & Quality, Sales & Customer, People & Admin.
3. Team members, roles, permission presets, and client-facing contacts.
4. Product/project types, project stages, milestone templates, and approval gates.
5. Part categories, inventory locations/bins, units, stock thresholds, and supplier list.
6. Customer pipeline, quotation/order stages, client-visibility templates, and support/quality intake.
7. Production routes, quality checkpoints, NCR/CAPA rules, release, and dispatch templates.
8. Drive/document-reference conventions, file naming, revision rules, and retention responsibilities.
9. Notifications, daily review rhythm, escalation rules, and dashboard targets.
10. Test data checklist, role-by-role acceptance, and go-live checklist.

## Mobile-first readiness
Prepare one unified mobile application around real operating moments rather than copying desktop pages:

- universal search by code/name, barcode/QR scan, recent records, and saved work queues
- receiving, stock lookup/adjustment, material issue/return, location transfer, picking, production progress, inspection, NCR/CAPA evidence, task updates, approvals, and photos/files
- offline-safe drafts with idempotent submit/retry behavior and clear sync status
- role-based mobile home screens: Storekeeper, R&D, Production, Quality, Sales/Customer, Lead/Admin
- server-owned authorization, audit events, document numbers, and inventory posting remain mandatory for every mobile action

## AI assistance
Add AI only where it shortens routine work and always preserves human review:

- classify new parts/categories and suggest supplier/alternate data
- summarize project, order, or quality progress from existing authorized records
- draft task plans, meeting notes, customer updates, RFQ text, and document metadata
- surface anomalies: late tasks, material shortages, missing approvals, duplicate parts, and blocked orders
- ask natural-language questions over only the user’s authorized operational data

AI never approves payments, changes stock, releases quality, shares client data, or makes irreversible workflow decisions without an authorized human action.

## Delivery sequence
1. Confirm the lean information architecture and retire/hide duplicate entry points.
2. Build the shared command-center shell, universal search, notifications, and connected-record timeline.
3. Standardize department workspaces and quick actions on the existing protected workflows.
4. Create project/product and customer/order progress workspaces with controlled client sharing.
5. Add the guided setup wizard and team operating playbooks.
6. Consolidate mobile-safe reads/actions, scanning, offline drafts, and role-based mobile queues.
7. Add reviewed AI assistance and operational reporting.

## Technical details
- Retain the existing role-based permissions, RLS-protected reads, protected server actions, idempotent inventory contracts, and audit history.
- Use a consistent record-link schema and permission-aware search index; do not duplicate controlled workflow data.
- Keep Drive as link/reference-first until per-user Drive access is available; never store browser-accessible external credentials.
- Design every new operational mutation as an authenticated, retry-safe server action with an explicit mobile contract.

## Success criteria
- A lead can run each department from one daily screen in under five minutes.
- A record can be found by its code, name, project, order, customer, supplier, or task context.
- Project, production, and order progress are visible internally and selectively to clients.
- The same controlled data/actions support desktop and the future single mobile app.
- A new startup team can finish setup with guided inputs and test the full flow before go-live.

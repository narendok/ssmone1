# Phase 1 implementation continuation

## Workspace and access
- Replace the legacy PartsBench shell with the responsive SSM One workspace while preserving every existing PartsBench route and feature.
- Use the permission catalogue for navigation and route gating, with the legacy admin role retaining its secure administrative bridge.
- Remove public demo-account sign-in controls and present editable organization branding on authentication screens.

## Administration
- Deliver the organization settings, departments, employees, roles, permissions, assignments, module status, document-numbering settings, and audit-log areas.
- Seed only the official department catalogue, system roles, module registry, and reusable permissions.
- Invite `narendok@gmail.com` as the initial System Admin; no demo employees will be created.

## Platform foundations
- Add notification center, global command search, activity timeline, entity/deep-link helpers, coming-soon routes, responsive states, and route metadata.
- Keep PartsBench procurement, BOM, inventory, PCB tracking, supplier integrations, data, URLs, and RLS behavior intact.

## Technical details
- Build frontend routes and server-only administrative bootstrap logic using the applied additive foundation schema.
- Preserve existing authentication guard behavior and use RLS/permission functions for protected data and routes.
- Validate the Phase 1 acceptance tests, including unauthorized-route denial and breakpoint coverage.

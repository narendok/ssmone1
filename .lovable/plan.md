# Unify My day and department tasks

## Outcome

Make **My day** the single practical task workspace for a selected department, while keeping the full task board available only for deeper planning and stage management. Every task row will make the due date, status, project, assignee, and linked document easy to see or open.

## Changes

1. Combine the daily task experience
   - Replace the current split between personal checklist and general task board with one task-focused My day screen.
   - Show the chosen department’s open tasks in a concise default table/list, ordered by urgency and due date.
   - Retain a separate expandable “later” section for work not requiring attention today.
   - Keep the existing completion checkbox and task-detail expansion.

2. Make department scope clear and useful
   - Add a department selector that limits the My day list to that department’s tasks.
   - Use the viewer’s department as the default when available; administrators can switch department context without changing their permissions.
   - Keep the full Tasks page as the cross-department planning board, with its existing filters and board/table switch.

3. Show essential task context in every row
   - Display clear columns or compact labels for: due date, status, priority, project, assignee, and document.
   - Link project codes to the existing project workspace.
   - Link the assignee to the existing task view filtered for their work where supported.
   - When a task has a connected document reference, show an “Open document” action; show a neutral dash when no document is linked.
   - Keep purchase-request, CAPA, and customer-complaint context available in the expandable task details.

4. Simplify labels and navigation
   - Rename My day’s supporting language to make its department task purpose explicit.
   - Keep “Tasks” as the full workflow-management destination and avoid duplicate status summaries between the two pages.

5. Preserve existing behavior and safeguards
   - Do not change task records, department membership, roles, permissions, document access, or workflow rules.
   - Reuse the existing task update path, task drawer, project links, and document reference field.
   - Add focused coverage for department filtering, ordering, displayed task context, and document-link visibility.

## Technical details

- Existing task data already includes department, due date, status, priority, project, assignee, and an optional `drive_node_id` document reference.
- The current task detail drawer already exposes related project, purchase request, CAPA, and customer complaint links. The refinement will use this rather than creating parallel record pages.
- A document action will only be enabled when a resolvable document destination is available; it will never claim an external Drive connection.

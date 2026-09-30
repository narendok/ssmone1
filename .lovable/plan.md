# Department, access and Drive completion

## Decisions applied
- Retire the legacy/Administration department workspace only; preserve the renamed **Platform Owner** permission role for platform oversight.
- Give the Platform Owner controlled cross-department Drive visibility while all other users remain limited to their department or project team.
- Create labelled acceptance records only, never present them as operational company data.
- Apply the provided Drive hierarchy to department roots and all new department-assigned projects; existing projects remain unassigned until explicitly classified.

## Delivered so far
- Active department roots now contain Common Rules, Internal Projects and Client Projects.
- The uploaded eight-section project hierarchy is the controlled project template.
- Legacy Hardware/HW/R&D aliases, Marketing & Business Development, and Administration have been deactivated rather than deleted, preserving audit history.
- The former System Admin access role is now Platform Owner, retaining its existing assignment.

## Remaining implementation
- Prevent the foundation synchronizer from recreating retired departments and point its default assignment to Hardware & R&D.
- Remove retired department entries from workspace navigation and dashboard selections.
- Add concise, visibly labelled acceptance records in the requested departmental work areas through existing governed workflows.
- Wire department and Internal/Client selection into project creation, then provision its approved Drive tree automatically.
- Verify access with a signed-in user from the assigned department and a Platform Owner account.

## Security
- Department Drive policies keep access at the employee department or project-team boundary, with a Platform Owner exception for oversight.
- No client-side permission shortcut or public document access is introduced.

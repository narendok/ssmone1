# Cross-Phase Stabilization Patch 01

## Outcome
Strengthen existing Phase 1–5 workflows without rebuilding modules or beginning Phase 6: central, concurrency-safe business codes; lightweight master-data creation; context-preserving selection; and reduced re-entry across Sales, HR, Projects, Tasks, and Administration.

## Delivery plan

1. **Central numbering and master controls**
   - Extend the existing numbering configuration into a configurable entity-rule engine with atomic sequence allocation, previews, active rules, audit entries, and permission-respecting administration.
   - Apply generated immutable codes to customers, projects, requisitions/job openings, candidates, employees, requirements, issues, and engineering changes while retaining existing values.
   - Harden the canonical Department Master with aliases, unique normalized names/codes, HOD references, suggested codes, and archive-first handling.

2. **Reusable selectors and quick creation**
   - Add common searchable customer, contact, department, project, and person selectors that show human codes and return master UUIDs.
   - Add modal-based Customer and Contact quick creation with duplicate warnings and callback selection, preserving the unfinished parent form.
   - Apply selectors and read-only derived details to sales, requirements, projects, teams, and tasks.

3. **Sales and project context**
   - Replace manual customer code entry with server-generated codes and duplicate checks.
   - Auto-derive customer/contact/owner information on sales and requirement forms, preserving requirement snapshots when baselined.
   - Generate project codes and use requirement baseline/handover data to prefill linked project context without retyping.

4. **HR and task UX**
   - Add Job Profile master records, inline profile creation, cloning, generated job-opening/candidate/employee codes, duplicate warnings, and a prominent quick job-opening action.
   - Simplify task creation around title, assignee, department, project, priority, and due date; retain advanced data separately and prefill project context.

5. **Validation and regression review**
   - Exercise code allocation, duplicate checks, quick-create callbacks, department access, and representative Sales/HR/Projects/Tasks flows with available roles.
   - Record the cross-phase audit outcome and retain open validation items only where a dedicated role session is unavailable.

## Technical details

- All schema work is additive and uses the established permissions and audit model.
- Final codes are allocated in database functions while creating records, never browser-only.
- Existing records keep their UUIDs and existing business codes; newly generated codes do not renumber historical records.
- No Phase 6 manufacturing or quality extensions are included.

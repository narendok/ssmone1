# Save a project BOM and reuse it

## Problem

The BOM page matches imported lines against stock and (optionally) links matched parts to a project via `component_projects`, but the BOM itself — its line items, reference designators, costs and match results — is never saved. Leave the page and the import is gone. The user wants the imported BOM stored against a project so it can be reopened and reused later.

## Goal

Persist an imported BOM under a project of latest(greatest) version: every line (MPN, value, designators, footprint, qty, unit/total cost, remark, matched component, match status, shortage). Re-open it later from the project, re-run the match against current stock, edit costs, and regenerate exports/POs without re-uploading.

## Data model (migration)

Two new tables, RLS + GRANTs following the project pattern.

### `public.project_boms`

- `id uuid pk default companyname-type-department-serial() like HLPL-WI-EHW-001 etc`
- `project_id uuid not null references public.projects(id) on delete cascade`
- `name text not null` (BOM title, defaults to source filename)
- `source_filename text` (uploaded file name)
- `revision text` (user-set, e.g. "A", "B")
- `notes text`
- `line_count int not null default 0`
- `total_cost numeric(14,2)` (sum of line totals)
- `created_by uuid references auth.users(id)`
- `created_at`, `updated_at timestamptz default now()`
- unique `(project_id, name)` so a re-import with the same name updates instead of duplicating.

### `public.project_bom_items`

- `id uuid pk`
- `bom_id uuid not null references public.project_boms(id) on delete cascade`
- `line_index int not null` (original row order)
- `mpn text`, `manufacturer text`, `value text`, `description text`, `refs text`, `footprint text`
- `quantity int not null`
- `remark text`
- `unit_cost numeric(12,4)`, `total_cost numeric(14,2)`
- `matched_component_id uuid references public.components(id) on delete set null`
- `match_status text` (exact | close | substitute | missing)
- `shortage int not null default 0`
- `created_at timestamptz default now()`

### Grants / RLS / triggers

- `GRANT SELECT, INSERT, UPDATE, DELETE ON project_boms TO authenticated; GRANT ALL ON project_boms TO service_role;`
- same block for `project_bom_items`.
- `ENABLE ROW LEVEL SECURITY` on both.
- Policies: authenticated users can select all project BOMs; insert/update/delete where `created_by = auth.uid()` (and admins via service role). Mirrors the projects/components access pattern.
- `touch_updated_at` trigger on `project_boms`.

## Server function

`src/lib/project-bom.functions.ts` (client-safe path):

- `saveProjectBom(input)` — `createServerFn({ method: "POST" })` + `requireSupabaseAuth`, input `{ project_id, name, source_filename, revision, notes, items[] }` where each item carries the BomLine + matched component id + match status + shortage. It:
  1. Upserts a `project_boms` row on `(project_id, name)` (returning id).
  2. Deletes existing items for that bom_id, then inserts the new items (so re-saving replaces the old set).
  3. Recomputes `line_count` and `total_cost` on the bom row.
  Returns `{ bom_id, name }`.
- `fetchProjectBoms(project_id)` — list BOMs for a project (id, name, revision, line_count, total_cost, created_at) for the project tab.
- `fetchProjectBomItems(bom_id)` — full item rows with joined component name/part_number for the detail view.
- `loadProjectBom(bom_id)` — returns the bom header + items in a shape the BOM page can drop straight into its match state (mpn, manufacturer, value, description, refs, footprint, quantity, remark, unitCost, totalCost).

## UI changes

### BOM page (`src/routes/_authenticated/bom.tsx`)

- After matching (matches present), show a **"Save BOM to project"** button in the results action bar. Disabled when no project is picked (`projectId === "__none"`).
- On click: calls `saveProjectBom` with the resolved matches → items. Toast success ("Saved to {project name}"). Offers a link to view it on the project.
- Adds a small "name / revision" inline prompt (defaults to filename + no revision) — reuse an existing Dialog or a compact popover; keep it minimal.

### Project detail page (`src/routes/_authenticated/projects.$projectId.tsx`)

- Add a **"BOM"** tab.
- Lists saved BOMs for the project (name, revision, source file, line count, total cost, saved date) with actions: **Open** and **Load in BOM tool**.
- **Open** shows the BOM's saved line items in a table (refs, MPN, value, footprint, qty, unit/total cost, matched part + status, shortage). Read-only snapshot of the saved match.
- **Load in BOM tool** → navigates to `/bom` and pre-loads that BOM's lines into the match flow (via router state / a query key), so the user can re-run matching against current stock and re-save.

## Out of scope

- No changes to `component_projects` (the existing "Link matched to project" action stays).
- No version diffing between two saved BOMs.
- No BOM approvals workflow.
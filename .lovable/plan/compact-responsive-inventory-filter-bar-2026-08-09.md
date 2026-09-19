# Compact, responsive inventory filter bar

## Goal
The filter panel above the inventory table currently wraps 7 controls plus the search box onto multiple rows and overflows on mobile. Make it a single tidy row that adapts to browser width, collapsing to icon-only controls on small screens.

## Changes — `src/components/inventory/InventoryView.tsx`

### Desktop (md and up)
- Keep one flex row: search input grows (`flex-1 min-w-0`), all selects sit on the right at fixed widths.
- Shrink select widths and use short labels ("Package", "Mfr", "Category", "Location", "Project", "Status", sort icon + value) so all fit without wrapping.
- Add `min-w-0` / `truncate` on triggers so long selected values shorten instead of pushing the row.

### Mobile (below md)
- Row 1: search input full width with the magnifier icon.
- Row 2: a horizontally scrollable strip of icon-only trigger buttons — one per filter — using Lucide icons:
  - Package → `Box`, Manufacturer → `Factory`, Category → `FolderTree`, Location → `MapPin`, Project → `FolderKanban`, Status → `Activity`, Sort → `ArrowUpDown`.
- Each icon trigger keeps the same Select behaviour (same state, same options); the label text is hidden with `hidden md:inline` while the icon shows always.
- Active (non-"all") filters get a highlighted trigger (primary ring/accent background) plus a small dot, so it's obvious which filters are applied even when text is hidden.
- Add an "×" clear-all control that appears only when at least one filter is active.

### Accessibility / polish
- Every icon-only trigger gets an `aria-label` and a tooltip (TooltipProvider already wraps the view) with the full filter name.
- Follow the responsive-layout rules: grid/flex with `min-w-0` on text containers and `shrink-0` on icons.

## Out of scope
- No change to filter logic, queries, or table columns — presentation only.

## Verification
- Desktop: all controls on one row, no wrapping, table unchanged.
- Mobile (≈394px): search on its own row, filters as a scrollable icon strip, each opens the right dropdown, active ones visibly marked.
- Typecheck passes.

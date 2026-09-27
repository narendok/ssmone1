# Department navigation refinement

## Goal
Make the sidebar clearer for administrators: each department heading opens the shared Department Center already focused on that department, while its arrow only expands or collapses that department’s related options.

## Changes
1. Give the shared dashboard a department selection in its address so Engineering, Operations, People, Sales, Production, and Quality can open directly to the relevant overview.
2. Update department headings in the sidebar so the heading is a link to its department overview.
3. Make the arrow a separate control that expands or collapses only that menu, without opening a page.
4. Keep all existing permission checks and destination pages unchanged.
5. Remove duplicate “overview” submenu entries once the heading itself is the overview link.

## Validation
- Check that each department heading opens the shared dashboard with the correct department selected.
- Check that each arrow expands and collapses its own options without navigating away.
- Confirm the navigation still builds cleanly and no unauthorized options appear.

## Technical details
- The dashboard remains one shared page; a URL search value determines the initially selected department.
- No database, workflow, or permission-model changes are required.

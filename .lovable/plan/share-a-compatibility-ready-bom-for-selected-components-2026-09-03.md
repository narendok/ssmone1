# Share a compatibility-ready BOM for selected components

Pick components anywhere in the app, then export or share a list where every part carries all of its substitutes, their stock, and the substitute notes — so whoever receives it knows what can be swapped in.

## Selecting components

- Checkbox column in the inventory table (header checkbox selects everything currently filtered).
- Quick selectors in the toolbar: select all in the active category filter, or select all components linked to a chosen project.
- A sticky action bar appears when at least one row is selected: "N selected · Export CSV · Export Excel · Copy · Share link · Clear".

## What the export contains

One row per selected component:

| Column | Notes |
| --- | --- |
| Part number, Name, Manufacturer, Footprint, Category | from the component |
| On hand, Stock status | summed across locations |
| Substitutes | joined into one cell: `MPN — Manufacturer (qty 120, in stock) — note` separated by `;` |
| Substitutes in stock / total | quick count column |
| Supplier URL, Datasheet URL | |

Out-of-stock substitutes are included and clearly flagged (`qty 0, out of stock`) so nothing is silently dropped.

## Three ways to share

1. **Download** — CSV or Excel, same columns. Excel gets a bold header row, frozen top row and sized columns.
2. **Copy to clipboard** — markdown table of the same data, ready to paste into email or chat.
3. **Read-only share link** — creates a snapshot the recipient can open without logging in. Opens a dialog with the URL, a copy button, and an optional expiry (7 / 30 days / never). A "Shared lists" section lets you revoke a link.

## Technical notes

- New `src/lib/bom-share.ts`: `shareRows(parts, substituteMap)` builds the row shape; `rowsToMarkdown()` for clipboard. Reuses the existing `downloadCsv` / `downloadXlsx` helpers in `src/lib/bom.ts`.
- Selection state lives in `InventoryView.tsx` as a `Set<string>` of component ids; a new `ShareSelectionBar` + `ShareLinkDialog` component under `src/components/inventory/`.
- The BOM page gets the same actions for its matched results, so a matched BOM can be shared with substitutes attached.
- Share link needs a migration: `public.shared_boms` (id, token, title, payload jsonb snapshot, created_by, expires_at, revoked_at) with GRANTs, RLS so authenticated users manage their own rows, and no anon table access.
- Reading a shared list goes through a public server function that looks the token up with the admin client, checks expiry/revocation, and returns only the snapshot payload — the table itself stays closed to anon.
- New public route `src/routes/share.$token.tsx` renders the snapshot read-only (no auth gate) with its own `head()` metadata and `noindex`.
- Snapshot is frozen at share time, so quantities in a shared link reflect when it was created; the page shows that timestamp.

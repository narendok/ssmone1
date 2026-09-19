# PartsBench — Electronics Component Inventory & BOM Portal

PartsBench is a full-stack inventory management portal for electronics components,
built for R&D and hardware teams. It tracks every component in stock, its locations
and stock levels, substitutes/compatibility, BOM import & matching, PCB repair
tasks, R&D team assignments, a complete procurement & purchase-management module
(vendors → purchase orders → goods receipt with automatic stock increment),
supplier (Mouser) lookups with datasheet preview, AI-assisted category
classification, one-click demo accounts for every role, and a voice assistant
for hands-free operations.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | TanStack Start v1 (React 19, SSR/SSG, file-based routing) |
| Build tool | Vite 8 (Nitro server preset, Cloudflare Worker runtime) |
| Styling | Tailwind CSS v4 (native `@import` + `@theme`, shadcn/ui components) |
| Backend / Auth / DB | Lovable Cloud (Supabase) — Postgres, RLS, Storage, Auth |
| Data fetching | TanStack Query v5 (`useSuspenseQuery` + loader `ensureQueryData`) |
| Server logic | `createServerFn` (RPC) + TanStack server routes for HTTP/webhooks |
| AI / voice | Lovable AI Gateway — Gemini (chat, category classification, datasheet search), OpenAI `gpt-4o-mini-transcribe` (speech-to-text) |
| Supplier data | Mouser Search API |
| Excel / CSV | SheetJS (`xlsx`) + Papa Parse |
| PDF rendering | `pdfjs-dist` v4.10.38 (client canvas), server-side datasheet proxy |
| Forms | React Hook Form + Zod |
| Icons | lucide-react |

---

## Getting started

### Prerequisites

- Node.js 20+ / Bun
- A Lovable Cloud project (Supabase enabled) OR your own Supabase instance
- A **Mouser API key** (`MOUSER_API_KEY`) for supplier lookups
- A **CRON_SECRET** for the scheduled supplier-refresh webhook (if you run it)

### Environment variables

The app reads these from `.env` (Vite-injected client keys) and server secrets:

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` | Lovable Cloud backend URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` | Anon/public key (RLS applies) |
| `VITE_SUPABASE_PROJECT_ID` | `.env` | Project id (preview auth storage) |
| `SUPABASE_URL` | secret | Server-side backend URL |
| `SUPABASE_PUBLISHABLE_KEY` | secret | Server publishable-key reads (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | Admin client — bypasses RLS (privileged ops only) |
| `MOUSER_API_KEY` | secret | Mouser part lookup + datasheet resolution |
| `CRON_SECRET` | secret | Timing-safe auth for the refresh webhook |

Add secrets through the project's secret manager so they are injected into
server functions at runtime — never commit them to `.env`.

### Run locally

```bash
bun install
bun run dev          # Vite dev server (http://localhost:8080)
```

### Build

```bash
bun run build        # production build
bun run build:dev    # dev-mode build (prerender without a session)
```

### Test

```bash
bunx vitest run       # all unit + route tests
```

Covers: cron-secret auth (valid/missing/invalid `x-cron-secret` and `Bearer`),
refresh-supplier-data route 401/403/200 paths with mocked Supabase + Mouser,
Mouser payload parsing edge cases, and datasheet fallback behavior.

---

## Authentication & access control

### Sign-in methods

- **Email/password** sign-up & sign-in on `/auth`, plus **Google OAuth**
  (brokered through Lovable).
- **One-click demo accounts** — the `/auth` page has a "Try the portal instantly"
  panel with four buttons (Admin, Purchase, Storekeeper, Member). Clicking one
  calls the `ensureDemoAccount` server function, which creates (or repairs) the
  auth user, sets a known password, upserts the profile, and assigns exactly that
  role via the service-role admin client, then signs the browser in. Demo
  credentials: `demo.{role}@partsbench.test` / `PartsBenchDemo!2026`.

### Auth architecture

- Auth state is managed in `src/hooks/useAuth.tsx` (session + role).
- The Supabase session is stored in `localStorage` (browser client); the
  managed `src/routes/_authenticated/route.tsx` layout uses `ssr: false` and a
  client-only `beforeLoad` that calls `supabase.auth.getUser()` and redirects to
  `/auth` when there is no user. Every authenticated route lives under
  `_authenticated/`, so child routes need no per-page auth gate.
- A `functionMiddleware` (`attachSupabaseAuth`) in `src/start.ts` attaches the
  Supabase bearer token to every `createServerFn` call so protected server
  functions receive an authenticated context.
- `onAuthStateChange` is wired once in `__root.tsx`, filtered to identity
  transitions (`SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED`) to avoid cache thrash.

### Role system

Roles live in a dedicated `public.user_roles` table — **never** on the profile
table — and are checked server-side via a `SECURITY DEFINER` `has_role()`
function.

```sql
create type public.app_role as enum ('admin', 'member', 'purchase', 'storekeeper');
```

| Role | Capabilities |
| --- | --- |
| `admin` | Full access to everything — inventory, settings, procurement, inwarding. |
| `member` | Read/write inventory, assignments, PCB tasks, substitutes, BOM. |
| `purchase` | Create/edit vendors and purchase orders (`can_purchase`). |
| `storekeeper` | Record goods receipts / inwarding (`can_inward`). |

A `handle_new_user()` trigger creates a profile row and assigns the first user
`admin`, every subsequent user `member`.

Helper security-definer functions:

- `has_role(_user_id, _role)` — base role check used by all RLS policies.
- `can_purchase(_uid)` — `has_role(uid,'admin') OR has_role(uid,'purchase')`.
- `can_inward(_uid)` — `has_role(uid,'admin') OR has_role(uid,'purchase') OR has_role(uid,'storekeeper')`.

All public-schema tables use **Row-Level Security** with explicit `GRANT`
statements (per Lovable Cloud requirements). Public reads are limited to
shared-BOM tokens via a server function using the admin client.

---

## Portal flow & features

### 1. Inventory (`/`)

The main dashboard — every component across all categories.

- **Filter bar** — single responsive row: full-width search box, category
  filter, stock status filter, project filter, low-stock toggle. On desktop it
  shows labelled selects; on mobile it collapses to a horizontally scrollable
  icon-only strip with tooltips, active highlighting, and a clear-all button.
- **Component table** — part number, name, manufacturer, footprint, category,
  total on-hand (summed across locations), stock-status badge, substitutes
  count, and compact rating tags (₹ cost, ⚡ voltage, 🔌 current, 🌡 temperature).
- **Add / edit component** (`ComponentFormDialog.tsx`) — name (mirrors `value`),
  footprint (mirrors `package_case`), manufacturer, part number, category, cost,
  voltage / current / temperature ratings, supplier + supplier URL, datasheet
  URL, low-stock threshold, notes, specs, alternates, image.
  - **Supplier lookup** auto-fills name, manufacturer, package, specs, cost,
    image, supplier URL, and datasheet from **Mouser** by MPN.
  - **AI category classification** — after lookup, Gemini predicts the deepest
    matching category and preselects it automatically (with a toast), still
    manually changeable.
  - **Datasheet resolution** — prefers a direct/manufacturer PDF URL; falls back
    to a Gemini-powered datasheet search when Mouser has none. Resolved URLs are
    cached 30 days (DB `datasheet_cache` + in-process LRU). Preview renders
    inline via a server-side proxy + PDF.js canvas viewer, bypassing CORS,
    `X-Frame-Options`, and bot blocks. Validated PDF bytes are cached in a
    private `datasheet-cache` storage bucket.
  - **AI datasheet search dialog** — search for a datasheet by MPN/manufacturer
    when none is auto-detected; candidate PDFs are HEAD/GET-verified before being
    offered.

### 2. Categories (`/settings/categories`)

- Hierarchical categories with parent/subcategories, icons, sort order.
- Subcategories in the sidebar are collapsed by default, expand on chevron
  click, and auto-expand when a child category route is active.
- Selecting a parent category shows items from all descendants.
- **Reassign before delete** — components are moved to a chosen category before
  a category is deleted; an `Uncategorized` fallback + `ON DELETE SET DEFAULT`
  + a `prevent_uncategorized_category_delete` trigger prevents orphaned
  components.

### 3. Locations (`/locations`)

- Every physical storage location per component (`location_type` + `label` +
  `quantity`).
- Stock-adjust dialog to add/remove stock, with every change written to
  `stock_history` for a full audit trail.

### 4. Assignments (`/assignments`)

- Assign components (and specific quantities/locations) to R&D team members and
  projects, singly or as a **bundle** with a common assignment-batch ID.
- Bundle assignment: tick several parts in inventory → "Assign bundle" → pick a
  project from the projects list and optionally add more parts by searching
  inside the assign dialog. Each bundle shows as its own card with a "Return
  all" button; single items can still be returned one at a time.
- Track assigned vs. returned quantities, status, notes, project name.
- Returning stock restores it and logs to history.

### 5. R&D Team (`/rd-team`)

- Manage R&D team members (name, email, role, active flag).
- Members are the assignees for component assignments and PCB tasks.

### 6. Projects (`/settings/projects`)

- Manage projects (name, code, color, status active/archived, revision, design
  link).
- Components can be linked to multiple projects via `component_projects`.

### 7. History (`/history`)

- Activity log of every stock movement (add / remove / assign / return /
  inward-purchase), ordered newest-first with component and location context.

### 8. PCB repair board (`/pcb`)

- Kanban-style board for PCB repair tasks: Received → In Progress → Waiting on
  Parts → Repaired / Failed / Scrapped / Returned.
- Each task: board photo (private `pcb-photos` storage bucket), project,
  assignee, priority, root cause (required for `repaired`/`failed` — enforced by
  a `pcb_tasks_require_root_cause` trigger), notes, status, timestamps.
- Status changes are logged to `pcb_task_history` by a trigger.
- Detail view + create/edit dialog. Open-task count badge in the sidebar.

### 9. BOM import & export (`/bom`)

- **Import** a BOM from `.csv`, `.xlsx`/`.xls`, or pasted CSV text.
- **Column mapping** step — the app guesses MPN / manufacturer / quantity /
  reference designators / description / footprint; correctable via dropdowns.
- **Matching** runs per line and produces one of:
  - **Exact** — part number matches a stocked component (case/whitespace
    insensitive, ignoring distributor prefixes like `511-`).
  - **Close** — same manufacturer + normalized MPN, or differs only by packaging
    suffix (`-T`, `+T`, `/TR`, reel codes).
  - **Substitute** — no direct match, but a linked substitute or
    same-footprint/same-value part is in stock (ranked by availability).
  - **Missing** — nothing in inventory.
- Results table: reference designators, MPN, qty needed, matched component,
  on-hand qty, shortage, status badge, and a picker to override the match.
- **Actions**: save substitute links (writes two-way links into the substitutes
  system), export shortage list (CSV), export matched BOM (CSV/Excel), export
  current inventory (CSV/Excel).
- **Sample template** — download a sample CSV/Excel or load four example lines
  instantly to see the import flow.
- **Generate PO from shortages** — one button collects every missing/short line
  and opens the Create PO dialog pre-filled (see Procurement below).

### 10. Substitutes / BOM compatibility

- Link real substitute components (drop-in replacements) to any component —
  two-way links (adding B to A shows A on B).
- Optional note per link (e.g. "same footprint, 10% tolerance difference").
- Inventory table shows a substitutes badge; out-of-stock parts surface
  "N substitutes in stock" so you immediately know what to use instead.
- External free-text cross-reference field kept for parts you don't stock.

### 11. BOM share / export for selected components

- **Select** components via checkboxes in the inventory table (header checkbox
  selects all filtered), or by project.
- **Sticky action bar** appears when ≥1 selected: Export CSV · Export Excel ·
  Copy · Share link · Clear.
- Each export row includes part number, name, manufacturer, footprint,
  category, on-hand qty, stock status, **substitutes joined into one cell**
  (`MPN — Manufacturer (qty 120, in stock) — note`), substitutes-in-stock count,
  supplier URL, datasheet URL. Out-of-stock substitutes are flagged, not
  dropped.
- **Share** three ways:
  1. **Download** — CSV or formatted Excel (bold header, frozen top row, sized
     columns).
  2. **Copy to clipboard** — markdown table for email/chat.
  3. **Read-only share link** — a tokenized snapshot stored in `shared_boms`
     with optional expiry (7/30 days/never) and revocation. Recipients open
     `/share/<token>` without logging in; the snapshot is frozen at share time.

### 12. Procurement & purchase management

A full procurement module: vendors → purchase orders → goods receipt (GRN) with
automatic stock increment and audit trail.

**Purchase Orders** (`/procurement/orders`)

- Summary cards: open POs, pending inwarding, total ordered value (₹), overdue
  deliveries.
- One filter row: search by PO number or vendor, status filter, date range.
- **Create PO dialog** — pick a vendor (or add one inline), expected delivery
  date, then search parts by part number/name. Selecting a part fills MPN,
  current cost (`components.cost`) and on-hand quantity; you set quantity and
  confirm unit price. Subtotal, optional 18% GST toggle, and total update live.
  PO number auto-generated as `PO-YYYY-XXXX`.
- **PO detail view** — status badge, "Mark as sent" (DRAFT → SENT), "Download
  PO PDF" (print-styled HTML via `window.print()` — vendor address, line items,
  totals, authorized signatory line), and "Receive shipment (GRN)".
- On the BOM page, "Generate PO from shortages" pre-fills the dialog.

**Inwarding / GRN** (`/procurement/inward`)

- **Create GRN dialog** — pick a PO that is `SENT` or `PARTIALLY_RECEIVED`,
  enter vendor invoice number and date, then per line see ordered / already
  received and enter today's received quantity, target storage location, and
  optional lot number.
- On submit, in **one atomic database operation** (`create_grn` RPC): the GRN
  and its lines are saved, the PO lines' received counts increase, the chosen
  storage location's quantity increases (creating a `locations` row when a new
  location is entered), a `stock_history` row is written (`action =
  'inward_purchase'`, `note = 'GRN-2026-XXXX (PO-2026-XXXX)'`), and the PO flips
  to `PARTIALLY_RECEIVED` or `RECEIVED`.
- Success toast names the quantity and location, e.g. "Stock updated. 500 units
  added to Basement Store 11 - Rack B3".

**Vendors** (`/procurement/vendors`)

- Table of name, contact person, phone, email, GSTIN, payment terms and active
  PO count, with an add/edit dialog and active/inactive toggle.

**Procurement numbering & transaction safety** — `next_document_number(_kind)`
uses `pg_advisory_xact_lock` for race-free `PO-YYYY-XXXX` / `GRN-YYYY-XXXX`
sequences. `create_purchase_order` and `create_grn` are `SECURITY DEFINER`
functions that run as one transaction, gated by `can_purchase` / `can_inward`.

### 13. Voice assistant (floating, global)

- A floating mic button available on every authenticated page.
- Speech-to-text (OpenAI `gpt-4o-mini-transcribe`) → Gemini tool-calling.
- Supported actions by voice: **search components**, **check stock**, **adjust
  stock** (add/remove), **assign components** to team members/projects, **list
  projects / team members**. Always confirms before writing.

### 14. Supplier data refresh (scheduled)

- A cron-style webhook at `/api/public/hooks/refresh-supplier-data` re-resolves
  supplier specs/datasheets for stale components.
- Secured with timing-safe `CRON_SECRET` validation (`x-cron-secret` header or
  `Bearer` token) — returns 401/403 on missing/invalid tokens. Unit + route
  tests cover all paths.

---

## Architecture notes

### Server boundaries

- **App-internal logic** uses `createServerFn` from `@tanstack/react-start` with
  `requireSupabaseAuth` middleware for user-scoped writes (acts as the signed-in
  user, RLS applies).
- **External HTTP** (webhooks, cron, public share links) uses TanStack server
  routes under `src/routes/api/public/*` (this prefix bypasses site auth; the
  handler verifies the caller itself).
- **Privileged work** (demo account creation, admin role assignment, shared-BOM
  token reads) loads `supabaseAdmin` from `@/integrations/supabase/client.server`
  inside the handler with `await import(...)` to keep the service-role module
  out of client bundles.

### Data loading

- Routes use a loader calling `context.queryClient.ensureQueryData(queryOptions)`
  + `useSuspenseQuery(queryOptions)` in the component — no `useEffect` fetching or
  `useQuery` + `isLoading` spinners.
- Every route with a loader defines `errorComponent` and `notFoundComponent`.

### Supabase clients

| Entry point | Use in | Auth model | RLS |
| --- | --- | --- | --- |
| `@/integrations/supabase/client` | Components, browser hooks, realtime | Publishable key + persisted session | Respected |
| Server publishable client | Public read-only server reads | Publishable key, no session | Respected as anon |
| `requireSupabaseAuth` | Authenticated `createServerFn` handlers | Bearer token from request | Respected as user |
| `@/integrations/supabase/client.server` | Trusted privileged ops | Service role key | Bypassed |

### Datasheet proxy & caching

`/api/public/datasheet-proxy` fetches a PDF from an allowlisted host with a
browser-like User-Agent, supports HTTP `Range` requests, validates the PDF
`%%EOF` trailer, and streams it back with permissive CORS headers so PDF.js can
render it same-origin. Hosts that abort HTTP/2 mid-body are re-fetched with
byte-range requests. Validated PDFs are cached in the private `datasheet-cache`
storage bucket (30-day TTL) so repeat previews are instant.

### Runtime constraints

Server functions run on a Cloudflare Worker runtime (`nodejs_compat`).
`child_process`, `sharp`, `canvas`, and `fs.watch` are unavailable; pure-JS /
Web-standard APIs are used throughout.

---

## Key file map

| Area | Files |
| --- | --- |
| Inventory view | `src/components/inventory/InventoryView.tsx` |
| Component form | `src/components/inventory/ComponentFormDialog.tsx` |
| Sidebar + categories | `src/components/inventory/AppSidebar.tsx`, `src/routes/_authenticated/settings.categories.tsx` |
| Assignments + bundles | `src/routes/_authenticated/assignments.tsx`, `src/components/inventory/AssignDialog.tsx` |
| Locations / stock adjust | `src/routes/_authenticated/locations.tsx`, `src/components/inventory/StockAdjustDialog.tsx` |
| R&D team | `src/routes/_authenticated/rd-team.tsx` |
| Projects | `src/routes/_authenticated/settings.projects.tsx`, `src/lib/projects.ts` |
| History | `src/routes/_authenticated/history.tsx` |
| PCB board | `src/routes/_authenticated/pcb.tsx`, `src/lib/pcb.ts`, `src/components/pcb/*` |
| BOM import/export | `src/routes/_authenticated/bom.tsx`, `src/lib/bom.ts` |
| Substitutes | `src/lib/substitutes.ts`, `src/components/inventory/SubstitutePicker.tsx` |
| BOM share | `src/lib/bom-share.ts`, `src/lib/shared-boms.ts`, `src/lib/shared-bom.functions.ts`, `src/components/inventory/ShareSelectionBar.tsx`, `src/components/inventory/ShareLinkDialog.tsx`, `src/routes/share.$token.tsx` |
| Procurement | `src/lib/procurement.ts`, `src/lib/procurement.functions.ts`, `src/routes/_authenticated/procurement.{orders,inward,vendors}.tsx`, `src/components/procurement/{CreatePODialog,PODetailView,CreateGRNDialog,VendorDialog}.tsx` |
| Demo accounts | `src/lib/demo-auth.functions.ts`, `src/routes/auth.tsx` |
| Voice assistant | `src/lib/voice-assistant.functions.ts`, `src/components/inventory/VoiceAssistant.tsx` |
| Supplier lookup (Mouser) | `src/lib/nexar.server.ts`, `src/lib/supplier.functions.ts` |
| Datasheet proxy + cache | `src/routes/api/public/datasheet-proxy.ts`, `src/lib/nexar.server.ts` |
| Cron auth | `src/lib/cron-auth.ts`, `src/routes/api/public/hooks/refresh-supplier-data.ts` |
| Category AI match | `src/lib/category-match.server.ts` |
| Auth | `src/routes/auth.tsx`, `src/hooks/useAuth.tsx`, `src/routes/_authenticated/route.tsx`, `src/integrations/supabase/auth-middleware.ts`, `src/integrations/supabase/auth-attacher.ts` |

---

## Database overview

Core tables (all with RLS + explicit `GRANT`s):

- `categories` — hierarchical component categories (self-referencing parent).
- `components` — parts with specs, ratings (`voltage_rating`, `current_rating`,
  `temperature_rating`), `cost`, supplier/datasheet links, image, low-stock
  threshold. `category_id` defaults to an `Uncategorized` fallback.
- `locations` — physical storage per component (`component_id`,
  `location_type`, `label`, `quantity`).
- `stock_history` — audit log of every stock movement (`component_id`,
  `location_id`, `delta`, `action`, `note`, `user_id`, `user_email`).
  `action` values include `inward_purchase`.
- `assignments` + `assignment_batches` — component → team member / project
  assignments with returns, optionally grouped under a bundle.
- `rd_members` — R&D team members (assignees).
- `projects` + `component_projects` — projects and their linked components.
- `component_substitutes` — two-way substitute links with notes.
- `shared_boms` — tokenized BOM snapshots (title, payload, expiry, revocation).
- `datasheet_cache` — resolved datasheet PDF URLs (30-day TTL).
- `user_roles` — role assignments (`admin` / `member` / `purchase` /
  `storekeeper`).
- `pcb_tasks` + `pcb_task_history` + `pcb_task_notes` + `pcb_task_photos` +
  `pcb-photos` storage bucket — PCB repair tasks, status history, notes, photos.
- **Procurement tables** — `vendors`, `purchase_orders`, `purchase_order_items`,
  `goods_receipt_notes`, `goods_receipt_items` (RLS enabled; reads for all
  authenticated; writes gated by `can_purchase` / `can_inward`).

### Database functions & triggers

| Object | Purpose |
| --- | --- |
| `has_role(_uid, _role)` | SECURITY DEFINER role check (base for all policy gates). |
| `can_purchase(_uid)` | `admin` or `purchase`. |
| `can_inward(_uid)` | `admin`, `purchase`, or `storekeeper`. |
| `next_document_number(_kind)` | Race-free `PO-YYYY-XXXX` / `GRN-YYYY-XXXX` via `pg_advisory_xact_lock`. |
| `create_purchase_order(...)` | SECURITY DEFINER — inserts PO + items, totals, in one transaction. |
| `create_grn(...)` | SECURITY DEFINER — GRN + items, increments PO received counts, increments `locations.quantity`, writes `stock_history`, recalculates PO status — all atomic. |
| `handle_new_user()` trigger | Creates profile + assigns `admin` to first user, else `member`. |
| `touch_updated_at()` trigger | Auto-updates `updated_at` on components, locations, vendors, POs, projects, PCB tasks. |
| `pcb_tasks_log_status()` trigger | Appends a `pcb_task_history` row on status change. |
| `pcb_tasks_require_root_cause()` trigger | Blocks `repaired`/`failed` without `root_cause`. |
| `prevent_uncategorized_category_delete()` trigger | Guards the Uncategorized category from deletion. |

EXECUTE on all security-definer functions is granted only to `authenticated`
and `service_role` (revoked from `PUBLIC`/`anon`).

---

## Security notes

- Roles in a dedicated table, checked server-side via `has_role()` — never via
  client storage or hardcoded checks.
- All writes authenticated; public reads limited to shared-BOM tokens resolved
  through the admin client (table closed to anon).
- Procurement writes gated by role (`can_purchase` / `can_inward`) both at the
  RLS-policy level and inside the SECURITY DEFINER RPCs.
- Cron webhook uses timing-safe secret comparison.
- PCB photo storage bucket restricts public updates/deletions.
- Datasheet proxy allowlists upstream hosts and validates PDF trailers.
- Sensitive Supabase schemas (`auth`, `storage`, `realtime`, `vault`,
  `supabase_functions`) are never modified; only `public` schema tables are
  managed via migrations.

---

_PartsBench — inventory, BOMs, substitutes, PCB tracking, procurement, and
AI-assisted part lookup in one portal._

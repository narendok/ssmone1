# Auto-pick the closest category after a part lookup

When you look up a part number in the Add/Edit Component dialog, the app will also work out which of your existing categories the part belongs to and select it automatically — no extra click.

## How it works

1. You type a part number and press the lookup button (unchanged).
2. Along with the Mouser data (name, manufacturer, package, datasheet), the server asks Lovable AI to match the part against your actual category list (names + parent names, e.g. "IC > Sensor IC").
3. The AI returns one category id, or nothing if it isn't confident.
4. The dialog selects that category and shows a small toast: "Category set to IC > Sensor IC". You can still change it manually.
5. If the AI is unsure or the call fails, the current behaviour stays (page category or first category) — the lookup never fails because of this.

Deepest match wins: if a part fits a subcategory, the subcategory is selected rather than the parent.

## Technical details

- New authenticated server function `classifyCategory` in `src/lib/supplier.functions.ts`:
  - input: mpn, manufacturer, description, category (Mouser category), package
  - loads `categories` (id, name, parent_id) through the request-scoped Supabase client, builds "Parent > Child" labels
  - single Lovable AI Gateway chat call (`google/gemini-3.5-flash`, `LOVABLE_API_KEY` read inside the handler) that must reply with one category id from the supplied list or `NONE`
  - validates the returned id against the loaded list; returns `{ categoryId: string | null }`
  - implementation helper lives in a `.server.ts` module so the functions file stays a thin wrapper
- `ComponentFormDialog.handleLookup` calls it after a successful lookup (only when creating, or when editing and the field is untouched) and applies the id via `setForm`.
- No schema or migration changes.

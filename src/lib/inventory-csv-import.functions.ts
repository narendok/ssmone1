import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rowSchema = z.object({
  idempotencyKey: z.string().uuid(),
  partNumber: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  manufacturer: z.string().trim().max(200).nullable(),
  categoryId: z.string().uuid().nullable(),
  footprint: z.string().trim().max(200).nullable(),
  quantity: z.number().int().positive(),
  locationType: z.string().trim().min(1).max(50),
  locationLabel: z.string().trim().min(1).max(200),
  lowStockThreshold: z.number().int().nonnegative(),
  supplierUrl: z.string().trim().max(2000).nullable(),
  datasheetUrl: z.string().trim().max(2000).nullable(),
});

export const approveInventoryCsvRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ rows: z.array(rowSchema).min(1).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: { partNumber: string; ok: boolean; error?: string; quantityAdded?: number; createdComponent?: boolean }[] = [];
    for (const row of data.rows) {
      const { data: result, error } = await (supabaseAdmin as any).rpc("approve_inventory_csv_row", {
        _approved_by: context.userId,
        _mpn: row.partNumber,
        _name: row.name,
        _manufacturer: row.manufacturer,
        _category_id: row.categoryId,
        _footprint: row.footprint,
        _quantity: row.quantity,
        _location_type: row.locationType,
        _location_label: row.locationLabel,
        _low_stock_threshold: row.lowStockThreshold,
        _supplier_url: row.supplierUrl,
        _datasheet_url: row.datasheetUrl,
        _idempotency_key: row.idempotencyKey,
      });
      if (error) results.push({ partNumber: row.partNumber, ok: false, error: error.message });
      else results.push({ partNumber: row.partNumber, ok: true, quantityAdded: result?.quantity_added ?? row.quantity, createdComponent: result?.created_component ?? false });
    }
    return { results };
  });
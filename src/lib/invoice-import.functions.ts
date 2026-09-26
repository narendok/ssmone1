import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InvoiceExtractResult } from "@/lib/invoice-import.server";

export type { InvoiceExtractLine, InvoiceExtractResult } from "@/lib/invoice-import.server";

export interface ApplyInvoiceLine {
  idempotency_key: string;
  component_id: string | null;
  mpn: string;
  name: string;
  manufacturer: string | null;
  category_id: string | null;
  package: string | null;
  quantity: number;
  unit_price: number | null;
  location_type: string;
  location_label: string;
}

export interface InvoicePostingResult {
  mpn: string;
  componentId: string;
  locationId: string;
  locationLabel: string;
  quantityAdded: number;
  locationQuantity: number;
  inventoryLotId: string;
  stockEventId: string;
  createdComponent: boolean;
}

function persistedInvoicePosting(result: any, line: ApplyInvoiceLine): InvoicePostingResult | null {
  const locationQuantity = Number(result?.location_quantity);
  if (
    !result?.component_id || !result?.location_id || !result?.stock_event_id || !result?.inventory_lot_id
    || !Number.isFinite(locationQuantity) || locationQuantity <= 0
  ) return null;
  return {
    mpn: line.mpn,
    componentId: result.component_id,
    locationId: result.location_id,
    locationLabel: result.location_label ?? line.location_label,
    quantityAdded: Number(result.quantity_added ?? line.quantity),
    locationQuantity,
    inventoryLotId: result.inventory_lot_id,
    stockEventId: result.stock_event_id,
    createdComponent: result.created_component ?? false,
  };
}

/** Read a purchase invoice (PDF or image) and return structured lines. */
export const extractInvoiceFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dataUrl: string; filename: string; mime: string }) => {
    if (!input?.dataUrl?.startsWith("data:")) throw new Error("A file is required");
    if (input.dataUrl.length > 24_000_000) throw new Error("That file is too large (max ~16 MB)");
    return {
      dataUrl: input.dataUrl,
      filename: (input.filename || "invoice").slice(0, 200),
      mime: (input.mime || "application/pdf").slice(0, 100),
    };
  })
  .handler(async ({ data, context }): Promise<InvoiceExtractResult> => {
    const { extractInvoice } = await import("@/lib/invoice-import.server");
    return extractInvoice(context.supabase, data);
  });

/** Create/update components, add stock, log history and record the vendor. */
export const applyInvoiceImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input) => z.object({
      vendor_name: z.string().trim().max(200).nullable(),
      invoice_number: z.string().trim().max(200).nullable(),
      invoice_date: z.string().trim().max(30).nullable(),
      currency: z.string().trim().max(8).nullable(),
      project_id: z.string().uuid().nullable(),
      enrich: z.boolean(),
      lines: z.array(z.object({
        idempotency_key: z.string().uuid(),
        component_id: z.string().uuid().nullable(),
        mpn: z.string().trim().min(1).max(200),
        name: z.string().trim().min(1).max(200),
        manufacturer: z.string().trim().max(200).nullable(),
        category_id: z.string().uuid().nullable(),
        package: z.string().trim().max(200).nullable(),
        quantity: z.number().int().positive(),
        unit_price: z.number().nonnegative().nullable(),
        location_type: z.string().trim().min(1).max(50),
        location_label: z.string().trim().min(1).max(200),
      })).min(1).max(200),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const errors: string[] = [];
    let created = 0;
    let updated = 0;
    let unitsAdded = 0;
    const postings: InvoicePostingResult[] = [];

    for (const line of data.lines) {
      const { data: result, error } = await (supabaseAdmin as any).rpc("approve_inventory_csv_row", {
        _approved_by: context.userId,
        _mpn: line.mpn,
        _name: line.name,
        _manufacturer: line.manufacturer,
        _category_id: line.category_id,
        _footprint: line.package,
        _quantity: line.quantity,
        _location_type: line.location_type,
        _location_label: line.location_label,
        _low_stock_threshold: 0,
        _supplier_url: null,
        _datasheet_url: null,
        _idempotency_key: line.idempotency_key,
      });
      if (error) {
        errors.push(`${line.mpn}: ${error.message}`);
        continue;
      }
      const posting = persistedInvoicePosting(result, line);
      if (!posting) {
        errors.push(`${line.mpn}: Stock posting did not return a positive bin quantity and stock-history event`);
        continue;
      }
      unitsAdded += posting.quantityAdded;
      if (posting.createdComponent) created++;
      else updated++;
      postings.push(posting);
    }

    return { created, updated, unitsAdded, vendorId: null, errors, postings };
  });

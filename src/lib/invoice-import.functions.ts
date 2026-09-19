import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InvoiceExtractResult } from "@/lib/invoice-import.server";

export type { InvoiceExtractLine, InvoiceExtractResult } from "@/lib/invoice-import.server";

export interface ApplyInvoiceLine {
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
    (input: {
      vendor_name: string | null;
      invoice_number: string | null;
      invoice_date: string | null;
      currency: string | null;
      project_id: string | null;
      enrich: boolean;
      lines: ApplyInvoiceLine[];
    }) => {
      if (!Array.isArray(input?.lines) || !input.lines.length) throw new Error("No lines to import");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const email = (context.claims as any)?.email ?? null;

    // Vendor (optional)
    let vendorId: string | null = null;
    if (data.vendor_name?.trim()) {
      const name = data.vendor_name.trim();
      const { data: found } = await sb.from("vendors").select("id").ilike("name", name).limit(1);
      if (found?.length) vendorId = found[0].id;
      else {
        const { data: created } = await sb.from("vendors").insert({ name }).select("id").single();
        vendorId = created?.id ?? null;
      }
    }

    // Fallback category
    const { data: cats } = await sb.from("categories").select("id, name");
    const fallbackCategory =
      (cats ?? []).find((c: any) => /^uncategorized$/i.test(c.name))?.id ?? (cats ?? [])[0]?.id ?? null;

    const noteBase = [data.invoice_number ? `Invoice ${data.invoice_number}` : "Invoice import", data.vendor_name]
      .filter(Boolean)
      .join(" · ");

    let created = 0;
    let updated = 0;
    let unitsAdded = 0;
    const errors: string[] = [];

    for (const line of data.lines) {
      try {
        const qty = Math.max(1, Math.round(line.quantity || 0));
        let componentId = line.component_id;

        if (!componentId) {
          let extra: Record<string, unknown> = {};
          if (data.enrich) {
            try {
              const { nexarLookup } = await import("@/lib/nexar.server");
              const part = await nexarLookup(line.mpn);
              if (part) {
                extra = {
                  manufacturer: line.manufacturer ?? part.manufacturer ?? null,
                  datasheet_url: part.datasheet_url ?? null,
                  image_url: part.image_url ?? null,
                  short_description: part.description ?? null,
                  package_case: line.package ?? part.package ?? null,
                  footprint: line.package ?? part.package ?? null,
                  specs: part.specs ?? null,
                };
              }
            } catch {
              /* enrichment is best-effort */
            }
          }
          const insertRow = {
            category_id: line.category_id ?? fallbackCategory,
            name: (line.name || line.mpn).slice(0, 200),
            part_number: line.mpn,
            manufacturer: line.manufacturer,
            value: (line.name || line.mpn).slice(0, 200),
            package_case: line.package,
            footprint: line.package,
            cost: line.unit_price,
            supplier: data.vendor_name,
            low_stock_threshold: 0,
            ...extra,
          };
          const { data: comp, error } = await sb.from("components").insert(insertRow).select("id").single();
          if (error) throw error;
          componentId = comp.id as string;
          created++;
        } else {
          updated++;
          if (line.unit_price != null) {
            await sb.from("components").update({ cost: line.unit_price }).eq("id", componentId);
          }
        }

        // Location: reuse an existing bin with the same type+label, else create it
        const { data: locs } = await sb
          .from("locations")
          .select("id, quantity")
          .eq("component_id", componentId)
          .eq("location_type", line.location_type)
          .eq("label", line.location_label)
          .limit(1);
        let locationId: string;
        if (locs?.length) {
          locationId = locs[0].id;
          await sb.from("locations").update({ quantity: (locs[0].quantity ?? 0) + qty }).eq("id", locationId);
        } else {
          const { data: loc, error } = await sb
            .from("locations")
            .insert({
              component_id: componentId,
              location_type: line.location_type,
              label: line.location_label,
              quantity: qty,
            })
            .select("id")
            .single();
          if (error) throw error;
          locationId = loc.id as string;
        }

        await sb.from("stock_history").insert({
          component_id: componentId,
          location_id: locationId,
          delta: qty,
          action: "inward_purchase",
          note: noteBase,
          user_id: context.userId,
          user_email: email,
        });

        if (data.project_id) {
          await sb
            .from("component_projects")
            .upsert({ component_id: componentId, project_id: data.project_id }, { onConflict: "component_id,project_id" });
        }

        unitsAdded += qty;
      } catch (e: any) {
        errors.push(`${line.mpn}: ${e?.message ?? "failed"}`);
      }
    }

    return { created, updated, unitsAdded, vendorId, errors };
  });

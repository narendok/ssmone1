import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const locationSchema = z.object({
  id: z.string().uuid().optional(),
  locationType: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(200),
  quantity: z.number().int().nonnegative(),
  delete: z.boolean().optional(),
});

const componentSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  partNumber: z.string().trim().min(1).max(200),
  manufacturer: z.string().trim().max(200).nullable(),
  footprint: z.string().trim().max(200).nullable(),
  bomCompatibility: z.string().trim().max(1000).nullable(),
  voltageRating: z.string().trim().max(200).nullable(),
  currentRating: z.string().trim().max(200).nullable(),
  temperatureRating: z.string().trim().max(200).nullable(),
  cost: z.number().nonnegative().nullable(),
  supplier: z.string().trim().max(200).nullable(),
  supplierUrl: z.string().trim().max(2000).nullable(),
  datasheetUrl: z.string().trim().max(2000).nullable(),
  notes: z.string().trim().max(5000).nullable(),
  lowStockThreshold: z.number().int().nonnegative(),
  stockReason: z.string().trim().min(3).max(1000),
  locations: z.array(locationSchema).max(30),
});

type SaveInput = z.infer<typeof componentSchema>;

function componentPayload(data: SaveInput) {
  return {
    category_id: data.categoryId,
    name: data.name,
    value: data.name,
    part_number: data.partNumber,
    manufacturer: data.manufacturer,
    footprint: data.footprint,
    package_case: data.footprint,
    bom_compatibility: data.bomCompatibility,
    voltage_rating: data.voltageRating,
    current_rating: data.currentRating,
    temperature_rating: data.temperatureRating,
    cost: data.cost,
    supplier: data.supplier,
    supplier_url: data.supplierUrl,
    datasheet_url: data.datasheetUrl,
    notes: data.notes,
    low_stock_threshold: data.lowStockThreshold,
  };
}

export const saveComponentWithStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => componentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: permissionError } = await context.supabase.rpc("has_any_permission", {
      _user_id: context.userId,
      _permission_keys: ["inventory.manage", "procurement.manage"],
    });
    const { data: isAdmin, error: adminError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (permissionError || adminError || (!allowed && !isAdmin)) throw new Error("You do not have permission to change inventory.");

    const payload = componentPayload(data);
    let componentId = data.id;

    if (componentId) {
      if (!componentId) throw new Error("Component could not be created.");
      const { error } = await context.supabase.from("components").update(payload).eq("id", componentId);
      if (error) throw new Error(error.message);
    } else {
      const firstStockedLocation = data.locations.find((location) => !location.delete && location.quantity > 0);
      if (firstStockedLocation) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: posted, error } = await (supabaseAdmin as any).rpc("approve_inventory_csv_row", {
          _approved_by: context.userId,
          _mpn: data.partNumber,
          _name: data.name,
          _manufacturer: data.manufacturer,
          _category_id: data.categoryId,
          _footprint: data.footprint,
          _quantity: firstStockedLocation.quantity,
          _location_type: firstStockedLocation.locationType,
          _location_label: firstStockedLocation.label,
          _low_stock_threshold: data.lowStockThreshold,
          _supplier_url: data.supplierUrl,
          _datasheet_url: data.datasheetUrl,
          _idempotency_key: crypto.randomUUID(),
        });
        if (error || !posted?.component_id || !posted?.location_id || !posted?.stock_event_id || Number(posted?.location_quantity) <= 0) {
          throw new Error(error?.message ?? "Initial stock was not posted successfully.");
        }
        componentId = posted.component_id;
      } else {
        const { data: created, error } = await context.supabase.from("components").insert(payload).select("id").single();
        if (error || !created) throw new Error(error?.message ?? "Component could not be created.");
        componentId = created.id;
      }
      if (!componentId) throw new Error("Component could not be created.");
      const { error } = await context.supabase.from("components").update(payload).eq("id", componentId);
      if (error) throw new Error(error.message);
    }

    if (!componentId) throw new Error("Component could not be saved.");
    const { data: savedLocations, error: locationReadError } = await context.supabase
      .from("locations")
      .select("id, quantity")
      .eq("component_id", componentId);
    if (locationReadError) throw new Error(locationReadError.message);
    const savedById = new Map((savedLocations ?? []).map((location) => [location.id, location]));

    for (const location of data.locations) {
      if (location.delete && location.id) {
        const existing = savedById.get(location.id);
        if (existing && Number(existing.quantity) > 0) throw new Error("Remove stock through Stock adjustment before removing a storage location.");
        const { error } = await context.supabase.rpc("manage_component_location", {
          _approved_by: context.userId,
          _component_id: componentId,
          _location_id: location.id,
          _location_type: location.locationType,
          _location_label: location.label,
          _delete: true,
        });
        if (error) throw new Error(error.message);
        continue;
      }
      if (location.delete) continue;

      if (location.id) {
        const existing = savedById.get(location.id);
        if (!existing) throw new Error("The selected storage location no longer exists. Refresh and try again.");
        const delta = location.quantity - Number(existing.quantity);
        const { error: detailsError } = await context.supabase.rpc("manage_component_location", {
          _approved_by: context.userId,
          _component_id: componentId,
          _location_id: location.id,
          _location_type: location.locationType,
          _location_label: location.label,
          _delete: false,
        });
        if (detailsError) throw new Error(detailsError.message);
        if (delta !== 0) {
          const { error } = await context.supabase.rpc("post_stock_adjustment", {
            _component_id: componentId,
            _location_id: location.id,
            _delta: delta,
            _reason: data.stockReason,
            _idempotency_key: crypto.randomUUID(),
          });
          if (error) throw new Error(error.message);
        }
        continue;
      }

      if (location.quantity > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: posted, error } = await (supabaseAdmin as any).rpc("approve_inventory_csv_row", {
          _approved_by: context.userId,
          _mpn: data.partNumber,
          _name: data.name,
          _manufacturer: data.manufacturer,
          _category_id: data.categoryId,
          _footprint: data.footprint,
          _quantity: location.quantity,
          _location_type: location.locationType,
          _location_label: location.label,
          _low_stock_threshold: data.lowStockThreshold,
          _supplier_url: data.supplierUrl,
          _datasheet_url: data.datasheetUrl,
          _idempotency_key: crypto.randomUUID(),
        });
        if (error || !posted?.location_id || !posted?.stock_event_id || Number(posted?.location_quantity) <= 0) {
          throw new Error(error?.message ?? "Stock was not posted successfully.");
        }
      } else {
        const { error } = await context.supabase.rpc("manage_component_location", {
          _approved_by: context.userId,
          _component_id: componentId,
          _location_id: null,
          _location_type: location.locationType,
          _location_label: location.label,
          _delete: false,
        });
        if (error) throw new Error(error.message);
      }
    }

    return { componentId };
  });
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SupplierSpec { name: string; value: string; }
export interface SupplierAlternate {
  id: string;
  mpn: string;
  manufacturer: string | null;
  description: string | null;
  image_url: string | null;
  url: string | null;
}
export interface SupplierPart {
  id: string;
  mpn: string;
  manufacturer: string | null;
  description: string | null;
  package: string | null;
  image_url: string | null;
  datasheet_url: string | null;
  octopart_url: string | null;
  category: string | null;
  specs: SupplierSpec[];
  alternates: SupplierAlternate[];
}

export const supplierLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mpn: string }) => {
    if (!input?.mpn || typeof input.mpn !== "string") throw new Error("mpn required");
    return { mpn: input.mpn.trim() };
  })
  .handler(async ({ data }) => {
    const { nexarLookup } = await import("@/lib/nexar.server");
    const part = await nexarLookup(data.mpn);
    if (!part) return { found: false as const };
    return { found: true as const, part };
  });

export interface DatasheetCandidate {
  url: string;
  label: string;
  verified: boolean;
}

export const datasheetAiSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => {
    if (!input?.query || typeof input.query !== "string") throw new Error("query required");
    const query = input.query.trim().slice(0, 200);
    if (!query) throw new Error("query required");
    return { query };
  })
  .handler(async ({ data }) => {
    const { aiSearchDatasheets } = await import("@/lib/nexar.server");
    return { results: (await aiSearchDatasheets(data.query)) as DatasheetCandidate[] };
  });

export const classifyCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      mpn: string;
      manufacturer?: string | null;
      description?: string | null;
      category?: string | null;
      package?: string | null;
    }) => {
      if (!input?.mpn || typeof input.mpn !== "string") throw new Error("mpn required");
      const clip = (v: unknown) =>
        typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null;
      return {
        mpn: input.mpn.trim().slice(0, 120),
        manufacturer: clip(input.manufacturer),
        description: clip(input.description),
        category: clip(input.category),
        package: clip(input.package),
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { classifyPartCategory } = await import("@/lib/category-match.server");
    return classifyPartCategory(context.supabase, data);
  });


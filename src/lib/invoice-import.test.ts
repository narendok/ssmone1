import { describe, expect, it } from "vitest";
import { z } from "zod";

const invoiceLineSchema = z.object({
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
});

describe("purchase stock approval", () => {
  it("requires a retry-stable request key for each stock line", () => {
    expect(() => invoiceLineSchema.parse({
      component_id: null, mpn: "KG200ZABTB", name: "KG200Z", manufacturer: null,
      category_id: "b41f59bf-6a54-40c2-a4f2-290492cc8a07", package: null,
      quantity: 10, unit_price: null, location_type: "basement", location_label: "Store 11",
    })).toThrow();
  });

  it("accepts a complete, idempotent stock approval line", () => {
    expect(invoiceLineSchema.parse({
      idempotency_key: "3c701f4e-4ca2-418d-9735-3d5e6b2bd21c",
      component_id: "204fa42a-b463-4e30-8bd1-55f6f837211a",
      mpn: "KG200ZABTB", name: "KG200Z", manufacturer: null,
      category_id: "b41f59bf-6a54-40c2-a4f2-290492cc8a07", package: null,
      quantity: 10, unit_price: null, location_type: "basement", location_label: "Store 11",
    }).mpn).toBe("KG200ZABTB");
  });
});
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261005183103_2157aab7-4509-46b0-bc31-4d5f6e7785d0.sql", "utf8");
const hardening = readFileSync("supabase/pending/20261006_master_specification_controlled_mutation_hardening.sql", "utf8");
const acceptance = readFileSync("supabase/pending/tests/master_specification_direct_write_acceptance.sql", "utf8");

describe("Master Specification controlled mutation contract", () => {
  it("records the current direct-write bypass until the compatible hardening is accepted", () => {
    expect(migration).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_specifications TO authenticated;");
    expect(migration).toContain('CREATE POLICY "Sales users manage master specifications"');
    expect(migration).toContain("GRANT SELECT, INSERT ON public.master_specification_versions TO authenticated;");
    expect(migration).toContain('CREATE POLICY "Sales users append master specification versions"');
  });

  it("keeps direct-write revocation coupled to a tested controlled entry point", () => {
    expect(hardening).toContain("REVOKE INSERT, UPDATE, DELETE ON TABLE public.master_specifications FROM authenticated;");
    expect(hardening).toContain("REVOKE INSERT, UPDATE, DELETE ON TABLE public.master_specification_versions FROM authenticated;");
    expect(hardening).toContain("master_specification_write_guard");
    expect(hardening).toContain("save_master_specification_version");
    expect(hardening).toContain("stay unapplied until");
  });

  it("requires denial proofs for direct header, pointer, and revision writes plus source mismatch rollback", () => {
    expect(acceptance).toContain("DIRECT-WRITE-MUST-FAIL");
    expect(acceptance).toContain("SET current_version = current_version + 1");
    expect(acceptance).toContain("Direct insert must fail");
    expect(acceptance).toContain("wrong_customer_id");
    expect((acceptance.match(/^ROLLBACK;$/gm) ?? [])).toHaveLength(4);
  });
});
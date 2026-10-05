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
    expect(hardening).toContain("SECURITY DEFINER");
    expect(hardening).toContain("v_actor_id uuid := auth.uid()");
    expect(hardening).toContain("public.has_permission(v_actor_id, 'sales.manage')");
    expect(hardening).toContain("FOR UPDATE");
    expect(hardening).toContain("INSERT INTO public.activity_log");
    expect(hardening).toContain("master_specification_direct_write_guard");
    expect(hardening).toContain("save_master_specification_version");
    expect(hardening).toContain("Do not apply until isolated");
  });

  it("requires controlled-save, conflict, direct-write, and audit rollback acceptance", () => {
    expect(acceptance).toContain("Acceptance controlled save");
    expect(acceptance).toContain("DIRECT-WRITE-MUST-FAIL");
    expect(acceptance).toContain("SET current_version = current_version + 1");
    expect(acceptance).toContain("DELETE FROM public.master_specifications");
    expect(acceptance).toContain("Direct insert must fail");
    expect(acceptance).toContain("wrong_customer_id");
    expect(acceptance).toContain("Stale concurrent writer");
    expect(acceptance).toContain("Audit rollback must fail");
    expect((acceptance.match(/^ROLLBACK;$/gm) ?? [])).toHaveLength(7);
  });
});
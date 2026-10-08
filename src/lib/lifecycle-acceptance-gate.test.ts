import { expect, it } from "vitest";
import { lifecycleAcceptanceEnabled } from "./lifecycle-acceptance-gate";
it("defaults closed and refuses the company backend even with an opt-in", () => {
  expect(lifecycleAcceptanceEnabled("https://egjotuxqguifnvdnflan.supabase.co", undefined)).toBe(false);
  expect(lifecycleAcceptanceEnabled("https://yyrvduosyyaluifqvwkr.supabase.co", "isolated-accepted")).toBe(false);
  expect(lifecycleAcceptanceEnabled("https://egjotuxqguifnvdnflan.supabase.co", "isolated-accepted")).toBe(true);
});
it.each([
  "https://egjotuxqguifnvdnflan.extra.supabase.co",
  "https://egjotuxqguifnvdnflan.supabase.co.attacker.test",
  "http://egjotuxqguifnvdnflan.supabase.co",
  "https://user:password@egjotuxqguifnvdnflan.supabase.co",
  "https://egjotuxqguifnvdnflan.supabase.co:8443",
  "https://egjotuxqguifnvdnflan.supabase.co/path",
  "https://egjotuxqguifnvdnflan.supabase.co?override=true",
  "https://egjotuxqguifnvdnflan.supabase.co#fragment",
  "not-a-url",
])("rejects non-canonical configuration %s", (url) => {
  expect(lifecycleAcceptanceEnabled(url, "isolated-accepted")).toBe(false);
});

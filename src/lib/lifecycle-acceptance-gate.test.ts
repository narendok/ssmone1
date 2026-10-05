import { expect, it } from "vitest";
import { lifecycleAcceptanceEnabled } from "./lifecycle-acceptance-gate";
it("defaults closed and refuses the company backend even with an opt-in", () => {
  expect(lifecycleAcceptanceEnabled("https://egjotuxqguifnvdnflan.supabase.co", undefined)).toBe(false);
  expect(lifecycleAcceptanceEnabled("https://yyrvduosyyaluifqvwkr.supabase.co", "isolated-accepted")).toBe(false);
  expect(lifecycleAcceptanceEnabled("https://egjotuxqguifnvdnflan.supabase.co", "isolated-accepted")).toBe(true);
});
it.each(["http://egjotuxqguifnvdnflan.supabase.co", "https://egjotuxqguifnvdnflan.supabase.co.attacker.test", "https://egjotuxqguifnvdnflan.supabase.co/path", "https://egjotuxqguifnvdnflan.supabase.co?override=true", "not-a-url"])("rejects mismatched configuration %s", (url) => {
  expect(lifecycleAcceptanceEnabled(url, "isolated-accepted")).toBe(false);
});

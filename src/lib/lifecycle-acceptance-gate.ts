const isolatedBackend = "egjotuxqguifnvdnflan.supabase.co";

/** Explicit isolated-only opt-in. Never authorizes a user or opens production. */
export function lifecycleAcceptanceEnabled(url: string | undefined, enabled: string | undefined) {
  if (enabled !== "isolated-accepted") return false;
  try {
    const parsed = new URL(url ?? "");
    return parsed.protocol === "https:" && parsed.host === isolatedBackend && !parsed.username && !parsed.password
      && parsed.pathname === "/" && !parsed.search && !parsed.hash;
  } catch { return false; }
}

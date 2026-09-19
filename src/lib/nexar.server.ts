// Mouser Search API client — server-only.
// Replaces the previous Nexar/Octopart integration. The export name
// `nexarLookup` is kept to avoid churn across callers and tests; it now
// resolves part data via Mouser's free Search API.
//
// Docs: https://api.mouser.com/api/docs/ui/index

const SEARCH_URL = "https://api.mouser.com/api/v1/search/partnumber";

// Datasheet cache TTL — entries older than this are re-resolved.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface NexarSpec { name: string; value: string }
export interface NexarAlternate {
  id: string;
  mpn: string;
  manufacturer: string | null;
  description: string | null;
  image_url: string | null;
  url: string | null;
}
export interface NexarPart {
  id: string;
  mpn: string;
  manufacturer: string | null;
  description: string | null;
  package: string | null;
  image_url: string | null;
  datasheet_url: string | null;
  octopart_url: string | null; // kept for schema compatibility; holds Mouser product URL
  category: string | null;
  specs: NexarSpec[];
  alternates: NexarAlternate[];
}

interface MouserAttribute { AttributeName?: string; AttributeValue?: string }
interface MouserPart {
  MouserPartNumber?: string;
  ManufacturerPartNumber?: string;
  Manufacturer?: string;
  Description?: string;
  ImagePath?: string;
  DataSheetUrl?: string;
  ProductDetailUrl?: string;
  Category?: string;
  ProductAttributes?: MouserAttribute[];
}

// ---- Datasheet cache ---------------------------------------------------------
// Persistent cache in `datasheet_cache` (DB) + an in-process LRU on top for
// bursty repeats within a single request batch (e.g. the refresh cron).

type CacheEntry = { url: string | null; resolvedAt: number };
const MEM_CACHE_MAX = 200;
const memCache = new Map<string, CacheEntry>();
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function cacheKey(mpn: string, manufacturer: string | null): string {
  return `${(manufacturer ?? "").toLowerCase()}::${mpn.toLowerCase()}`;
}

function memGet(key: string): CacheEntry | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.resolvedAt > CACHE_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  // Refresh LRU order.
  memCache.delete(key);
  memCache.set(key, hit);
  return hit;
}

function memSet(key: string, entry: CacheEntry): void {
  if (memCache.has(key)) memCache.delete(key);
  memCache.set(key, entry);
  if (memCache.size > MEM_CACHE_MAX) {
    const oldest = memCache.keys().next().value;
    if (oldest !== undefined) memCache.delete(oldest);
  }
}

/** Read a cached datasheet URL. Returns `undefined` on miss/stale/error,
 *  `null` for a cached negative result, or the cached URL string. */
async function getCachedDatasheet(
  mpn: string,
  manufacturer: string | null,
): Promise<string | null | undefined> {
  const key = cacheKey(mpn, manufacturer);
  const mem = memGet(key);
  if (mem) return mem.url;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("datasheet_cache")
      .select("datasheet_url, resolved_at")
      .eq("mpn", mpn)
      .eq("manufacturer", manufacturer ?? "")
      .maybeSingle();
    if (error || !data) return undefined;
    const resolvedAt = new Date(data.resolved_at).getTime();
    if (Number.isNaN(resolvedAt) || Date.now() - resolvedAt > CACHE_TTL_MS) {
      return undefined; // stale → miss
    }
    memSet(key, { url: data.datasheet_url, resolvedAt });
    return data.datasheet_url;
  } catch {
    return undefined;
  }
}

async function setCachedDatasheet(
  mpn: string,
  manufacturer: string | null,
  url: string | null,
  source: "mouser" | "duckduckgo" | "manufacturer" | "none",
): Promise<void> {
  const key = cacheKey(mpn, manufacturer);
  memSet(key, { url, resolvedAt: Date.now() });
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("datasheet_cache").upsert(
      {
        mpn,
        manufacturer: manufacturer ?? "",
        datasheet_url: url,
        source,
        resolved_at: new Date().toISOString(),
      },
      { onConflict: "mpn,manufacturer" },
    );
  } catch {
    // Cache write failures must never break the lookup.
  }
}

/** Test-only helper to reset the in-process LRU between tests. */
export function __resetDatasheetMemCache(): void {
  memCache.clear();
}

// -----------------------------------------------------------------------------

export async function nexarLookup(mpn: string): Promise<NexarPart | null> {
  const apiKey = process.env.MOUSER_API_KEY;
  if (!apiKey) throw new Error("MOUSER_API_KEY missing");

  const res = await fetch(`${SEARCH_URL}?apiKey=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      SearchByPartRequest: {
        mouserPartNumber: mpn,
        partSearchOptions: "Exact",
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Mouser API error ${res.status}: ${txt}`);
  }
  const json = (await res.json()) as {
    Errors?: Array<{ Message?: string; Code?: string }>;
    SearchResults?: { NumberOfResult?: number; Parts?: MouserPart[] };
  };
  if (json.Errors?.length) {
    throw new Error(json.Errors.map((e) => e.Message || e.Code || "Mouser error").join("; "));
  }
  const parts = json.SearchResults?.Parts ?? [];
  // Pick the best match: prefer one whose MPN equals the query (case-insensitive).
  const q = mpn.trim().toLowerCase();
  const part =
    parts.find((p) => (p.ManufacturerPartNumber ?? "").toLowerCase() === q) ?? parts[0];
  if (!part) return null;

  const specs: NexarSpec[] = (part.ProductAttributes ?? [])
    .filter((a) => a.AttributeName && a.AttributeValue)
    .map((a) => ({ name: a.AttributeName!, value: a.AttributeValue! }));
  // Prefer "Package / Case" over "Mounting Style" when both are present.
  const pkgSpec =
    specs.find((s) => /package\s*\/\s*case|^package$|^case\/?package$|case\s*code/i.test(s.name)) ??
    specs.find((s) => /mounting\s*style/i.test(s.name));

  // Rewrite Mouser product/image URLs to the .in regional domain.
  // NOTE: datasheet URLs are intentionally NOT rewritten — Mouser's datasheet
  // CDN (mouser.com/datasheet/...) doesn't reliably resolve on .in and many
  // datasheets are hosted directly on the manufacturer's own domain.
  const toIn = (url: string | undefined | null): string | null => {
    if (!url) return null;
    return url.replace(/https?:\/\/(www\.)?mouser\.com/gi, "https://www.mouser.in");
  };

  const resolvedMpn = part.ManufacturerPartNumber ?? mpn;
  const manufacturer = part.Manufacturer ?? null;
  let datasheetUrl: string | null = part.DataSheetUrl ?? null;
  // Mouser sometimes returns a product/landing page rather than the PDF
  // itself. If the URL isn't a direct .pdf, try the search fallback and
  // prefer the PDF when we find one; otherwise keep the Mouser link. For known
  // manufacturer families, we also prefer deterministic previewable mirrors
  // over official hosts that block server-side/browser preview fetches.
  const looksPdf = (u: string | null) => !!u && u.split(/[?#]/)[0].toLowerCase().endsWith(".pdf");
  const shouldPreferKnownResolver = hasKnownManufacturerDatasheet(resolvedMpn, manufacturer);
  if (datasheetUrl && looksPdf(datasheetUrl) && !shouldPreferKnownResolver) {
    // Persist Mouser-direct PDFs so future calls skip the fallback entirely.
    await setCachedDatasheet(resolvedMpn, manufacturer, datasheetUrl, "mouser");
  } else {
    const fallback = await searchDatasheetPdf(resolvedMpn, manufacturer);
    if (fallback) datasheetUrl = fallback;
    else if (datasheetUrl && looksPdf(datasheetUrl)) {
      await setCachedDatasheet(resolvedMpn, manufacturer, datasheetUrl, "mouser");
    }
  }

  return {
    id: part.MouserPartNumber ?? resolvedMpn,
    mpn: resolvedMpn,
    manufacturer,
    description: part.Description ?? null,
    package: pkgSpec?.value ?? null,
    image_url: toIn(part.ImagePath),
    datasheet_url: datasheetUrl,
    octopart_url: toIn(part.ProductDetailUrl),
    category: part.Category ?? null,
    specs,
    alternates: [], // Mouser Search API does not return similar parts
  };
}

/**
 * Fallback datasheet finder. Mouser regularly returns an empty `DataSheetUrl`,
 * especially on the .in regional endpoint. Rather than screen-scrape search
 * engines (blocked / rate-limited), we ask Gemini via the Lovable AI Gateway
 * for the manufacturer's direct PDF URL and then HEAD-verify it before
 * returning. Verified misses are cached as negative results so we don't
 * re-run the resolver for the same part.
 *
 * Best-effort: any error resolves to `null` so the caller can carry on
 * without a datasheet.
 */
export async function searchDatasheetPdf(
  mpn: string,
  manufacturer: string | null,
): Promise<string | null> {
  const cleanMpn = mpn.trim();
  if (!cleanMpn) return null;

  const cached = await getCachedDatasheet(cleanMpn, manufacturer);

  const verifyPdf = async (url: string): Promise<boolean> => {
    const check = async (init: RequestInit, inspectBody = false) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const r = await fetch(url, { ...init, signal: controller.signal });
        const ct = r.headers.get("content-type") ?? "";
        if (!r.ok) return false;
        if (ct.includes("pdf") || ct.includes("octet-stream")) return true;
        if (!inspectBody) return false;
        const bytes = new Uint8Array(await r.arrayBuffer());
        return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
      } catch {
        return false;
      } finally {
        clearTimeout(timeout);
      }
    };
    if (await check({
      method: "GET",
      headers: { "user-agent": BROWSER_UA, range: "bytes=0-15" },
      redirect: "follow",
    }, true)) return true;
    return check({ method: "HEAD", headers: { "user-agent": BROWSER_UA }, redirect: "follow" });
  };

  // Deterministic manufacturer rules run before positive cache hits so stale
  // cached links (for example old ST/ADI redirects that no longer preview) can
  // be repaired immediately without waiting for the 30-day TTL.
  const knownManufacturerUrl = await resolveKnownManufacturerDatasheet(
    cleanMpn,
    manufacturer,
    verifyPdf,
  );
  if (knownManufacturerUrl) {
    await setCachedDatasheet(cleanMpn, manufacturer, knownManufacturerUrl, "manufacturer");
    return knownManufacturerUrl;
  }

  if (typeof cached === "string") return cached;

  if (cached === null) return null;

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    await setCachedDatasheet(cleanMpn, manufacturer, null, "none");
    return null;
  }

  const askGemini = async (prompt: string): Promise<string | null> => {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You return ONLY a single direct https URL to the manufacturer datasheet PDF for the requested electronic part. The URL must end in .pdf and be publicly accessible. Prefer the manufacturer's own website. If you are not confident, reply with exactly the word NONE.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content?.trim();
      if (!raw || raw.toUpperCase() === "NONE") return null;
      const match = raw.match(/https?:\/\/[^\s<>"')]+/i);
      const url = match?.[0] ?? null;
      if (!url) return null;
      if (!url.split(/[?#]/)[0].toLowerCase().endsWith(".pdf")) return null;
      return url;
    } catch {
      return null;
    }
  };

  try {
    const prompts = [
      `${manufacturer ?? ""} ${cleanMpn} datasheet`.trim(),
      `${cleanMpn} datasheet pdf`,
    ];
    for (const p of prompts) {
      const candidate = await askGemini(p);
      if (!candidate) continue;
      if (await verifyPdf(candidate)) {
        await setCachedDatasheet(cleanMpn, manufacturer, candidate, "duckduckgo");
        return candidate;
      }
    }
    await setCachedDatasheet(cleanMpn, manufacturer, null, "none");
    return null;
  } catch {
    return null;
  }
}

function normalizeManufacturer(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeMpnForDatasheet(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\d{2,6}-/, "") // distributor prefix, e.g. Mouser 511-
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function stDatasheetSlugs(mpn: string): string[] {
  const raw = normalizeMpnForDatasheet(mpn);
  const noOrderSuffix = raw.replace(/(?:tr|t&r|rl|cutape|reel)$/i, "");
  const candidates = [raw, noOrderSuffix];

  // STM32 orderable part numbers commonly append package/temperature ordering
  // codes to the product root, while the PDF filename uses the product root.
  // Example: STM32G0B1KET6 → stm32g0b1ke.pdf.
  if (raw.startsWith("stm32")) {
    const withoutPackageTemp = noOrderSuffix.replace(/[a-z][0-9]$/i, "");
    if (withoutPackageTemp !== noOrderSuffix) candidates.push(withoutPackageTemp);
  }

  // ST ordering suffixes often encode package / delivery options while the
  // datasheet filename uses the product-family slug. Example:
  // STGAP3S3IFTR → stgap3s3if → stgap3s3s.pdf.
  if (noOrderSuffix.endsWith("if")) candidates.push(`${noOrderSuffix.slice(0, -2)}s`);
  if (noOrderSuffix.endsWith("itr")) candidates.push(`${noOrderSuffix.slice(0, -3)}s`);

  return unique(candidates.filter(Boolean));
}

function analogMaximDatasheetUrls(mpn: string): string[] {
  const raw = normalizeMpnForDatasheet(mpn);

  // MAX1485EUB+T / MAX1485CUB+T are covered by the shared Maxim family
  // datasheet. ADI's own PDF host often blocks server-side preview fetches, so
  // prefer a DigiKey-hosted copy of the same manufacturer datasheet that can be
  // streamed through our proxy reliably; keep ADI's official URL as fallback.
  if (/^max148[1-6]/i.test(raw)) {
    return [
      "https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/698/MAX1481_84-86_Rev1_12-15-06.pdf",
      "https://www.analog.com/media/en/technical-documentation/data-sheets/MAX1481-MAX1486.pdf",
    ];
  }

  return [];
}

function hasKnownManufacturerDatasheet(mpn: string, manufacturer: string | null): boolean {
  const mfr = normalizeManufacturer(manufacturer);
  return (
    mfr.includes("stmicroelectronics") ||
    mfr === "st" ||
    mfr.includes("analogdevices") ||
    mfr.includes("maximintegrated") ||
    analogMaximDatasheetUrls(mpn).length > 0
  );
}

async function resolveKnownManufacturerDatasheet(
  mpn: string,
  manufacturer: string | null,
  verifyPdf: (url: string) => Promise<boolean>,
): Promise<string | null> {
  const mfr = normalizeManufacturer(manufacturer);
  if (mfr.includes("stmicroelectronics") || mfr === "st") {
    for (const slug of stDatasheetSlugs(mpn)) {
      const url = `https://www.st.com/resource/en/datasheet/${slug}.pdf`;
      if (await verifyPdf(url)) return url;
    }
    return null;
  }

  if (mfr.includes("analogdevices") || mfr.includes("maximintegrated") || /^max/i.test(mpn)) {
    for (const url of analogMaximDatasheetUrls(mpn)) {
      if (await verifyPdf(url)) return url;
    }
  }

  return null;
}

// ---- AI datasheet search -----------------------------------------------------

export interface DatasheetCandidate {
  url: string;
  label: string;
  verified: boolean;
}

async function verifyPdfUrl(url: string): Promise<boolean> {
  const check = async (init: RequestInit, inspectBody = false) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const r = await fetch(url, { ...init, signal: controller.signal });
      const ct = r.headers.get("content-type") ?? "";
      if (!r.ok) return false;
      if (ct.includes("pdf") || ct.includes("octet-stream")) return true;
      if (!inspectBody) return false;
      const bytes = new Uint8Array(await r.arrayBuffer());
      return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };
  if (await check({ method: "GET", headers: { "user-agent": BROWSER_UA, range: "bytes=0-15" }, redirect: "follow" }, true)) {
    return true;
  }
  return check({ method: "HEAD", headers: { "user-agent": BROWSER_UA }, redirect: "follow" });
}

/**
 * Free-text AI datasheet search. Asks the Lovable AI Gateway for candidate
 * manufacturer datasheet PDFs matching an arbitrary query (part number,
 * description, "3.3V LDO SOT-23 datasheet"…), then verifies each candidate
 * really serves a PDF before returning it.
 */
export async function aiSearchDatasheets(query: string): Promise<DatasheetCandidate[]> {
  const q = query.trim();
  if (!q) return [];
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return [];

  let raw = "";
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              'You find datasheet PDFs for electronic components. Reply with ONLY a JSON array of up to 5 objects: [{"url":"https://...pdf","label":"MPN — Manufacturer"}]. Every url must be a direct, publicly accessible link ending in .pdf, preferring the manufacturer\'s own site, then major distributors (mouser, digikey). Return [] if unsure. No prose, no markdown fences.',
          },
          { role: "user", content: q },
        ],
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const candidates = parsed
    .map((item) => {
      const o = item as { url?: unknown; label?: unknown };
      const url = typeof o.url === "string" ? o.url.trim() : "";
      if (!/^https?:\/\//i.test(url)) return null;
      if (!url.split(/[?#]/)[0].toLowerCase().endsWith(".pdf")) return null;
      if (seen.has(url)) return null;
      seen.add(url);
      return { url, label: typeof o.label === "string" && o.label.trim() ? o.label.trim() : url };
    })
    .filter((c): c is { url: string; label: string } => c !== null)
    .slice(0, 5);

  const verified = await Promise.all(
    candidates.map(async (c) => ({ ...c, verified: await verifyPdfUrl(c.url) })),
  );
  // Verified links first, unverified kept as a last resort.
  return verified.sort((a, b) => Number(b.verified) - Number(a.verified));
}

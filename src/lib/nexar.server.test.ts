import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Stub the admin Supabase client so tests can control cache behaviour without
// hitting a real database. Individual tests override `cacheState` below.
const cacheState: {
  row: { datasheet_url: string | null; resolved_at: string } | null;
  readError: unknown;
  writes: Array<{ mpn: string; manufacturer: string; datasheet_url: string | null; source: string }>;
} = { row: null, readError: null, writes: [] };

vi.mock("@/integrations/supabase/client.server", () => {
  const from = (_table: string) => ({
    select: (_cols: string) => ({
      eq: (_c1: string, _v1: string) => ({
        eq: (_c2: string, _v2: string) => ({
          maybeSingle: async () =>
            cacheState.readError
              ? { data: null, error: cacheState.readError }
              : { data: cacheState.row, error: null },
        }),
      }),
    }),
    upsert: async (row: {
      mpn: string;
      manufacturer: string;
      datasheet_url: string | null;
      source: string;
    }) => {
      cacheState.writes.push({
        mpn: row.mpn,
        manufacturer: row.manufacturer,
        datasheet_url: row.datasheet_url,
        source: row.source,
      });
      return { data: null, error: null };
    },
  });
  return { supabaseAdmin: { from } };
});

// The module reads MOUSER_API_KEY at call time (inside nexarLookup), so we can
// mutate process.env between tests without re-importing.
import { nexarLookup, searchDatasheetPdf, __resetDatasheetMemCache } from "@/lib/nexar.server";

const ORIGINAL_KEY = process.env.MOUSER_API_KEY;
const ORIGINAL_FETCH = globalThis.fetch;

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

function resetCache() {
  cacheState.row = null;
  cacheState.readError = null;
  cacheState.writes = [];
  __resetDatasheetMemCache();
}

beforeEach(() => {
  resetCache();
});

describe("nexarLookup (Mouser client) — MOUSER_API_KEY handling", () => {
  beforeEach(() => {
    // Ensure each test starts from a clean slate.
    delete process.env.MOUSER_API_KEY;
    globalThis.fetch = ORIGINAL_FETCH;
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.MOUSER_API_KEY;
    else process.env.MOUSER_API_KEY = ORIGINAL_KEY;
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("throws when MOUSER_API_KEY is not set", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(nexarLookup("LM358")).rejects.toThrow("MOUSER_API_KEY missing");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws when MOUSER_API_KEY is an empty string", async () => {
    process.env.MOUSER_API_KEY = "";
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(nexarLookup("LM358")).rejects.toThrow("MOUSER_API_KEY missing");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the key as the apiKey query param when present", async () => {
    process.env.MOUSER_API_KEY = "test-key-123";
    mockFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toContain("apiKey=test-key-123");
      return new Response(
        JSON.stringify({ SearchResults: { NumberOfResult: 0, Parts: [] } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const result = await nexarLookup("LM358");
    expect(result).toBeNull();
  });

  it("throws a descriptive error when Mouser returns a non-OK status", async () => {
    process.env.MOUSER_API_KEY = "test-key-123";
    mockFetch(async () => new Response("nope", { status: 401 }));
    await expect(nexarLookup("LM358")).rejects.toThrow(/Mouser API error 401/);
  });

  it("throws when Mouser returns an Errors payload (e.g. invalid key)", async () => {
    process.env.MOUSER_API_KEY = "test-key-123";
    mockFetch(
      async () =>
        new Response(
          JSON.stringify({ Errors: [{ Code: "Invalid", Message: "Invalid api key" }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    await expect(nexarLookup("LM358")).rejects.toThrow(/Invalid api key/);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("nexarLookup (Mouser client) — response parsing", () => {
  const ORIGINAL = process.env.MOUSER_API_KEY;

  beforeEach(() => {
    process.env.MOUSER_API_KEY = "test-key";
    globalThis.fetch = ORIGINAL_FETCH;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.MOUSER_API_KEY;
    else process.env.MOUSER_API_KEY = ORIGINAL;
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("returns null when the response body is an empty object", async () => {
    mockFetch(async () => jsonResponse({}));
    await expect(nexarLookup("LM358")).resolves.toBeNull();
  });

  it("returns null when SearchResults is present but Parts is missing", async () => {
    mockFetch(async () => jsonResponse({ SearchResults: { NumberOfResult: 0 } }));
    await expect(nexarLookup("LM358")).resolves.toBeNull();
  });

  it("returns null when SearchResults.Parts is an empty array", async () => {
    mockFetch(async () => jsonResponse({ SearchResults: { NumberOfResult: 0, Parts: [] } }));
    await expect(nexarLookup("LM358")).resolves.toBeNull();
  });

  it("returns a minimally-populated part when every field is missing", async () => {
    mockFetch(async () => jsonResponse({ SearchResults: { Parts: [{}] } }));
    const result = await nexarLookup("LM358");
    expect(result).not.toBeNull();
    // Falls back to the queried MPN for id/mpn when Mouser returns nothing usable.
    expect(result).toEqual({
      id: "LM358",
      mpn: "LM358",
      manufacturer: null,
      description: null,
      package: null,
      image_url: null,
      datasheet_url: null,
      octopart_url: null,
      category: null,
      specs: [],
      alternates: [],
    });
  });

  it("picks the case-insensitive MPN match over the first part", async () => {
    mockFetch(async () =>
      jsonResponse({
        SearchResults: {
          Parts: [
            { ManufacturerPartNumber: "OTHER", MouserPartNumber: "M-OTHER" },
            { ManufacturerPartNumber: "lm358", MouserPartNumber: "M-LM358" },
          ],
        },
      }),
    );
    const result = await nexarLookup("LM358");
    expect(result?.id).toBe("M-LM358");
    expect(result?.mpn).toBe("lm358");
  });

  it("falls back to the first part when no MPN matches exactly", async () => {
    mockFetch(async () =>
      jsonResponse({
        SearchResults: {
          Parts: [
            { ManufacturerPartNumber: "ALT-1", MouserPartNumber: "M-ALT-1" },
            { ManufacturerPartNumber: "ALT-2", MouserPartNumber: "M-ALT-2" },
          ],
        },
      }),
    );
    const result = await nexarLookup("LM358");
    expect(result?.id).toBe("M-ALT-1");
  });

  it("skips ProductAttributes entries missing a name or value", async () => {
    mockFetch(async () =>
      jsonResponse({
        SearchResults: {
          Parts: [
            {
              ManufacturerPartNumber: "LM358",
              ProductAttributes: [
                { AttributeName: "Mounting Style", AttributeValue: "SMD" },
                { AttributeName: "Package / Case", AttributeValue: "SOIC-8" },
                { AttributeName: "Orphan" },
                { AttributeValue: "Orphan" },
                {},
              ],
            },
          ],
        },
      }),
    );
    const result = await nexarLookup("LM358");
    expect(result?.specs).toEqual([
      { name: "Mounting Style", value: "SMD" },
      { name: "Package / Case", value: "SOIC-8" },
    ]);
    expect(result?.package).toBe("SOIC-8");
  });

  it("tolerates ProductAttributes being absent entirely", async () => {
    mockFetch(async () =>
      jsonResponse({
        SearchResults: { Parts: [{ ManufacturerPartNumber: "LM358" }] },
      }),
    );
    const result = await nexarLookup("LM358");
    expect(result?.specs).toEqual([]);
    expect(result?.package).toBeNull();
  });

  it("always returns an empty alternates array (Mouser does not provide them)", async () => {
    mockFetch(async () =>
      jsonResponse({
        SearchResults: {
          Parts: [{ ManufacturerPartNumber: "LM358", Manufacturer: "TI" }],
        },
      }),
    );
    const result = await nexarLookup("LM358");
    expect(result?.alternates).toEqual([]);
  });

  it("propagates a JSON parse error when the body is not valid JSON", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<html>not json</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    ) as unknown as typeof fetch;
    await expect(nexarLookup("LM358")).rejects.toThrow();
  });
});

// Helpers for the Gemini-based fallback tests.
const ORIGINAL_LOVABLE_KEY = process.env.LOVABLE_API_KEY;

function geminiResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function pdfHeadResponse(): Response {
  return new Response(null, { status: 200, headers: { "content-type": "application/pdf" } });
}

/**
 * Mock fetch dispatcher for the Gemini fallback:
 * - Gateway URL → returns the given chat completion
 * - Any other URL (HEAD verify) → returns a PDF-typed 200
 * Tracks call count so tests can assert no traffic on cache hits.
 */
function mockGeminiThenPdf(content: string) {
  const calls: string[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    if (url.includes("ai.gateway.lovable.dev")) return geminiResponse(content);
    return pdfHeadResponse();
  }) as unknown as typeof fetch;
  return calls;
}

describe("searchDatasheetPdf — Gemini fallback", () => {
  beforeEach(() => {
    process.env.LOVABLE_API_KEY = "test-lovable-key";
    globalThis.fetch = ORIGINAL_FETCH;
  });
  afterEach(() => {
    if (ORIGINAL_LOVABLE_KEY === undefined) delete process.env.LOVABLE_API_KEY;
    else process.env.LOVABLE_API_KEY = ORIGINAL_LOVABLE_KEY;
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("returns null for an empty MPN without making a request", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(searchDatasheetPdf("   ", "TI")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns Gemini's PDF URL after HEAD verification succeeds", async () => {
    const target = "https://www.ti.com/lit/ds/symlink/lm358.pdf";
    mockGeminiThenPdf(target);
    await expect(searchDatasheetPdf("LM358", "TI")).resolves.toBe(target);
  });

  it("resolves STMicroelectronics manufacturer PDF patterns before using Gemini", async () => {
    const target = "https://www.st.com/resource/en/datasheet/stgap3s3s.pdf";
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      if (url === target) return pdfHeadResponse();
      return new Response(null, { status: 404, headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;

    await expect(searchDatasheetPdf("511-STGAP3S3IFTR", "STMicroelectronics")).resolves.toBe(
      target,
    );
    expect(calls).toContain(target);
    expect(calls.some((url) => url.includes("ai.gateway.lovable.dev"))).toBe(false);
    expect(cacheState.writes).toEqual([
      {
        mpn: "511-STGAP3S3IFTR",
        manufacturer: "STMicroelectronics",
        datasheet_url: target,
        source: "manufacturer",
      },
    ]);
  });

  it("strips STM32 package/temperature suffixes to resolve the product-root PDF", async () => {
    const target = "https://www.st.com/resource/en/datasheet/stm32g0b1ke.pdf";
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      if (url === target) return pdfHeadResponse();
      return new Response(null, { status: 404, headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;

    await expect(searchDatasheetPdf("stm32g0b1ket6", "STMicroelectronics")).resolves.toBe(
      target,
    );
    expect(calls).toContain(target);
    expect(calls.some((url) => url.includes("ai.gateway.lovable.dev"))).toBe(false);
    expect(cacheState.writes[0]).toMatchObject({
      mpn: "stm32g0b1ket6",
      manufacturer: "STMicroelectronics",
      datasheet_url: target,
      source: "manufacturer",
    });
  });

  it("resolves MAX1485EUB+T to a previewable family datasheet before using Gemini", async () => {
    const target =
      "https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/698/MAX1481_84-86_Rev1_12-15-06.pdf";
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      if (url === target) return pdfHeadResponse();
      return new Response(null, { status: 404, headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;

    await expect(searchDatasheetPdf("MAX1485EUB+T", "Analog Devices Inc./Maxim Integrated")).resolves.toBe(
      target,
    );
    expect(calls).toContain(target);
    expect(calls.some((url) => url.includes("ai.gateway.lovable.dev"))).toBe(false);
    expect(cacheState.writes[0]).toMatchObject({
      mpn: "MAX1485EUB+T",
      manufacturer: "Analog Devices Inc./Maxim Integrated",
      datasheet_url: target,
      source: "manufacturer",
    });
  });

  it("repairs a cached negative result when a deterministic manufacturer URL now verifies", async () => {
    const target = "https://www.st.com/resource/en/datasheet/stgap3s3s.pdf";
    cacheState.row = { datasheet_url: null, resolved_at: new Date().toISOString() };
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === target) return pdfHeadResponse();
      return new Response(null, { status: 404, headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;

    await expect(searchDatasheetPdf("STGAP3S3IFTR", "STMicroelectronics")).resolves.toBe(target);
    expect(cacheState.writes[0]).toMatchObject({ datasheet_url: target, source: "manufacturer" });
  });

  it("extracts an https .pdf URL embedded in a longer reply", async () => {
    const target = "https://mfr.example/parts/xyz.pdf";
    mockGeminiThenPdf(`Sure! Here it is: ${target} — hope this helps.`);
    await expect(searchDatasheetPdf("XYZ", "Mfr")).resolves.toBe(target);
  });

  it("returns null when the reply is literally NONE", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("ai.gateway.lovable.dev")) return geminiResponse("NONE");
      return pdfHeadResponse();
    }) as unknown as typeof fetch;
    await expect(searchDatasheetPdf("UNKNOWN", "Mfr")).resolves.toBeNull();
  });

  it("returns null when Gemini's URL does not end in .pdf", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("ai.gateway.lovable.dev")) return geminiResponse("https://example.com/landing.html");
      return pdfHeadResponse();
    }) as unknown as typeof fetch;
    await expect(searchDatasheetPdf("PART", "Mfr")).resolves.toBeNull();
  });

  it("returns null when HEAD verification fails (bad content-type)", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("ai.gateway.lovable.dev")) return geminiResponse("https://example.com/broken.pdf");
      return new Response(null, { status: 200, headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;
    await expect(searchDatasheetPdf("PART", "Mfr")).resolves.toBeNull();
  });

  it("returns null gracefully when the gateway responds with a non-OK status", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(searchDatasheetPdf("PART", "Mfr")).resolves.toBeNull();
  });

  it("returns null gracefully when fetch throws (network failure)", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(searchDatasheetPdf("PART", "Mfr")).resolves.toBeNull();
  });

  it("returns null when LOVABLE_API_KEY is not set", async () => {
    delete process.env.LOVABLE_API_KEY;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(searchDatasheetPdf("PART", "Mfr")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("searchDatasheetPdf — datasheet cache", () => {
  beforeEach(() => {
    process.env.LOVABLE_API_KEY = "test-lovable-key";
    globalThis.fetch = ORIGINAL_FETCH;
  });
  afterEach(() => {
    if (ORIGINAL_LOVABLE_KEY === undefined) delete process.env.LOVABLE_API_KEY;
    else process.env.LOVABLE_API_KEY = ORIGINAL_LOVABLE_KEY;
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("returns the cached URL without hitting the network on a fresh hit", async () => {
    cacheState.row = {
      datasheet_url: "https://cached.example/sheet.pdf",
      resolved_at: new Date().toISOString(),
    };
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(searchDatasheetPdf("LM358", "TI")).resolves.toBe(
      "https://cached.example/sheet.pdf",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(cacheState.writes).toEqual([]);
  });

  it("honours a cached negative result (null URL) without searching", async () => {
    cacheState.row = { datasheet_url: null, resolved_at: new Date().toISOString() };
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(searchDatasheetPdf("LM358", "TI")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats stale rows (>30d) as a miss and re-resolves", async () => {
    cacheState.row = {
      datasheet_url: "https://stale.example/old.pdf",
      resolved_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const fresh = "https://fresh.example/new.pdf";
    mockGeminiThenPdf(fresh);
    await expect(searchDatasheetPdf("LM358", "TI")).resolves.toBe(fresh);
    expect(cacheState.writes).toHaveLength(1);
    expect(cacheState.writes[0].datasheet_url).toBe(fresh);
  });

  it("falls back to live search when the cache read errors", async () => {
    cacheState.readError = new Error("db down");
    const target = "https://example.com/found.pdf";
    mockGeminiThenPdf(target);
    await expect(searchDatasheetPdf("LM358", "TI")).resolves.toBe(target);
  });

  it("persists a successful result to the cache", async () => {
    const target = "https://example.com/found.pdf";
    mockGeminiThenPdf(target);
    await searchDatasheetPdf("PART-9", "Mfr");
    expect(cacheState.writes).toHaveLength(1);
    expect(cacheState.writes[0]).toMatchObject({
      mpn: "PART-9",
      manufacturer: "Mfr",
      datasheet_url: target,
    });
  });

  it("persists a negative result (no PDF found) so we don't retry", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("ai.gateway.lovable.dev")) return geminiResponse("NONE");
      return pdfHeadResponse();
    }) as unknown as typeof fetch;
    await expect(searchDatasheetPdf("PART-10", "Mfr")).resolves.toBeNull();
    expect(cacheState.writes).toEqual([
      { mpn: "PART-10", manufacturer: "Mfr", datasheet_url: null, source: "none" },
    ]);
  });

  it("uses the in-process LRU on a second call (no DB or fetch traffic)", async () => {
    const target = "https://example.com/cached.pdf";
    mockGeminiThenPdf(target);
    await searchDatasheetPdf("PART-12", "Mfr");
    cacheState.readError = new Error("db down");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(searchDatasheetPdf("PART-12", "Mfr")).resolves.toBe(target);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("nexarLookup — caches Mouser-direct datasheet PDFs", () => {
  const ORIGINAL = process.env.MOUSER_API_KEY;
  beforeEach(() => {
    process.env.MOUSER_API_KEY = "test-key";
    globalThis.fetch = ORIGINAL_FETCH;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.MOUSER_API_KEY;
    else process.env.MOUSER_API_KEY = ORIGINAL;
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("upserts source='mouser' when Mouser returns a direct .pdf URL", async () => {
    mockFetch(async () =>
      new Response(
        JSON.stringify({
          SearchResults: {
            Parts: [
              {
                ManufacturerPartNumber: "LM358",
                Manufacturer: "TI",
                DataSheetUrl: "https://www.mouser.com/datasheet/2/lm358.pdf",
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const result = await nexarLookup("LM358");
    // Datasheet URLs are no longer rewritten to .in — Mouser's CDN and
    // manufacturer hosts are often domain-sensitive.
    expect(result?.datasheet_url).toBe("https://www.mouser.com/datasheet/2/lm358.pdf");
    expect(cacheState.writes).toEqual([
      {
        mpn: "LM358",
        manufacturer: "TI",
        datasheet_url: "https://www.mouser.com/datasheet/2/lm358.pdf",
        source: "mouser",
      },
    ]);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Mocks must be declared before importing the route module so the dynamic
// imports inside the handler resolve to these fakes instead of the real
// Supabase admin client and Nexar HTTP client.
const nexarLookup = vi.fn();
const updateEq = vi.fn().mockResolvedValue({ error: null });
const update = vi.fn(() => ({ eq: updateEq }));
const limit = vi.fn();
const order = vi.fn(() => ({ limit }));
const notFn = vi.fn(() => ({ order }));
const select = vi.fn(() => ({ not: notFn }));
const from = vi.fn(() => ({ select, update }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from },
}));
vi.mock("@/lib/nexar.server", () => ({
  nexarLookup: (...args: unknown[]) => nexarLookup(...args),
}));

const { Route } = await import("@/routes/api/public/hooks/refresh-supplier-data");

const SECRET = "integration-test-cron-secret-abcdef0123456789";
const ENDPOINT = "http://localhost/api/public/hooks/refresh-supplier-data";

// Access the registered POST handler from the route definition.
// The route file exports `Route` from createFileRoute; its server.handlers.POST
// is the function we want to exercise as an integration boundary.
const POST = (Route.options as unknown as {
  server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } };
}).server.handlers.POST;

function makeRequest(headers: Record<string, string> = {}) {
  return new Request(ENDPOINT, { method: "POST", headers });
}

let originalSecret: string | undefined;

beforeAll(() => {
  originalSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
});

afterAll(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("POST /api/public/hooks/refresh-supplier-data — auth", () => {
  it("returns 401 when no auth headers are sent", async () => {
    const res = await POST({ request: makeRequest() });
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("returns 401 for an empty x-cron-secret header", async () => {
    const res = await POST({ request: makeRequest({ "x-cron-secret": "" }) });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid x-cron-secret", async () => {
    const res = await POST({
      request: makeRequest({ "x-cron-secret": "totally-wrong-value" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an x-cron-secret of the same length but wrong bytes", async () => {
    const res = await POST({
      request: makeRequest({ "x-cron-secret": "x".repeat(SECRET.length) }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an empty Bearer Authorization header", async () => {
    const res = await POST({ request: makeRequest({ authorization: "Bearer " }) });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid Bearer token", async () => {
    const res = await POST({
      request: makeRequest({ authorization: "Bearer nope-not-the-secret" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for a Bearer token of matching length but wrong bytes", async () => {
    const res = await POST({
      request: makeRequest({ authorization: `Bearer ${"y".repeat(SECRET.length)}` }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for a Bearer token that is a prefix of the real secret", async () => {
    const res = await POST({
      request: makeRequest({ authorization: `Bearer ${SECRET.slice(0, -1)}` }),
    });
    expect(res.status).toBe(401);
  });


  it("returns 401 for a non-Bearer Authorization scheme even with the right value", async () => {
    const res = await POST({
      request: makeRequest({ authorization: `Basic ${SECRET}` }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when the Supabase publishable key is sent in the legacy apikey header", async () => {
    // Regression guard for the previous weak-auth scheme: only CRON_SECRET is accepted.
    const res = await POST({
      request: makeRequest({ apikey: "any-supabase-publishable-key" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is not configured on the server", async () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const res = await POST({
        request: makeRequest({ "x-cron-secret": SECRET }),
      });
      expect(res.status).toBe(401);
    } finally {
      process.env.CRON_SECRET = prev;
    }
  });

  // Positive-auth paths are exercised by the unit tests in cron-auth.test.ts.
});

describe("POST /api/public/hooks/refresh-supplier-data — success path (mocked deps)", () => {
  beforeEach(() => {
    nexarLookup.mockReset();
    updateEq.mockClear();
    update.mockClear();
    limit.mockReset();
    from.mockClear();
    select.mockClear();
    notFn.mockClear();
    order.mockClear();
  });

  it("returns 200 with counts when x-cron-secret is valid", async () => {
    limit.mockResolvedValueOnce({
      data: [
        { id: "c1", part_number: "PN-1" },
        { id: "c2", part_number: "PN-2" },
      ],
      error: null,
    });
    nexarLookup.mockImplementation(async (pn: string) => ({
      id: `nx-${pn}`,
      description: `desc-${pn}`,
      image_url: null,
      datasheet_url: null,
      specs: {},
      alternates: [],
      octopart_url: `https://octopart/${pn}`,
    }));

    const res = await POST({ request: makeRequest({ "x-cron-secret": SECRET }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, updated: 2, failed: 0, scanned: 2 });
    expect(from).toHaveBeenCalledWith("components");
    expect(nexarLookup).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("returns 200 when Bearer Authorization is valid", async () => {
    limit.mockResolvedValueOnce({ data: [], error: null });

    const res = await POST({
      request: makeRequest({ authorization: `Bearer ${SECRET}` }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, updated: 0, failed: 0, scanned: 0 });
    expect(nexarLookup).not.toHaveBeenCalled();
  });

  it("counts a missing Nexar part as scanned-but-not-updated", async () => {
    limit.mockResolvedValueOnce({
      data: [{ id: "c1", part_number: "PN-MISSING" }],
      error: null,
    });
    nexarLookup.mockResolvedValueOnce(null);

    const res = await POST({ request: makeRequest({ "x-cron-secret": SECRET }) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, updated: 0, failed: 0, scanned: 1 });
    // Still issues a touch-update to bump supplier_synced_at.
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("counts a Nexar lookup throw as failed without aborting the run", async () => {
    limit.mockResolvedValueOnce({
      data: [
        { id: "c1", part_number: "PN-OK" },
        { id: "c2", part_number: "PN-BOOM" },
      ],
      error: null,
    });
    nexarLookup
      .mockResolvedValueOnce({
        id: "nx-1",
        description: "ok",
        image_url: null,
        datasheet_url: null,
        specs: {},
        alternates: [],
        octopart_url: "https://octopart/PN-OK",
      })
      .mockRejectedValueOnce(new Error("nexar down"));

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST({ request: makeRequest({ "x-cron-secret": SECRET }) });
    errSpy.mockRestore();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, updated: 1, failed: 1, scanned: 2 });
  });

  it("returns 500 when the Supabase select fails", async () => {
    limit.mockResolvedValueOnce({ data: null, error: { message: "db exploded" } });

    const res = await POST({ request: makeRequest({ "x-cron-secret": SECRET }) });

    expect(res.status).toBe(500);
    expect(await res.text()).toBe("db exploded");
    expect(nexarLookup).not.toHaveBeenCalled();
  });

  it("returns 200 with all components counted as failed when MOUSER_API_KEY is missing", async () => {
    // mouserLookup (exported as nexarLookup) throws "MOUSER_API_KEY missing"
    // when the env var is absent. The route must catch per-component errors
    // and report them as failed, without aborting the whole run.
    limit.mockResolvedValueOnce({
      data: [
        { id: "c1", part_number: "PN-1" },
        { id: "c2", part_number: "PN-2" },
      ],
      error: null,
    });
    nexarLookup.mockRejectedValue(new Error("MOUSER_API_KEY missing"));

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST({ request: makeRequest({ "x-cron-secret": SECRET }) });
    errSpy.mockRestore();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, updated: 0, failed: 2, scanned: 2 });
    expect(update).not.toHaveBeenCalled();
  });

  it("treats nexarLookup returning null as scanned-but-not-updated for every component", async () => {
    // Simulates Mouser returning empty Parts arrays for every MPN — the route
    // should still touch supplier_synced_at but not bump any other fields.
    limit.mockResolvedValueOnce({
      data: [
        { id: "c1", part_number: "PN-1" },
        { id: "c2", part_number: "PN-2" },
        { id: "c3", part_number: "PN-3" },
      ],
      error: null,
    });
    nexarLookup.mockResolvedValue(null);

    const res = await POST({ request: makeRequest({ "x-cron-secret": SECRET }) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, updated: 0, failed: 0, scanned: 3 });
    expect(update).toHaveBeenCalledTimes(3);
  });

  it("still writes a sparse update when nexarLookup returns a minimal/partial part", async () => {
    // Mirrors the nexar.server.test.ts case where Mouser returns `Parts: [{}]`
    // and the client builds a part object with mostly nulls. The route must
    // pass those nulls through to the update without crashing.
    limit.mockResolvedValueOnce({
      data: [{ id: "c1", part_number: "PN-1" }],
      error: null,
    });
    nexarLookup.mockResolvedValueOnce({
      id: "PN-1",
      mpn: "PN-1",
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

    const res = await POST({ request: makeRequest({ "x-cron-secret": SECRET }) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, updated: 1, failed: 0, scanned: 1 });
    expect(update).toHaveBeenCalledTimes(1);
    const payload = (update as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0] as Record<string, unknown>;
    expect(payload.nexar_part_id).toBe("PN-1");
    expect(payload.short_description).toBeNull();
    expect(payload.image_url).toBeNull();
    expect(payload.datasheet_url).toBeNull();
    expect(payload.specs).toEqual([]);
    expect(payload.alternates).toEqual([]);
    expect(payload.supplier).toBe("Octopart");
    expect(typeof payload.supplier_synced_at).toBe("string");
  });
});


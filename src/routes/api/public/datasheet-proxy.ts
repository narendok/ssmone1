import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

// Only proxy PDFs from well-known manufacturer / distributor hosts to avoid
// turning this into an open SSRF/relay. Extend as needed.
const ALLOWED_HOSTS = [
  "st.com",
  "ti.com",
  "analog.com",
  "nxp.com",
  "infineon.com",
  "onsemi.com",
  "microchip.com",
  "renesas.com",
  "rohm.com",
  "vishay.com",
  "littelfuse.com",
  "diodes.com",
  "toshiba.semicon-storage.com",
  "mouser.com",
  "mouser.in",
  "digikey.com",
  "digikey.in",
  "media.digikey.com",
  "octopart.com",
];

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
}

// ---- Byte cache --------------------------------------------------------------
// Proxied PDFs are cached in the private `datasheet-cache` storage bucket so
// repeated previews are served from our own infrastructure instead of hitting
// (and being throttled/blocked by) the manufacturer CDN every time.

const CACHE_BUCKET = "datasheet-cache";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function cacheKey(url: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex}.pdf`;
}

async function readCache(key: string): Promise<ArrayBuffer | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const storage = supabaseAdmin.storage.from(CACHE_BUCKET);
    const { data: listed } = await storage.list("", { search: key, limit: 1 });
    const entry = listed?.find((f) => f.name === key);
    if (!entry) return null;
    const updated = new Date(entry.updated_at ?? entry.created_at ?? 0).getTime();
    if (!Number.isNaN(updated) && Date.now() - updated > CACHE_TTL_MS) return null;
    const { data, error } = await storage.download(key);
    if (error || !data) return null;
    return await data.arrayBuffer();
  } catch {
    return null;
  }
}

async function writeCache(key: string, body: Uint8Array): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage
      .from(CACHE_BUCKET)
      .upload(key, body, { contentType: "application/pdf", upsert: true });
  } catch {
    // Cache write failures must never break the proxy response.
  }
}

async function handle(request: Request, method: "GET" | "HEAD"): Promise<Response> {

  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target) return new Response("Missing url", { status: 400, headers: CORS });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400, headers: CORS });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return new Response("Unsupported protocol", { status: 400, headers: CORS });
  }
  if (!hostAllowed(parsed.hostname)) {
    return new Response("Host not allowed", { status: 403, headers: CORS });
  }

  const range = request.headers.get("range");
  const key = await cacheKey(parsed.toString());

  // Serve full-body GET/HEAD requests from the byte cache when possible.
  if (!range) {
    const cached = await readCache(key);
    if (cached) {
      const cachedHeaders = new Headers({
        "content-type": "application/pdf",
        "content-length": String(cached.byteLength),
        "cache-control": "public, max-age=86400",
        "x-datasheet-cache": "hit",
        ...CORS,
      });
      if (method === "HEAD") return new Response(null, { status: 200, headers: cachedHeaders });
      return new Response(cached, { status: 200, headers: cachedHeaders });

    }
  }


  const upstreamHeaders: Record<string, string> = {
    // Mimic a real browser — many manufacturer CDNs (st.com etc.) return
    // HTTP/2 protocol errors or 403 for non-browser UAs.
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    accept: "application/pdf,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
  };
  if (range) upstreamHeaders.range = range;

  const fetchOnce = async (extra?: Record<string, string>): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      return await fetch(parsed.toString(), {
        method,
        headers: { ...upstreamHeaders, ...extra },
        redirect: "follow",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  let upstream: Response;
  try {
    upstream = await fetchOnce();
  } catch (e) {
    return new Response(`Upstream fetch failed: ${e instanceof Error ? e.message : String(e)}`, {
      status: 504,
      headers: CORS,
    });
  }

  const headers = new Headers();
  for (const [k, v] of upstream.headers) {
    const lk = k.toLowerCase();
    if (
      lk === "content-type" ||
      lk === "content-length" ||
      lk === "content-range" ||
      lk === "accept-ranges" ||
      lk === "last-modified" ||
      lk === "etag"
    ) {
      headers.set(k, v);
    }
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/pdf");
  headers.set("cache-control", "public, max-age=86400");
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);

  if (method === "HEAD") {
    return new Response(null, { status: upstream.status, headers });
  }

  if (!upstream.ok || range) {
    // Partial-content / error responses are passed through untouched.
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  // Some manufacturer CDNs (notably st.com) abort the HTTP/2 stream mid-body,
  // which yields a truncated — and therefore unrenderable — PDF. Buffer the
  // response, verify it is a complete PDF, and repair short reads with byte
  // range requests before handing anything to the client.
  const expected = Number(upstream.headers.get("content-length") ?? "0");
  const chunks: Uint8Array[] = [];
  let received = 0;
  const collect = async (res: Response): Promise<void> => {
    const reader = res.body?.getReader();
    if (!reader) return;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
        }
      }
    } catch {
      // Truncated stream — keep whatever arrived and resume below.
    }
  };

  await collect(upstream);

  for (let attempt = 0; attempt < 4; attempt++) {
    if (expected > 0 && received >= expected) break;
    if (expected <= 0) break;
    let next: Response;
    try {
      next = await fetchOnce({ range: `bytes=${received}-` });
    } catch {
      break;
    }
    if (next.status !== 206 && next.status !== 200) break;
    if (next.status === 200) {
      // Server ignored the range request; restart from scratch.
      chunks.length = 0;
      received = 0;
    }
    const before = received;
    await collect(next);
    if (received === before) break; // no progress, give up
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    body.set(c, offset);
    offset += c.byteLength;
  }

  const tail = new TextDecoder("latin1").decode(body.subarray(Math.max(0, body.length - 4096)));
  const complete = body.length > 0 && tail.includes("%%EOF");
  if (!complete && expected > 0 && received < expected) {
    return new Response("Upstream returned a truncated PDF", { status: 502, headers: CORS });
  }

  if (complete) await writeCache(key, body);

  headers.set("content-length", String(body.length));
  headers.set("x-datasheet-cache", "miss");
  return new Response(body, { status: 200, headers });

}


export const Route = createFileRoute("/api/public/datasheet-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      HEAD: async ({ request }) => handle(request, "HEAD"),
      GET: async ({ request }) => handle(request, "GET"),
    },
  },
});

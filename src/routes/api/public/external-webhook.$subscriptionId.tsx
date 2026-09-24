import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/external-webhook/$subscriptionId")({
  server: { handlers: { POST: async ({ request, params }) => {
    const signature = request.headers.get("x-ssm-signature") ?? "";
    const body = await request.text();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subscription } = await supabaseAdmin.from("external_webhook_subscriptions").select("id,active,signing_secret_hash,disabled_at").eq("id", params.subscriptionId).maybeSingle();
    if (!subscription || !subscription.active || subscription.disabled_at || !subscription.signing_secret_hash) return new Response("Unavailable", { status: 404 });
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)))).map((n) => n.toString(16).padStart(2, "0")).join("");
    if (signature.length !== digest.length) return new Response("Invalid signature", { status: 401 });
    let mismatch = 0;
    for (let index = 0; index < signature.length; index += 1) mismatch |= signature.charCodeAt(index) ^ digest.charCodeAt(index);
    if (mismatch !== 0) return new Response("Invalid signature", { status: 401 });
    let payload: unknown;
    try { payload = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400 }); }
    const idempotencyKey = request.headers.get("idempotency-key") ?? crypto.randomUUID();
    const { error } = await supabaseAdmin.from("external_webhook_deliveries").insert({ subscription_id: subscription.id, event_key: "inbound.received", idempotency_key: idempotencyKey, status: "COMPLETED", response_status: 202, response_summary: "Accepted after signature validation", attempted_at: new Date().toISOString(), completed_at: new Date().toISOString(), payload: payload as any, attempt_count: 1 });
    if (error && !error.message.toLowerCase().includes("duplicate")) return new Response("Could not record delivery", { status: 500 });
    return new Response("Accepted", { status: 202 });
  } } },
});

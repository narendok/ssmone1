import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { renderPoHtml } from "@/lib/po-html";
import type { PurchaseOrder } from "@/lib/procurement";

export interface SendPoEmailInput {
  po_id: string;
  to: string;
  cc?: string | null;
  message?: string | null;
}

export interface SendPoEmailResult {
  /** true when the e-mail actually left through the mail provider */
  sent: boolean;
  subject: string;
  html: string;
  to: string;
  cc: string[];
  po_number: string;
  /** why it could not be sent, when sent === false */
  reason?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseList(v: string | null | undefined): string[] {
  return (v ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const sendPoEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SendPoEmailInput) => {
    if (!input?.po_id) throw new Error("Purchase order is required");
    if (!EMAIL_RE.test((input.to ?? "").trim())) throw new Error("A valid vendor e-mail address is required");
    for (const c of parseList(input.cc)) {
      if (!EMAIL_RE.test(c)) throw new Error(`${c} is not a valid e-mail address`);
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<SendPoEmailResult> => {
    const { supabase } = context;
    const { data: po, error } = await supabase
      .from("purchase_orders")
      .select(
        "*, vendor:vendors(*), items:purchase_order_items(*, component:components(id,name,part_number,manufacturer))",
      )
      .eq("id", data.po_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!po) throw new Error("Purchase order not found");

    const order = po as unknown as PurchaseOrder;
    const to = data.to.trim();
    const cc = parseList(data.cc);
    const subject = `Purchase Order ${order.po_number} — PartsBench`;
    const html = renderPoHtml(order, { message: data.message ?? null });

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const resendKey = process.env["RESEND_API_KEY"];

    if (!lovableKey || !resendKey) {
      return {
        sent: false,
        subject,
        html,
        to,
        cc,
        po_number: order.po_number,
        reason: "no_mail_provider",
      };
    }

    const response = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: "PartsBench Purchase <onboarding@resend.dev>",
        to: [to],
        ...(cc.length ? { cc } : {}),
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`PO e-mail failed [${response.status}]: ${body}`);
      return {
        sent: false,
        subject,
        html,
        to,
        cc,
        po_number: order.po_number,
        reason: `Mail provider refused the message [${response.status}]: ${body}`,
      };
    }

    const { error: rpcError } = await supabase.rpc("mark_po_sent", { _po_id: data.po_id, _address: to });
    if (rpcError) throw new Error(rpcError.message);

    return { sent: true, subject, html, to, cc, po_number: order.po_number };
  });

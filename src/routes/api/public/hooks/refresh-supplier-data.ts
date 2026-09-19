import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export const Route = createFileRoute("/api/public/hooks/refresh-supplier-data")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request.headers, process.env.CRON_SECRET ?? "")) {
          return new Response("Unauthorized", { status: 401 });
        }


        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { nexarLookup } = await import("@/lib/nexar.server");

        const { data: components, error } = await supabaseAdmin
          .from("components")
          .select("id, part_number")
          .not("part_number", "is", null)
          .order("supplier_synced_at", { ascending: true, nullsFirst: true })
          .limit(50);
        if (error) return new Response(error.message, { status: 500 });

        let updated = 0;
        let failed = 0;
        for (const c of components ?? []) {
          try {
            const part = await nexarLookup(c.part_number);
            if (!part) {
              await supabaseAdmin
                .from("components")
                .update({ supplier_synced_at: new Date().toISOString() })
                .eq("id", c.id);
              continue;
            }
            await supabaseAdmin
              .from("components")
              .update({
                nexar_part_id: part.id,
                short_description: part.description,
                image_url: part.image_url,
                datasheet_url: part.datasheet_url,
                specs: part.specs as never,
                alternates: part.alternates as never,
                supplier: "Octopart",
                supplier_url: part.octopart_url,
                supplier_synced_at: new Date().toISOString(),
              })
              .eq("id", c.id);
            updated++;
          } catch (e) {
            console.error("refresh failed", c.part_number, e);
            failed++;
          }
        }
        return Response.json({ ok: true, updated, failed, scanned: components?.length ?? 0 });
      },
    },
  },
});

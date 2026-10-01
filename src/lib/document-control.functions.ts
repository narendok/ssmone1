import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const transitionSchema = z.object({
  registerId: z.string().uuid(),
  action: z.enum(["SUBMIT_REVIEW", "REVIEW_APPROVE", "REVIEW_REJECT", "APPROVE", "RELEASE", "SUPERSEDE"]),
  expectedStatus: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "OBSOLETE"]),
  note: z.string().trim().max(2000).nullable(),
  changeReason: z.string().trim().max(2000).nullable(),
  requestKey: z.string().uuid(),
});

export const transitionDocumentControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => transitionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (context.supabase as any).rpc("transition_document_control", {
      p_register_id: data.registerId,
      p_action: data.action,
      p_expected_status: data.expectedStatus,
      p_note: data.note,
      p_change_reason: data.changeReason,
      p_request_key: data.requestKey,
    });
    if (error) throw new Error(error.message);
    return result as { register_id: string; action: string; status: string; controlled_version: number; processed_at: string };
  });
import type { SupabaseClient } from "@supabase/supabase-js";

export type LifecycleRpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};
export type LifecycleTransactionClient = LifecycleRpcClient & {
  storage: SupabaseClient["storage"];
};

const operations = new Set([
  "create_lifecycle_document_template_revision", "activate_lifecycle_document_template",
  "retire_lifecycle_document_template", "authorize_lifecycle_document_draft",
  "register_lifecycle_document_storage_attempt", "find_lifecycle_document_draft_receipt",
  "commit_lifecycle_document_draft", "can_discard_lifecycle_document_object",
]);

/** Pending server-only actor transport; requires separate deployment acceptance.
 * verifiedActorId comes ONLY from requireSupabaseAuth's verified claims, never
 * from input data. Each RPC sets/restores that actor inside its own transaction.
 * The caller's read client stays unchanged and continues enforcing caller RLS.
 * This client exposes no unrestricted admin table-query interface.
 */
export function createLifecycleActorTransport(
  admin: Pick<SupabaseClient, "rpc" | "storage">,
  verifiedActorId: string,
): LifecycleTransactionClient {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(verifiedActorId)) {
    throw new Error("A verified authenticated actor is required.");
  }
  return {
    storage: admin.storage,
    async rpc(name, args) {
      if (!operations.has(name)) throw new Error("Unsupported lifecycle server operation.");
      return await admin.rpc("execute_lifecycle_document_action", {
        p_verified_actor_id: verifiedActorId,
        p_operation: name,
        p_arguments: args,
      });
    },
  };
}

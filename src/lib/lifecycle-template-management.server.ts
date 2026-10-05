import type { LifecycleRpcClient } from "./lifecycle-actor-transport.server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Existing governed RPCs, using the middleware's authenticated caller client.
 * These routines derive the actor and enforce department/DRAFT rules themselves.
 * Unlike the new document-body RPCs, their verified managed contract permits
 * authenticated execution. The web facade remains behind its acceptance gate.
 * Calls are not automatically retried: template creation/cloning is not idempotent.
 */
export function createLifecycleTemplateManagementStore(client: LifecycleRpcClient) {
  async function savedId(operation: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(operation, args);
    if (error) throw new Error(error.message ?? "Template management failed.");
    if (typeof data !== "string" || !uuid.test(data)) {
      throw new Error("The backend did not return a valid saved template/stage ID.");
    }
    return data;
  }
  return {
    create(input: { departmentId: string; templateKey: string; title: string; description: string | null }) {
      return savedId("create_department_process_template", {
        p_department_id: input.departmentId, p_template_key: input.templateKey,
        p_title: input.title, p_description: input.description,
      });
    },
    stage(input: { templateId: string; stageId: string | null; stageKey: string; title: string;
      description: string | null; sortOrder: number; sourceCompanyProcessStageId: string;
      taskDepartment: string; required: boolean }) {
      return savedId("upsert_department_process_template_stage", {
        p_template_id: input.templateId, p_stage_id: input.stageId, p_stage_key: input.stageKey,
        p_title: input.title, p_description: input.description, p_sort_order: input.sortOrder,
        p_source_company_process_stage_id: input.sourceCompanyProcessStageId,
        p_task_department: input.taskDepartment, p_required: input.required,
      });
    },
    clone(templateId: string) {
      return savedId("clone_department_process_template", { p_template_id: templateId });
    },
  };
}

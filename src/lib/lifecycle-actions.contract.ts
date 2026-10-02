export const lifecycleActionContracts = {
  create: { rpc: "create_department_process_template", mutation: "template draft", idempotent: false },
  stage: { rpc: "upsert_department_process_template_stage", mutation: "template stage", idempotent: false },
  clone: { rpc: "clone_department_process_template", mutation: "template version", idempotent: false },
  activate: { rpc: "activate_department_process_template", mutation: "template state", idempotent: false },
  retire: { rpc: "retire_department_process_template", mutation: "template state", idempotent: false },
  materialize: { rpc: "generate_project_lifecycle_draft", mutation: "project draft", idempotent: true },
} as const;

export function lifecycleActionMayRun(input: { approvedForDeployment: boolean; hasIsolatedDbAcceptance: boolean }) {
  return input.approvedForDeployment && input.hasIsolatedDbAcceptance;
}
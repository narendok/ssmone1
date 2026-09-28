import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const employeeAccessSchema = z.object({ employeeId: z.string().uuid(), departmentId: z.string().uuid().nullable(), roleId: z.string().uuid().nullable(), permissionIds: z.array(z.string().uuid()).max(200), accessActive: z.boolean() });

async function requireSystemAdmin(sb: any, userId: string) { const { data, error } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" }); if (error || !data) throw new Error("Only a system administrator can manage employee access."); }

export const saveEmployeeAccess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => employeeAccessSchema.parse(data)).handler(async ({ data, context }) => {
  const sb = context.supabase as any;
  await requireSystemAdmin(sb, context.userId);
  const { data: employee, error: employeeError } = await sb.from("employees").select("id").eq("id", data.employeeId).maybeSingle();
  if (employeeError || !employee) throw new Error("Employee record was not found.");
  if (data.departmentId) { const { data: department, error } = await sb.from("departments").select("id").eq("id", data.departmentId).eq("is_active", true).maybeSingle(); if (error || !department) throw new Error("Select an active department."); }
  if (data.roleId) { const { data: role, error } = await sb.from("access_roles").select("id").eq("id", data.roleId).maybeSingle(); if (error || !role) throw new Error("Select an existing access role."); }
  const permissionIds = [...new Set(data.permissionIds)];
  if (permissionIds.length) { const { data: permissions, error } = await sb.from("permissions").select("id").in("id", permissionIds); if (error || permissions?.length !== permissionIds.length) throw new Error("One or more selected capabilities are unavailable."); }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: employeeSaveError } = await supabaseAdmin.from("employees").update({ primary_department_id: data.departmentId, default_role_id: data.roleId, employment_status: data.accessActive ? "ACTIVE" : "SUSPENDED" }).eq("id", data.employeeId);
  if (employeeSaveError) throw new Error("Could not save the employee access profile.");
  const { error: departmentRemoveError } = await supabaseAdmin.from("employee_departments").delete().eq("employee_id", data.employeeId);
  if (departmentRemoveError) throw new Error("Could not update department membership.");
  if (data.departmentId) { const { error } = await supabaseAdmin.from("employee_departments").insert({ employee_id: data.employeeId, department_id: data.departmentId, is_primary: true }); if (error) throw new Error("Could not assign the employee department."); }
  const { error: roleRemoveError } = await supabaseAdmin.from("employee_access_roles").delete().eq("employee_id", data.employeeId);
  if (roleRemoveError) throw new Error("Could not update role assignment.");
  if (data.roleId) { const { error } = await supabaseAdmin.from("employee_access_roles").insert({ employee_id: data.employeeId, role_id: data.roleId, assigned_by_user_id: context.userId }); if (error) throw new Error("Could not assign the access role."); }
  if (data.roleId) {
    const { error: capabilitiesRemoveError } = await supabaseAdmin.from("access_role_permissions").delete().eq("role_id", data.roleId);
    if (capabilitiesRemoveError) throw new Error("Could not update role capabilities.");
    if (permissionIds.length) { const { error } = await supabaseAdmin.from("access_role_permissions").insert(permissionIds.map((permissionId) => ({ role_id: data.roleId as string, permission_id: permissionId }))); if (error) throw new Error("Could not save role capabilities."); }
  }
  const { error: logError } = await supabaseAdmin.from("activity_log").insert({ actor_user_id: context.userId, module_key: "hr", entity_type: "employee_access", entity_id: data.employeeId, action: "access_updated", summary: `${data.accessActive ? "Activated" : "Deactivated"} employee access`, after_data: { departmentId: data.departmentId, roleId: data.roleId, permissionCount: permissionIds.length, accessActive: data.accessActive } });
  if (logError) throw new Error("Access changes were saved, but the audit record could not be written.");
  return { employeeId: data.employeeId, employmentStatus: data.accessActive ? "ACTIVE" : "SUSPENDED" };
});
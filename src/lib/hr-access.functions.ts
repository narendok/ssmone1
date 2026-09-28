import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const employeeAccessSchema = z.object({ employeeId: z.string().uuid(), departmentId: z.string().uuid().nullable(), roleId: z.string().uuid().nullable(), permissionIds: z.array(z.string().uuid()).max(200), accessActive: z.boolean() });
const inviteEmployeeSchema = z.object({ employeeId: z.string().uuid() });

function isDeliverableWorkEmail(value: string) {
  const email = value.trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !["example.com", "example.org", "example.net", "invalid", "localhost", "test"].includes(domain) && !domain.endsWith(".invalid") && !domain.endsWith(".test");
}

async function requireSystemAdmin(sb: any, userId: string) { const { data, error } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" }); if (error || !data) throw new Error("Only a system administrator can manage employee access."); }

export const getHrAccessWorkspace = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const sb = context.supabase as any;
  await requireSystemAdmin(sb, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [employees, departments, roles, permissions] = await Promise.all([
    supabaseAdmin.from("employees").select("id,user_id,display_name,employee_code,official_email,designation,employment_status,primary_department_id,default_role_id,memberships:employee_departments(department_id,is_primary),roles:employee_access_roles(role_id,role:access_roles(id,name,description))").order("display_name"),
    supabaseAdmin.from("departments").select("id,name,code").eq("is_active", true).order("sort_order"),
    supabaseAdmin.from("access_roles").select("id,name,description,is_system,access_role_permissions(permission_id)").order("name"),
    supabaseAdmin.from("permissions").select("id,key,label,description,module_key").order("module_key").order("label"),
  ]);
  for (const result of [employees, departments, roles, permissions]) if (result.error) throw new Error("Could not load employee access records.");
  return {
    employees: (employees.data ?? []).map((employee: any) => ({ ...employee, memberships: employee.memberships ?? [], roles: employee.roles ?? [] })),
    departments: departments.data ?? [],
    roles: (roles.data ?? []).map((role: any) => ({ ...role, permissionIds: (role.access_role_permissions ?? []).map((assignment: { permission_id: string }) => assignment.permission_id) })),
    permissions: permissions.data ?? [],
  };
});

export const inviteEmployeeAccess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => inviteEmployeeSchema.parse(data)).handler(async ({ data, context }) => {
  const sb = context.supabase as any;
  await requireSystemAdmin(sb, context.userId);
  const { data: employee, error: employeeError } = await sb.from("employees").select("id,display_name,official_email,user_id,employment_status").eq("id", data.employeeId).maybeSingle();
  if (employeeError || !employee) throw new Error("Employee record was not found.");
  if (!employee.official_email) throw new Error("Add a work email before sending an invitation.");
  if (!isDeliverableWorkEmail(employee.official_email)) throw new Error("This employee has a sample or placeholder email. Update their profile with a real work email before sending an invitation.");
  if (employee.user_id) throw new Error("This employee already has a login account.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const appUrl = process.env["PUBLIC_APP_URL"];
  const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(employee.official_email, {
    data: { display_name: employee.display_name ?? employee.official_email, employee_id: employee.id },
    ...(appUrl?.startsWith("http") ? { redirectTo: `${appUrl}/auth` } : {}),
  });
  if (invite.error) throw new Error(invite.error.message);
  const invitedUserId = invite.data.user?.id;
  if (!invitedUserId) throw new Error("The invitation could not be created.");
  const { error: employeeUpdateError } = await supabaseAdmin.from("employees").update({ user_id: invitedUserId, employment_status: "ACTIVE" }).eq("id", employee.id).is("user_id", null);
  if (employeeUpdateError) throw new Error("The invitation was sent, but the employee account could not be linked.");
  const { error: activityError } = await supabaseAdmin.from("activity_log").insert({ actor_user_id: context.userId, module_key: "hr", entity_type: "employee_access", entity_id: employee.id, action: "access_invited", summary: `Sent workspace invitation to ${employee.official_email}` });
  if (activityError) throw new Error("The invitation was sent, but its activity record could not be written.");
  return { email: employee.official_email };
});

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
  const { error: logError } = await supabaseAdmin.from("activity_log").insert({ actor_user_id: context.userId, module_key: "hr", entity_type: "employee_access", entity_id: data.employeeId, action: "access_updated", summary: `${data.accessActive ? "Activated" : "Deactivated"} employee access`, after_data: { departmentId: data.departmentId, roleId: data.roleId, roleCapabilityCount: permissionIds.length, accessActive: data.accessActive } });
  if (logError) throw new Error("Access changes were saved, but the audit record could not be written.");
  return { employeeId: data.employeeId, employmentStatus: data.accessActive ? "ACTIVE" : "SUSPENDED" };
});
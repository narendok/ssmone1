import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "narendok@gmail.com";

const DEPARTMENTS = [
  ["Software", "SW"],
  ["Embedded Hardware", "EHW"],
  ["Embedded Software", "ESW"],
  ["Purchase", "PUR/PD"],
  ["Production", "MPRD/PRD-01"],
  ["Engineering Production", "EPRD/PRD-02"],
  ["Sales", "SAL"],
  ["Customer Support", "CS"],
  ["Finance", "FIN"],
  ["Human Resources", "HR"],
  ["Operations", "OP"],
  ["Marketing & Business Development", "MKT/BD"],
  ["Research & Development", "R&D"],
  ["Maintenance", "MNT"],
  ["Quality Assurance", "QA"],
  ["Stores", "STR"],
  ["Management Review", "MR"],
] as const;

const ROLE_DEFINITIONS = [
  ["System Admin", "Full company administration", true],
  ["Management", "Organization-wide visibility and approvals", true],
  ["Head of Department", "Department management", true],
  ["Project Manager", "Project coordination", true],
  ["Team Lead", "Team workflow management", true],
  ["Employee / Engineer", "Standard internal access", true],
  ["HR Admin", "Employee administration", true],
  ["Sales", "Sales operations", true],
  ["Purchase", "Procurement operations", true],
  ["Storekeeper", "Inventory and inwarding", true],
  ["Production Manager / Operator", "Production operations", true],
  ["QA", "Quality operations", true],
  ["Maintenance", "Maintenance operations", true],
  ["Facility", "Facility operations", true],
  ["Security", "Security operations", true],
  ["Finance", "Finance operations", true],
  ["Viewer / Auditor", "Read-only access", true],
] as const;

const MODULES = [
  ["home", "Home", "Home", "/", "ENABLED", 10],
  ["my_work", "My Work", "Work", "/tasks", "ENABLED", 20],
  ["projects", "Projects", "Work", "/projects", "ENABLED", 30],
  ["engineering", "R&D / PartsBench", "Engineering", "/", "ENABLED", 40],
  ["procurement", "Procurement", "Operations", "/procurement/orders", "ENABLED", 50],
  ["quality", "Quality", "Operations", "/coming-soon/quality", "COMING_SOON", 60],
  ["people", "People", "Workplace", "/coming-soon/people", "COMING_SOON", 70],
  ["documents", "Documents", "Workplace", "/coming-soon/documents", "COMING_SOON", 80],
  ["admin", "Administration", "System", "/admin", "ENABLED", 90],
] as const;

const PERMISSION_MODULES = ["home", "my_work", "projects", "engineering", "procurement", "quality", "people", "documents", "admin"];
const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "approve", "share", "export", "admin"];

export async function bootstrapSsmOne() {
  const { data: existingOrg } = await supabaseAdmin.from("organizations").select("id").limit(1).maybeSingle();
  if (!existingOrg) {
    const { error } = await supabaseAdmin.from("organizations").insert({});
    if (error) throw error;
  }

  const { error: departmentsError } = await supabaseAdmin.from("departments").upsert(
    DEPARTMENTS.map(([name, code], index) => ({ name, code, sort_order: index + 1, document_code_enabled: true })),
    { onConflict: "code" },
  );
  if (departmentsError) throw departmentsError;

  const permissions = PERMISSION_MODULES.flatMap((moduleKey) =>
    PERMISSION_ACTIONS.map((action) => ({
      key: `${moduleKey}.${action}`,
      module_key: moduleKey,
      label: `${moduleKey.replace(/_/g, " ")} ${action}`,
      description: `Allows ${action} access in ${moduleKey.replace(/_/g, " ")}.`,
    })),
  );
  const { error: permissionsError } = await supabaseAdmin.from("permissions").upsert(permissions, { onConflict: "key" });
  if (permissionsError) throw permissionsError;

  const { error: rolesError } = await supabaseAdmin.from("access_roles").upsert(
    ROLE_DEFINITIONS.map(([name, description, is_system]) => ({ name, description, is_system })),
    { onConflict: "name" },
  );
  if (rolesError) throw rolesError;

  const { error: modulesError } = await supabaseAdmin.from("application_modules").upsert(
    MODULES.map(([key, name, group_key, route_path, status, sort_order]) => ({ key, name, group_key, route_path, status, sort_order })),
    { onConflict: "key" },
  );
  if (modulesError) throw modulesError;

  const { data: roles, error: roleFetchError } = await supabaseAdmin.from("access_roles").select("id, name");
  if (roleFetchError) throw roleFetchError;
  const systemAdminRole = roles.find((role) => role.name === "System Admin");
  if (!systemAdminRole) throw new Error("System Admin role could not be prepared");

  const { data: permissionRows, error: permissionFetchError } = await supabaseAdmin.from("permissions").select("id");
  if (permissionFetchError) throw permissionFetchError;
  const { error: rolePermissionError } = await supabaseAdmin.from("access_role_permissions").upsert(
    permissionRows.map((permission) => ({ role_id: systemAdminRole.id, permission_id: permission.id })),
    { onConflict: "role_id,permission_id" },
  );
  if (rolePermissionError) throw rolePermissionError;

  const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;
  let adminUser = authUsers.users.find((user) => user.email?.toLowerCase() === ADMIN_EMAIL);
  let invitationSent = false;
  if (!adminUser) {
    const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(ADMIN_EMAIL, {
      data: { display_name: "System Administrator" },
      redirectTo: `${process.env['PUBLIC_APP_URL'] ?? 'https://id-preview--33eca6ac-b01a-4598-8314-5c773b2b8543.lovable.app'}/auth`,
    });
    if (invite.error || !invite.data.user) throw new Error(invite.error?.message ?? "Could not invite the initial administrator");
    adminUser = invite.data.user;
    invitationSent = true;
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: adminUser.id,
    email: ADMIN_EMAIL,
    display_name: adminUser.user_metadata?.display_name ?? "System Administrator",
  }, { onConflict: "id" });
  if (profileError) throw profileError;

  const { error: legacyRoleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: adminUser.id, role: "admin" }, { onConflict: "user_id,role" });
  if (legacyRoleError) throw legacyRoleError;

  const { data: rAndDDepartment, error: departmentError } = await supabaseAdmin.from("departments").select("id").eq("code", "R&D").single();
  if (departmentError) throw departmentError;
  const { data: employee, error: employeeError } = await supabaseAdmin.from("employees").upsert({
    user_id: adminUser.id,
    official_email: ADMIN_EMAIL,
    display_name: adminUser.user_metadata?.display_name ?? "System Administrator",
    employment_status: "ACTIVE",
    primary_department_id: rAndDDepartment.id,
    default_role_id: systemAdminRole.id,
  }, { onConflict: "user_id" }).select("id").single();
  if (employeeError) throw employeeError;

  const { error: employeeDepartmentError } = await supabaseAdmin.from("employee_departments").upsert({
    employee_id: employee.id,
    department_id: rAndDDepartment.id,
    is_primary: true,
  }, { onConflict: "employee_id,department_id" });
  if (employeeDepartmentError) throw employeeDepartmentError;

  const { error: employeeRoleError } = await supabaseAdmin.from("employee_access_roles").upsert({
    employee_id: employee.id,
    role_id: systemAdminRole.id,
    assigned_by_user_id: adminUser.id,
  }, { onConflict: "employee_id,role_id" });
  if (employeeRoleError) throw employeeRoleError;

  return { invitationSent };
}
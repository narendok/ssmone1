import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "narendok@gmail.com";

const DEPARTMENTS = [
  ["Hardware & R&D", "RND"],
  ["Procurement, Stores & Incoming Quality", "PROC"],
  ["Production & Calibration", "PROD"],
  ["Facility, Maintenance, Security, Utilities & Assets", "FAC"],
  ["Operations & QMS", "OPS"],
  ["Sales", "SAL"],
  ["Human Resources", "HR"],
  ["Finance", "FIN"],
] as const;

const ROLE_DEFINITIONS = [
  ["Platform Owner", "Platform-wide administration and oversight", true],
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
  ["Asset Manager", "Asset lifecycle and custody operations", true],
  ["Calibration", "Measurement equipment and calibration operations", true],
  ["QMS Manager", "QMS governance, audit and CAPA operations", true],
  ["Customer Service", "Customer complaint, warranty and return operations", true],
  ["External Collaboration Manager", "Controlled partner access and external collaboration", true],
  ["Finance", "Finance operations", true],
  ["Viewer / Auditor", "Read-only access", true],
] as const;

const MODULES = [
  ["home", "Home", "Home", "/", "ENABLED", 10],
  ["my_work", "My Work", "Work", "/tasks", "ENABLED", 20],
  ["projects", "Projects", "Work", "/projects", "ENABLED", 30],
  ["engineering", "Engineering", "Engineering", "/", "ENABLED", 40],
  ["procurement", "Procurement", "Operations", "/procurement/requests", "ENABLED", 50],
  ["stores", "Stores", "Operations", "/stores/inventory", "ENABLED", 55],
  ["quality", "Quality", "Operations", "/quality/incoming", "ENABLED", 60],
  ["finance", "Finance", "Operations", "/finance/expenses", "ENABLED", 65],
  ["people", "People", "Workplace", "/coming-soon/people", "COMING_SOON", 70],
  ["documents", "Documents", "Workplace", "/coming-soon/documents", "COMING_SOON", 80],
  ["admin", "System controls", "System", "/admin", "ENABLED", 90],
  ["facility", "Facility", "Operations", "/facility", "ENABLED", 80],
  ["assets", "Assets", "Operations", "/assets", "ENABLED", 81],
  ["maintenance", "Maintenance", "Operations", "/maintenance", "ENABLED", 82],
  ["calibration", "Calibration", "Operations", "/calibration", "ENABLED", 83],
  ["security", "Security", "Operations", "/security", "ENABLED", 84],
  ["workplace", "Workplace", "Operations", "/workplace", "ENABLED", 85],
  ["qms", "QMS", "Operations", "/qms", "ENABLED", 86],
  ["customer_service", "Customer Service", "Operations", "/customer-service", "ENABLED", 87],
  ["external_collaboration", "External Collaboration", "Operations", "/external-collaboration", "ENABLED", 88],
] as const;

const PERMISSION_MODULES = ["home", "my_work", "projects", "engineering", "procurement", "stores", "quality", "finance", "people", "documents", "admin", "facility", "assets", "maintenance", "calibration", "security", "workplace", "qms", "customer_service", "external_collaboration"];
const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "approve", "share", "export", "admin"];
const HR_PERMISSIONS = [
  ["hr.view", "hr", "View HR workspace", "Allows access to the HR workspace and employee self-service."],
  ["recruitment.manage", "hr", "Manage recruitment", "Allows creation and management of requisitions, openings, and candidates."],
  ["leave.manage", "hr", "Manage leave", "Allows leave administration."],
  ["leave.approve", "hr", "Approve leave", "Allows review and approval of leave requests."],
  ["training.manage", "hr", "Manage training", "Allows administration of learning programs and enrollments."],
] as const;

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

  const permissions = [
    ...PERMISSION_MODULES.flatMap((moduleKey) =>
      PERMISSION_ACTIONS.map((action) => ({
        key: `${moduleKey}.${action}`,
        module_key: moduleKey,
        label: `${moduleKey.replace(/_/g, " ")} ${action}`,
        description: `Allows ${action} access in ${moduleKey.replace(/_/g, " ")}.`,
      })),
    ),
    ...HR_PERMISSIONS.map(([key, module_key, label, description]) => ({ key, module_key, label, description })),
  ];
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
  const platformOwnerRole = roles.find((role) => role.name === "Platform Owner");
  if (!platformOwnerRole) throw new Error("Platform Owner role could not be prepared");

  const { data: permissionRows, error: permissionFetchError } = await supabaseAdmin.from("permissions").select("id");
  if (permissionFetchError) throw permissionFetchError;
  const { error: rolePermissionError } = await supabaseAdmin.from("access_role_permissions").upsert(
    permissionRows.map((permission) => ({ role_id: platformOwnerRole.id, permission_id: permission.id })),
    { onConflict: "role_id,permission_id" },
  );
  if (rolePermissionError) throw rolePermissionError;

  const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;
  let adminUser = authUsers.users.find((user) => user.email?.toLowerCase() === ADMIN_EMAIL);
  let invitationSent = false;
  if (!adminUser) {
    const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(ADMIN_EMAIL, {
      data: { display_name: "Platform Owner" },
      redirectTo: `${process.env['PUBLIC_APP_URL'] ?? 'https://id-preview--33eca6ac-b01a-4598-8314-5c773b2b8543.lovable.app'}/auth`,
    });
    if (invite.error || !invite.data.user) throw new Error(invite.error?.message ?? "Could not invite the initial administrator");
    adminUser = invite.data.user;
    invitationSent = true;
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: adminUser.id,
    email: ADMIN_EMAIL,
    display_name: adminUser.user_metadata?.display_name ?? "Platform Owner",
  }, { onConflict: "id" });
  if (profileError) throw profileError;

  const { error: legacyRoleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: adminUser.id, role: "admin" }, { onConflict: "user_id,role" });
  if (legacyRoleError) throw legacyRoleError;

  const { data: rAndDDepartment, error: departmentError } = await supabaseAdmin.from("departments").select("id").eq("code", "RND").eq("is_active", true).single();
  if (departmentError) throw departmentError;
  const { data: employee, error: employeeError } = await supabaseAdmin.from("employees").upsert({
    user_id: adminUser.id,
    official_email: ADMIN_EMAIL,
    display_name: adminUser.user_metadata?.display_name ?? "Platform Owner",
    employment_status: "ACTIVE",
    primary_department_id: rAndDDepartment.id,
    default_role_id: platformOwnerRole.id,
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
    role_id: platformOwnerRole.id,
    assigned_by_user_id: adminUser.id,
  }, { onConflict: "employee_id,role_id" });
  if (employeeRoleError) throw employeeRoleError;

  return { invitationSent };
}
import { createServerFn } from "@tanstack/react-start";

export const DEMO_ROLES = ["admin", "project_manager", "lead_engineer", "purchase", "storekeeper", "member"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

const DEMO_PASSWORD = "PartsBenchDemo!2026";

const DEMO_USERS: Record<DemoRole, { email: string; name: string }> = {
  admin: { email: "demo.admin@partsbench.test", name: "Demo Admin" },
  purchase: { email: "demo.purchase@partsbench.test", name: "Demo Purchase" },
  storekeeper: { email: "demo.store@partsbench.test", name: "Demo Storekeeper" },
  member: { email: "demo.member@partsbench.test", name: "Demo Member" },
  project_manager: { email: "demo.pm@partsbench.test", name: "Demo Project Manager" },
  lead_engineer: { email: "demo.lead@partsbench.test", name: "Demo Lead Engineer" },
};

/** Creates (or repairs) a demo account for the requested role and returns its credentials. */
export const ensureDemoAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { role: DemoRole }) => {
    if (!DEMO_ROLES.includes(data?.role)) throw new Error("Unknown demo role");
    return data;
  })
  .handler(async ({ data }) => {
    const profile = DEMO_USERS[data.role];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find existing auth user by email.
    let userId: string | null = null;
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === profile.email)?.id ?? null;

    if (userId) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: profile.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: profile.name },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Could not create the demo account");
      userId = created.user.id;
    }

    // Make sure the profile row and exactly the requested role exist.
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email: profile.email, display_name: profile.name }, { onConflict: "id" });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (roleError) throw new Error(roleError.message);

    return { email: profile.email, password: DEMO_PASSWORD, name: profile.name };
  });

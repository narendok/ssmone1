import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const interviewSchema = z.object({
  applicationId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  interviewerUserId: z.string().uuid(),
  scheduledFor: z.string().datetime().nullable(),
  meetingNotes: z.string().trim().max(4000).nullable(),
});

const feedbackSchema = z.object({
  roundId: z.string().uuid(),
  rating: z.number().min(1).max(5).nullable(),
  recommendation: z.enum(["strong_yes", "yes", "mixed", "no"]).nullable(),
  strengths: z.string().trim().max(4000).nullable(),
  concerns: z.string().trim().max(4000).nullable(),
});

const offerSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(["draft", "pending_approval", "approved", "sent", "accepted", "declined", "withdrawn"]),
  annualCompensation: z.number().nonnegative().nullable(),
  currency: z.string().trim().min(3).max(8),
  notes: z.string().trim().max(4000).nullable(),
});

const trainingProgramSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).nullable(),
  departmentId: z.string().uuid().nullable(),
  deliveryMode: z.enum(["self_paced", "instructor_led", "external", "on_the_job"]),
  isMandatory: z.boolean(),
});

const trainingEnrollmentSchema = z.object({
  programId: z.string().uuid(),
  employeeId: z.string().uuid(),
  dueDate: z.string().min(10).nullable(),
});

const policySchema = z.object({
  policyCode: z.string().trim().min(2).max(64).regex(/^[A-Z0-9-]+$/),
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(4000).nullable(),
  version: z.string().trim().min(1).max(32),
  isActive: z.boolean(),
});

const acknowledgePolicySchema = z.object({ policyId: z.string().uuid() });

const onboardingPlanSchema = z.object({
  name: z.string().trim().min(2).max(200),
  departmentId: z.string().uuid().nullable(),
  description: z.string().trim().max(4000).nullable(),
});

const onboardingItemSchema = z.object({
  planId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).nullable(),
  ownerKind: z.enum(["employee", "manager", "hr", "it"]),
  dueOffsetDays: z.number().int().min(0).max(365),
  isRequired: z.boolean(),
});

async function requirePermission(sb: any, userId: string, permission: string) {
  const { data, error } = await sb.rpc("has_permission", { _user_id: userId, _permission_key: permission });
  if (error || !data) throw new Error("You do not have permission to perform this action.");
}

async function requireRecruitment(sb: any, userId: string) {
  const { data, error } = await sb.rpc("can_manage_recruitment", { _uid: userId });
  if (error || !data) throw new Error("You do not have permission to manage recruitment.");
}

async function requireTraining(sb: any, userId: string) {
  const { data, error } = await sb.rpc("can_manage_training", { _uid: userId });
  if (error || !data) throw new Error("You do not have permission to manage learning and policies.");
}

async function requireOnboarding(sb: any, userId: string) {
  const { data, error } = await sb.rpc("can_manage_onboarding", { _uid: userId });
  if (error || !data) throw new Error("You do not have permission to manage onboarding.");
}

async function getEmployeeId(sb: any, userId: string) {
  const { data, error } = await sb.from("employees").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Your employee profile is not set up yet.");
  return data.id as string;
}

async function logActivity(sb: any, userId: string, entityType: string, entityId: string, action: string, summary: string, afterData?: Record<string, unknown>) {
  const { error } = await sb.from("activity_log").insert({
    actor_user_id: userId,
    module_key: "hr",
    entity_type: entityType,
    entity_id: entityId,
    action,
    summary,
    after_data: afterData ?? null,
  });
  if (error) throw new Error(error.message);
}

export const createInterviewRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => interviewSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireRecruitment(sb, context.userId);
    const { data: round, error } = await sb.from("hr_interview_rounds").insert({
      application_id: data.applicationId,
      title: data.title,
      interviewer_user_id: data.interviewerUserId,
      scheduled_for: data.scheduledFor,
      meeting_notes: data.meetingNotes,
      created_by: context.userId,
    }).select("id").single();
    if (error || !round) throw new Error(error?.message ?? "Could not schedule the interview.");
    await logActivity(sb, context.userId, "interview_round", round.id, "scheduled", `Scheduled interview: ${data.title}`);
    return { id: round.id };
  });

export const submitInterviewFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => feedbackSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: round, error: roundError } = await sb.from("hr_interview_rounds").select("id,interviewer_user_id").eq("id", data.roundId).maybeSingle();
    if (roundError || !round) throw new Error("Interview round not found.");
    const { data: recruitmentManager } = await sb.rpc("can_manage_recruitment", { _uid: context.userId });
    if (!recruitmentManager && round.interviewer_user_id !== context.userId) throw new Error("You can only submit feedback for your own interview.");
    const { data: feedback, error } = await sb.from("hr_interview_feedback").upsert({
      round_id: data.roundId,
      interviewer_user_id: context.userId,
      rating: data.rating,
      recommendation: data.recommendation,
      strengths: data.strengths,
      concerns: data.concerns,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "round_id,interviewer_user_id" }).select("id").single();
    if (error || !feedback) throw new Error(error?.message ?? "Could not save interview feedback.");
    await sb.from("hr_interview_rounds").update({ status: "completed" }).eq("id", data.roundId);
    await logActivity(sb, context.userId, "interview_feedback", feedback.id, "submitted", "Submitted interview feedback");
    return { id: feedback.id };
  });

export const saveOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => offerSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireRecruitment(sb, context.userId);
    const compensation = data.annualCompensation === null ? {} : { annual_compensation: data.annualCompensation, currency: data.currency };
    const { data: offer, error } = await sb.from("hr_offers").upsert({
      application_id: data.applicationId,
      status: data.status,
      compensation,
      notes: data.notes,
      approved_by: data.status === "approved" ? context.userId : null,
      sent_at: data.status === "sent" ? new Date().toISOString() : null,
      created_by: context.userId,
    }, { onConflict: "application_id" }).select("id").single();
    if (error || !offer) throw new Error(error?.message ?? "Could not save the offer.");
    await logActivity(sb, context.userId, "offer", offer.id, "saved", `Updated offer as ${data.status}`, { status: data.status });
    return { id: offer.id };
  });

export const createTrainingProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => trainingProgramSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireTraining(sb, context.userId);
    const { data: program, error } = await sb.from("hr_training_programs").insert({
      title: data.title, description: data.description, department_id: data.departmentId,
      delivery_mode: data.deliveryMode, is_mandatory: data.isMandatory, created_by: context.userId,
    }).select("id").single();
    if (error || !program) throw new Error(error?.message ?? "Could not create the learning program.");
    await logActivity(sb, context.userId, "training_program", program.id, "created", `Created learning program: ${data.title}`);
    return { id: program.id };
  });

export const assignTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => trainingEnrollmentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireTraining(sb, context.userId);
    const { data: enrollment, error } = await sb.from("hr_training_enrollments").upsert({
      employee_id: data.employeeId, program_id: data.programId, due_date: data.dueDate, status: "assigned",
    }, { onConflict: "employee_id,program_id" }).select("id").single();
    if (error || !enrollment) throw new Error(error?.message ?? "Could not assign the learning program.");
    await logActivity(sb, context.userId, "training_enrollment", enrollment.id, "assigned", "Assigned learning program");
    return { id: enrollment.id };
  });

export const createPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => policySchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireTraining(sb, context.userId);
    const { data: policy, error } = await sb.from("hr_policies").insert({
      policy_code: data.policyCode, title: data.title, summary: data.summary, version: data.version,
      is_active: data.isActive, published_at: data.isActive ? new Date().toISOString() : null, created_by: context.userId,
    }).select("id").single();
    if (error || !policy) throw new Error(error?.message ?? "Could not publish the policy.");
    await logActivity(sb, context.userId, "policy", policy.id, "created", `Published policy: ${data.title}`);
    return { id: policy.id };
  });

export const acknowledgePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => acknowledgePolicySchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const employeeId = await getEmployeeId(sb, context.userId);
    const { error } = await sb.from("hr_policy_acknowledgements").upsert({ policy_id: data.policyId, employee_id: employeeId }, { onConflict: "policy_id,employee_id" });
    if (error) throw new Error(error.message);
    await logActivity(sb, context.userId, "policy", data.policyId, "acknowledged", "Acknowledged policy");
    return { policyId: data.policyId };
  });

export const createOnboardingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => onboardingPlanSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireOnboarding(sb, context.userId);
    const { data: plan, error } = await sb.from("hr_onboarding_plans").insert({ name: data.name, department_id: data.departmentId, description: data.description, created_by: context.userId }).select("id").single();
    if (error || !plan) throw new Error(error?.message ?? "Could not create the onboarding plan.");
    await logActivity(sb, context.userId, "onboarding_plan", plan.id, "created", `Created onboarding plan: ${data.name}`);
    return { id: plan.id };
  });

export const createOnboardingItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => onboardingItemSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireOnboarding(sb, context.userId);
    const { data: item, error } = await sb.from("hr_onboarding_items").insert({
      plan_id: data.planId, title: data.title, description: data.description, owner_kind: data.ownerKind,
      due_offset_days: data.dueOffsetDays, is_required: data.isRequired,
    }).select("id").single();
    if (error || !item) throw new Error(error?.message ?? "Could not add the onboarding item.");
    await logActivity(sb, context.userId, "onboarding_item", item.id, "created", `Added onboarding step: ${data.title}`);
    return { id: item.id };
  });

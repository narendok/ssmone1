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

const launchOnboardingSchema = z.object({
  applicationId: z.string().uuid(),
  planId: z.string().uuid().nullable(),
  officialEmail: z.string().trim().email().max(254),
  designation: z.string().trim().max(160).nullable(),
  departmentId: z.string().uuid().nullable(),
  reportingManagerUserId: z.string().uuid().nullable(),
  startDate: z.string().min(10).nullable(),
  welcomeKitRequired: z.boolean(),
});

const onboardingItemStatusSchema = z.object({
  itemId: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "completed", "skipped"]),
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

const leaveRequestSchema = z.object({ employeeId: z.string().uuid(), leaveTypeId: z.string().uuid(), startDate: z.string().min(10), endDate: z.string().min(10), totalDays: z.number().positive(), reason: z.string().max(2000).nullable() });
const requisitionSchema = z.object({ title: z.string().min(1).max(200), departmentId: z.string().uuid().nullable(), jobProfileId: z.string().uuid().nullable(), employmentType: z.string().min(1).max(80), workMode: z.string().min(1).max(80), location: z.string().max(160).nullable(), headcount: z.number().int().positive().max(100), justification: z.string().max(4000).nullable(), targetStartDate: z.string().nullable() });
const postingSchema = z.object({ requisitionId: z.string().uuid().nullable(), departmentId: z.string().uuid().nullable(), slug: z.string().min(2).max(120), title: z.string().min(1).max(200), summary: z.string().max(240).nullable(), description: z.string().min(1).max(12000), location: z.string().max(160).nullable(), employmentType: z.string().min(1).max(80), workMode: z.string().min(1).max(80), isPublished: z.boolean() });
const publicApplicationSchema = z.object({ postingSlug: z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), fullName: z.string().trim().min(2).max(160), email: z.string().trim().email().max(254), phone: z.string().trim().max(40).nullable(), currentLocation: z.string().trim().max(160).nullable(), coverLetter: z.string().trim().max(4000).nullable(), resume: z.object({ filename: z.string().trim().min(1).max(180), mimeType: z.enum(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]), storagePath: z.string().regex(/^public-applications\/[0-9a-f-]+\/[a-z0-9-]+\.(pdf|doc|docx)$/), fileSize: z.number().int().positive().max(10 * 1024 * 1024) }).nullable() });
const publicApplicationStatusSchema = z.object({ statusToken: z.string().uuid() });
const applicationPipelineSchema = z.object({ applicationId: z.string().uuid(), stage: z.enum(["applied", "screening", "assessment", "interview", "offer", "hired", "rejected", "withdrawn"]), status: z.enum(["active", "on_hold", "hired", "rejected", "withdrawn"]) });
const candidateResumeSchema = z.object({ candidateId: z.string().uuid() });

export const createLeaveRequest = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => leaveRequestSchema.parse(data)).handler(async ({ data, context }) => {
  const sb = context.supabase as any; const employeeId = await getEmployeeId(sb, context.userId); if (employeeId !== data.employeeId) throw new Error("You can only submit leave for your own employee profile.");
  const { data: employee, error: employeeError } = await sb.from("employees").select("reporting_manager_user_id").eq("id", employeeId).maybeSingle(); if (employeeError) throw new Error(employeeError.message);
  const { data: request, error } = await sb.from("hr_leave_requests").insert({ employee_id: employeeId, leave_type_id: data.leaveTypeId, start_date: data.startDate, end_date: data.endDate, total_days: data.totalDays, reason: data.reason, status: "pending", approver_user_id: employee?.reporting_manager_user_id ?? null, created_by: context.userId }).select("id").single();
  if (error || !request) throw new Error(error?.message ?? "Could not submit leave request."); await logActivity(sb, context.userId, "leave_request", request.id, "created", "Submitted leave request");
  return { id: request.id };
});

export const createJobRequisition = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => requisitionSchema.parse(data)).handler(async ({ data, context }) => {
  const sb = context.supabase as any; await requirePermission(sb, context.userId, "recruitment.manage"); const { data: duplicate, error: duplicateError } = await sb.from("hr_job_requisitions").select("id,requisition_code,title").ilike("title", data.title.trim()).eq("department_id", data.departmentId).in("status", ["draft", "pending_approval", "approved", "open"]).maybeSingle(); if (duplicateError) throw new Error("Could not check existing openings."); if (duplicate) throw new Error(`Possible existing opening: ${duplicate.requisition_code ?? duplicate.title}. Open that record instead of creating another.`); const { data: requisition, error } = await sb.from("hr_job_requisitions").insert({ title: data.title.trim(), department_id: data.departmentId, job_profile_id: data.jobProfileId, hiring_manager_user_id: context.userId, employment_type: data.employmentType, work_mode: data.workMode, location: data.location, headcount: data.headcount, justification: data.justification, target_start_date: data.targetStartDate, status: "draft", created_by: context.userId }).select("id,requisition_code").single(); if (error || !requisition) throw new Error(error?.message ?? "Could not save requisition."); await logActivity(sb, context.userId, "job_requisition", requisition.id, "created", `Created requisition: ${requisition.requisition_code ?? data.title}`); return { id: requisition.id, requisitionCode: requisition.requisition_code };
});

export const createJobPosting = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => postingSchema.parse(data)).handler(async ({ data, context }) => {
  const sb = context.supabase as any; await requirePermission(sb, context.userId, "recruitment.manage"); const { data: existing } = await sb.from("hr_job_postings").select("id,job_code,title").eq("slug", data.slug).maybeSingle(); if (existing) throw new Error(`This page link is already used by ${existing.job_code ?? existing.title}. Choose a different page link.`); const { data: posting, error } = await sb.from("hr_job_postings").insert({ requisition_id: data.requisitionId, department_id: data.departmentId, slug: data.slug, title: data.title, summary: data.summary, description: data.description, location: data.location, employment_type: data.employmentType, work_mode: data.workMode, is_published: data.isPublished, published_at: data.isPublished ? new Date().toISOString() : null, created_by: context.userId }).select("id,job_code").single(); if (error || !posting) throw new Error(error?.code === "23505" ? "This page link is already used by another opening." : error?.message ?? "Could not save job posting."); await logActivity(sb, context.userId, "job_posting", posting.id, "created", `Created job posting: ${posting.job_code ?? data.title}`); return { id: posting.id, jobCode: posting.job_code };
});

export const submitPublicJobApplication = createServerFn({ method: "POST" }).inputValidator((data) => publicApplicationSchema.parse(data)).handler(async ({ data }) => { const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server"); const { data: result, error } = await sb.rpc("submit_public_job_application", { _posting_slug: data.postingSlug, _full_name: data.fullName, _email: data.email, _phone: data.phone ?? "", _current_location: data.currentLocation ?? "", _cover_letter: data.coverLetter ?? "", _resume_filename: data.resume?.filename ?? null, _resume_mime_type: data.resume?.mimeType ?? null, _resume_storage_path: data.resume?.storagePath ?? null, _resume_file_size: data.resume?.fileSize ?? null }); if (error || !result) throw new Error(error?.message ?? "Could not submit your application."); const parsed = result as { status_token?: string }; if (!parsed.status_token) throw new Error("Your application was saved, but its reference could not be created."); return { statusToken: parsed.status_token }; });

export const getPublicApplicationStatus = createServerFn({ method: "GET" }).inputValidator((data) => publicApplicationStatusSchema.parse(data)).handler(async ({ data }) => { const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server"); const { data: result, error } = await sb.rpc("get_public_application_status", { _status_token: data.statusToken }); if (error) throw new Error("Could not check the application status."); const application = Array.isArray(result) ? result[0] : null; return application ? { roleTitle: application.role_title, stage: application.stage, status: application.status, submittedAt: application.submitted_at } : null; });

export const updateApplicationPipeline = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => applicationPipelineSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireRecruitment(sb, context.userId); const { data: application, error } = await sb.from("hr_applications").update({ stage: data.stage, status: data.status }).eq("id", data.applicationId).select("id,candidate:hr_candidates(full_name)").single(); if (error || !application) throw new Error(error?.message ?? "Could not update the candidate stage."); await logActivity(sb, context.userId, "job_application", application.id, "pipeline_updated", `Updated candidate stage to ${data.stage}`, { stage: data.stage, status: data.status }); return { id: application.id }; });

export const getCandidateResumeUrl = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => candidateResumeSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireRecruitment(sb, context.userId); const { data: candidate, error } = await sb.from("hr_candidates").select("resume_storage_path").eq("id", data.candidateId).maybeSingle(); if (error || !candidate?.resume_storage_path) throw new Error("No resume is available for this candidate."); const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); const { data: signed, error: signedError } = await supabaseAdmin.storage.from("project-drive").createSignedUrl(candidate.resume_storage_path, 60); if (signedError || !signed?.signedUrl) throw new Error("Could not prepare the resume for viewing."); return { url: signed.signedUrl }; });

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

export const launchEmployeeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => launchOnboardingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireOnboarding(sb, context.userId);

    const { data: application, error: applicationError } = await sb
      .from("hr_applications")
      .select("id,stage,status,candidate:hr_candidates(full_name,email,phone)")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (applicationError || !application) throw new Error("Candidate application was not found.");
    if (application.stage !== "hired" || application.status !== "hired") {
      throw new Error("Only a hired candidate can begin employee onboarding.");
    }
    const { data: existingOnboarding, error: existingOnboardingError } = await sb.from("hr_employee_onboardings").select("id").eq("application_id", data.applicationId).maybeSingle();
    if (existingOnboardingError) throw new Error(existingOnboardingError.message);
    if (existingOnboarding) throw new Error("Onboarding has already been started for this candidate.");

    const candidate = application.candidate as { full_name?: string | null; email?: string | null; phone?: string | null } | null;
    const fullName = candidate?.full_name?.trim();
    if (!fullName) throw new Error("The candidate profile is missing a name.");
    const [firstName, ...lastNameParts] = fullName.split(/\s+/);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingAuth, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listUsersError) throw new Error(listUsersError.message);
    const matchedUser = existingAuth.users.find((user) => user.email?.toLowerCase() === data.officialEmail.toLowerCase()) ?? null;

    const { data: employee, error: employeeError } = await supabaseAdmin.from("employees").insert({
      user_id: matchedUser?.id ?? null,
      first_name: firstName || null,
      last_name: lastNameParts.join(" ") || null,
      display_name: fullName,
      official_email: data.officialEmail,
      personal_email: candidate?.email ?? null,
      phone: candidate?.phone ?? null,
      designation: data.designation,
      primary_department_id: data.departmentId,
      reporting_manager_user_id: data.reportingManagerUserId,
      employment_status: matchedUser ? "ACTIVE" : "INVITED",
      date_of_joining: data.startDate,
    }).select("id,employee_code").single();
    if (employeeError?.code === "23505") throw new Error("An employee already exists with this official email.");
    if (employeeError || !employee) throw new Error(employeeError?.message ?? "Could not create the employee profile.");

    if (data.departmentId) {
      const { error: departmentError } = await supabaseAdmin.from("employee_departments").insert({
        employee_id: employee.id,
        department_id: data.departmentId,
        is_primary: true,
      });
      if (departmentError) throw new Error(departmentError.message);
    }

    const { data: onboarding, error: onboardingError } = await supabaseAdmin.from("hr_employee_onboardings").insert({
      application_id: data.applicationId,
      employee_id: employee.id,
      plan_id: data.planId,
      status: "in_progress",
      started_at: new Date().toISOString(),
      welcome_kit_status: data.welcomeKitRequired ? "pending" : "not_required",
      created_by: context.userId,
    }).select("id").single();
    if (onboardingError || !onboarding) throw new Error(onboardingError?.message ?? "Could not start onboarding.");

    if (data.planId) {
      const { data: templateItems, error: templateError } = await sb
        .from("hr_onboarding_items")
        .select("id,title,description,owner_kind,due_offset_days,is_required,sort_order")
        .eq("plan_id", data.planId)
        .order("sort_order");
      if (templateError) throw new Error(templateError.message);
      if (templateItems?.length) {
        const start = data.startDate ? new Date(`${data.startDate}T12:00:00`) : new Date();
        const items = templateItems.map((item: any) => {
          const dueDate = new Date(start);
          dueDate.setDate(dueDate.getDate() + item.due_offset_days);
          const ownerUserId = item.owner_kind === "manager" ? data.reportingManagerUserId : item.owner_kind === "hr" ? context.userId : null;
          return {
            onboarding_id: onboarding.id,
            source_item_id: item.id,
            title: item.title,
            description: item.description,
            owner_kind: item.owner_kind,
            owner_user_id: ownerUserId,
            due_date: dueDate.toISOString().slice(0, 10),
            is_required: item.is_required,
            sort_order: item.sort_order,
          };
        });
        const { error: itemError } = await supabaseAdmin.from("hr_employee_onboarding_items").insert(items);
        if (itemError) throw new Error(itemError.message);
      }
    }
    if (!matchedUser) {
      const redirectTo = `${process.env['PUBLIC_APP_URL'] ?? ""}/auth`;
      const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(data.officialEmail, {
        data: { display_name: fullName, employee_id: employee.id },
        ...(redirectTo.startsWith("http") ? { redirectTo } : {}),
      });
      if (invite.error) throw new Error(invite.error.message);
      if (invite.data.user?.id) {
        const { error: linkError } = await supabaseAdmin.from("employees").update({ user_id: invite.data.user.id }).eq("id", employee.id);
        if (linkError) throw new Error(linkError.message);
      }
    }

    await logActivity(sb, context.userId, "employee_onboarding", onboarding.id, "launched", `Started onboarding for ${fullName}`, { employeeId: employee.id, applicationId: data.applicationId });
    return { employeeId: employee.id, onboardingId: onboarding.id, employeeCode: employee.employee_code };
  });

export const updateEmployeeOnboardingItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => onboardingItemStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: item, error: itemError } = await sb
      .from("hr_employee_onboarding_items")
      .select("id,onboarding_id,owner_user_id,onboarding:hr_employee_onboardings(employee_id)")
      .eq("id", data.itemId)
      .maybeSingle();
    if (itemError || !item) throw new Error("Onboarding item was not found.");
    const employeeId = (item.onboarding as { employee_id?: string } | null)?.employee_id;
    const { data: managesOnboarding } = await sb.rpc("can_manage_onboarding", { _uid: context.userId });
    const isOwner = item.owner_user_id === context.userId;
    const { data: ownEmployee } = await sb.from("employees").select("id").eq("user_id", context.userId).maybeSingle();
    if (!managesOnboarding && !isOwner && ownEmployee?.id !== employeeId) throw new Error("You do not have permission to update this onboarding step.");
    const completed = data.status === "completed";
    const { error } = await sb.from("hr_employee_onboarding_items").update({
      status: data.status,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by_user_id: completed ? context.userId : null,
    }).eq("id", data.itemId);
    if (error) throw new Error(error.message);
    await logActivity(sb, context.userId, "employee_onboarding_item", data.itemId, "status_updated", `Updated onboarding step to ${data.status}`);
    return { id: data.itemId };
  });

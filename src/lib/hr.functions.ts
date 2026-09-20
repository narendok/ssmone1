import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const leaveRequestSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
  totalDays: z.number().positive(),
  reason: z.string().max(2000).nullable(),
});

const requisitionSchema = z.object({
  title: z.string().min(1).max(200),
  departmentId: z.string().uuid().nullable(),
  employmentType: z.string().min(1).max(80),
  workMode: z.string().min(1).max(80),
  location: z.string().max(160).nullable(),
  headcount: z.number().int().positive().max(100),
  justification: z.string().max(4000).nullable(),
  targetStartDate: z.string().nullable(),
});

const postingSchema = z.object({
  requisitionId: z.string().uuid().nullable(),
  departmentId: z.string().uuid().nullable(),
  slug: z.string().min(2).max(120),
  title: z.string().min(1).max(200),
  summary: z.string().max(240).nullable(),
  description: z.string().min(1).max(12000),
  location: z.string().max(160).nullable(),
  employmentType: z.string().min(1).max(80),
  workMode: z.string().min(1).max(80),
  isPublished: z.boolean(),
});

const publicApplicationSchema = z.object({
  postingSlug: z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).nullable(),
  currentLocation: z.string().trim().max(160).nullable(),
  coverLetter: z.string().trim().max(4000).nullable(),
  resume: z.object({
    filename: z.string().trim().min(1).max(180),
    mimeType: z.enum([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]),
    storagePath: z.string().regex(/^public-applications\/[0-9a-f-]+\/[a-z0-9-]+\.(pdf|doc|docx)$/),
    fileSize: z.number().int().positive().max(10 * 1024 * 1024),
  }).nullable(),
});

const publicApplicationStatusSchema = z.object({
  statusToken: z.string().uuid(),
});

const applicationPipelineSchema = z.object({
  applicationId: z.string().uuid(),
  stage: z.enum(["applied", "screening", "assessment", "interview", "offer", "hired", "rejected", "withdrawn"]),
  status: z.enum(["active", "on_hold", "hired", "rejected", "withdrawn"]),
}).superRefine((value, context) => {
  if (["hired", "rejected", "withdrawn"].includes(value.stage) && value.status !== value.stage) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Terminal stages must use the matching status." });
  }
  if (!["hired", "rejected", "withdrawn"].includes(value.stage) && ["hired", "rejected", "withdrawn"].includes(value.status)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A terminal status requires the matching stage." });
  }
});

const candidateResumeSchema = z.object({ candidateId: z.string().uuid() });

async function getEmployeeId(sb: any, userId: string) {
  const { data, error } = await sb.from("employees").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Your employee profile is not set up yet.");
  return data.id as string;
}

async function requirePermission(sb: any, userId: string, permission: string) {
  const { data, error } = await sb.rpc("has_permission", { _user_id: userId, _permission_key: permission });
  if (error || !data) throw new Error("You do not have permission to perform this action.");
}

export const createLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => leaveRequestSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const employeeId = await getEmployeeId(sb, context.userId);
    if (employeeId !== data.employeeId) throw new Error("You can only submit leave for your own employee profile.");

    const { data: employee, error: empErr } = await sb
      .from("employees")
      .select("reporting_manager_user_id")
      .eq("id", employeeId)
      .maybeSingle();
    if (empErr) throw new Error(empErr.message);

    const { data: inserted, error } = await sb
      .from("hr_leave_requests")
      .insert({
        employee_id: employeeId,
        leave_type_id: data.leaveTypeId,
        start_date: data.startDate,
        end_date: data.endDate,
        total_days: data.totalDays,
        reason: data.reason,
        status: "pending",
        approver_user_id: employee?.reporting_manager_user_id ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Could not submit leave request.");

    await sb.from("activity_log").insert({
      actor_user_id: context.userId,
      module_key: "hr",
      entity_type: "leave_request",
      entity_id: inserted.id,
      action: "created",
      summary: "Submitted leave request",
    });

    if (employee?.reporting_manager_user_id) {
      await sb.from("notifications").insert({
        user_id: employee.reporting_manager_user_id,
        category: "HR",
        title: "Leave approval pending",
        body: "A team member submitted a leave request for your review.",
        target_url: "/hr/leave",
      });
    }

    return { id: inserted.id };
  });

export const createJobRequisition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => requisitionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requirePermission(sb, context.userId, "recruitment.manage");

    const { data: inserted, error } = await sb
      .from("hr_job_requisitions")
      .insert({
        title: data.title,
        department_id: data.departmentId,
        hiring_manager_user_id: context.userId,
        employment_type: data.employmentType,
        work_mode: data.workMode,
        location: data.location,
        headcount: data.headcount,
        justification: data.justification,
        target_start_date: data.targetStartDate,
        status: "draft",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Could not save requisition.");

    await sb.from("activity_log").insert({
      actor_user_id: context.userId,
      module_key: "hr",
      entity_type: "job_requisition",
      entity_id: inserted.id,
      action: "created",
      summary: `Created requisition: ${data.title}`,
    });

    return { id: inserted.id };
  });

export const createJobPosting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => postingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requirePermission(sb, context.userId, "recruitment.manage");

    const { data: inserted, error } = await sb
      .from("hr_job_postings")
      .insert({
        requisition_id: data.requisitionId,
        department_id: data.departmentId,
        slug: data.slug,
        title: data.title,
        summary: data.summary,
        description: data.description,
        location: data.location,
        employment_type: data.employmentType,
        work_mode: data.workMode,
        is_published: data.isPublished,
        published_at: data.isPublished ? new Date().toISOString() : null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Could not save job posting.");

    await sb.from("activity_log").insert({
      actor_user_id: context.userId,
      module_key: "hr",
      entity_type: "job_posting",
      entity_id: inserted.id,
      action: "created",
      summary: `Created job posting: ${data.title}`,
    });

    return { id: inserted.id };
  });

export const submitPublicJobApplication = createServerFn({ method: "POST" })
  .inputValidator((data) => publicApplicationSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await sb.rpc("submit_public_job_application", {
      _posting_slug: data.postingSlug,
      _full_name: data.fullName,
      _email: data.email,
      _phone: data.phone ?? "",
      _current_location: data.currentLocation ?? "",
      _cover_letter: data.coverLetter ?? "",
      _resume_filename: data.resume?.filename ?? null,
      _resume_mime_type: data.resume?.mimeType ?? null,
      _resume_storage_path: data.resume?.storagePath ?? null,
      _resume_file_size: data.resume?.fileSize ?? null,
    });
    if (error || !result) throw new Error(error?.message ?? "Could not submit your application.");
    const parsed = result as { status_token?: string };
    if (!parsed.status_token) throw new Error("Your application was saved, but its reference could not be created.");
    return { statusToken: parsed.status_token };
  });

export const getPublicApplicationStatus = createServerFn({ method: "GET" })
  .inputValidator((data) => publicApplicationStatusSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await sb.rpc("get_public_application_status", { _status_token: data.statusToken });
    if (error) throw new Error("Could not check the application status.");
    const application = Array.isArray(result) ? result[0] : null;
    return application
      ? {
          roleTitle: application.role_title,
          stage: application.stage,
          status: application.status,
          submittedAt: application.submitted_at,
        }
      : null;
  });

export const updateApplicationPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => applicationPipelineSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requirePermission(sb, context.userId, "recruitment.manage");
    const { data: application, error } = await sb
      .from("hr_applications")
      .update({ stage: data.stage, status: data.status })
      .eq("id", data.applicationId)
      .select("id,candidate:hr_candidates(full_name)")
      .single();
    if (error || !application) throw new Error(error?.message ?? "Could not update the candidate stage.");

    await sb.from("activity_log").insert({
      actor_user_id: context.userId,
      module_key: "hr",
      entity_type: "job_application",
      entity_id: application.id,
      action: "pipeline_updated",
      summary: `Moved ${(application.candidate as any)?.full_name ?? "candidate"} to ${data.stage}`,
      after_data: { stage: data.stage, status: data.status },
    });
    return { id: application.id };
  });

export const getCandidateResumeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => candidateResumeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requirePermission(sb, context.userId, "recruitment.manage");
    const { data: candidate, error } = await sb
      .from("hr_candidates")
      .select("resume_storage_path")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (error || !candidate?.resume_storage_path) throw new Error("No resume is available for this candidate.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("project-drive")
      .createSignedUrl(candidate.resume_storage_path, 60);
    if (signedError || !signed?.signedUrl) throw new Error("Could not prepare the resume for viewing.");
    return { url: signed.signedUrl };
  });

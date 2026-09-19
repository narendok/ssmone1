import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface HrJobPosting {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string;
  location: string | null;
  employment_type: string;
  work_mode: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  department?: { id: string; name: string | null; code: string | null } | null;
}

export interface HrJobRequisition {
  id: string;
  title: string;
  employment_type: string;
  work_mode: string;
  location: string | null;
  headcount: number;
  status: string;
  target_start_date: string | null;
  created_at: string;
  department?: { id: string; name: string | null; code: string | null } | null;
}

export interface HrLeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  approver_note: string | null;
  created_at: string;
  leave_type?: { id: string; name: string; code: string } | null;
}

export interface HrLeaveType {
  id: string;
  name: string;
  code: string;
  annual_quota: number;
  requires_approval: boolean;
}

export interface HrTrainingEnrollment {
  id: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  score: number | null;
  program?: { id: string; title: string; delivery_mode: string; is_mandatory: boolean } | null;
}

const POSTING_SELECT = "id,slug,title,summary,description,location,employment_type,work_mode,is_published,published_at,created_at,department:departments(id,name,code)";

export async function fetchPublishedJobs(): Promise<HrJobPosting[]> {
  const { data, error } = await sb
    .from("hr_job_postings")
    .select(POSTING_SELECT)
    .eq("is_published", true)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HrJobPosting[];
}

export async function fetchPublishedJobBySlug(slug: string): Promise<HrJobPosting | null> {
  const { data, error } = await sb
    .from("hr_job_postings")
    .select(POSTING_SELECT)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as HrJobPosting | null;
}

export async function fetchRecruitmentSnapshot(): Promise<{ requisitions: HrJobRequisition[]; postings: HrJobPosting[] }> {
  const [reqs, posts] = await Promise.all([
    sb
      .from("hr_job_requisitions")
      .select("id,title,employment_type,work_mode,location,headcount,status,target_start_date,created_at,department:departments(id,name,code)")
      .order("created_at", { ascending: false }),
    sb
      .from("hr_job_postings")
      .select(POSTING_SELECT)
      .order("created_at", { ascending: false }),
  ]);
  if (reqs.error) throw reqs.error;
  if (posts.error) throw posts.error;
  return {
    requisitions: (reqs.data ?? []) as HrJobRequisition[],
    postings: (posts.data ?? []) as HrJobPosting[],
  };
}

export async function fetchHrDashboard() {
  const [{ count: activeJobs }, { count: openRequisitions }, { count: pendingLeave }, { count: trainingAssigned }] = await Promise.all([
    sb.from("hr_job_postings").select("id", { count: "exact", head: true }).eq("is_published", true),
    sb.from("hr_job_requisitions").select("id", { count: "exact", head: true }).in("status", ["approved", "open", "pending_approval"]),
    sb.from("hr_leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("hr_training_enrollments").select("id", { count: "exact", head: true }).in("status", ["assigned", "in_progress"]),
  ]);
  return {
    activeJobs: activeJobs ?? 0,
    openRequisitions: openRequisitions ?? 0,
    pendingLeave: pendingLeave ?? 0,
    trainingAssigned: trainingAssigned ?? 0,
  };
}

export async function fetchLeaveOverview() {
  const [{ data: employee }, { data: leaveTypes }, { data: leaveRequests }, { data: balances }] = await Promise.all([
    sb.from("employees").select("id, display_name, official_email, designation").maybeSingle(),
    sb.from("hr_leave_types").select("id,name,code,annual_quota,requires_approval").eq("is_active", true).order("name"),
    sb.from("hr_leave_requests").select("id,start_date,end_date,total_days,reason,status,approver_note,created_at,leave_type:hr_leave_types(id,name,code)").order("created_at", { ascending: false }),
    sb.from("hr_leave_balances").select("id,year,balance,consumed,leave_type:hr_leave_types(id,name,code)").order("year", { ascending: false }),
  ]);
  return {
    employee: employee ?? null,
    leaveTypes: (leaveTypes ?? []) as HrLeaveType[],
    leaveRequests: (leaveRequests ?? []) as (HrLeaveRequest & { leave_type: { id: string; name: string; code: string } | null })[],
    balances: (balances ?? []) as Array<{ id: string; year: number; balance: number; consumed: number; leave_type: { id: string; name: string; code: string } | null }>,
  };
}

export async function fetchTrainingOverview(): Promise<HrTrainingEnrollment[]> {
  const { data, error } = await sb
    .from("hr_training_enrollments")
    .select("id,status,due_date,completed_at,score,program:hr_training_programs(id,title,delivery_mode,is_mandatory)")
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HrTrainingEnrollment[];
}

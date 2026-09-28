import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, ClipboardCheck, GraduationCap, PlaneTakeoff, ShieldAlert, Users } from "lucide-react";
import { PermissionGate } from "@/components/PermissionGate";
import { HrStatCard } from "@/components/hr/HrStatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchHrDashboard, fetchRecruitmentSnapshot, fetchTrainingOverview } from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/hr/")({
  head: () => ({
    meta: [
      { title: "HR — SSM One" },
      { name: "description", content: "Recruitment, leave, onboarding, and training operations for SSM One." },
      { property: "og:title", content: "HR — SSM One" },
      { property: "og:description", content: "Recruitment, leave, onboarding, and training operations for SSM One." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HrPage,
});

function HrPage() {
  const stats = useQuery({ queryKey: ["hr_dashboard"], queryFn: fetchHrDashboard });
  const recruitment = useQuery({ queryKey: ["hr_recruitment_snapshot"], queryFn: fetchRecruitmentSnapshot });
  const training = useQuery({ queryKey: ["hr_training_overview"], queryFn: fetchTrainingOverview });

  const activeLearning = useMemo(
    () => training.data?.filter((entry) => entry.status !== "completed").slice(0, 4) ?? [],
    [training.data],
  );

  return (
    <PermissionGate permission="hr.view" fallback={<AccessDenied />}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">People operations</p>
            <h1 className="mt-1 text-2xl font-semibold">HR</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Run hiring, leave, onboarding, and learning inside the same operating workspace without splitting people records or approvals.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/hr/recruitment">Open recruitment</Link></Button>
            <Button asChild><Link to="/hr/leave">Open leave desk</Link></Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HrStatCard label="Open requisitions" value={String(stats.data?.openRequisitions ?? 0)} detail="Roles waiting on hiring progress" icon={<BriefcaseBusiness className="h-4 w-4" />} />
          <HrStatCard label="Live careers openings" value={String(stats.data?.activeJobs ?? 0)} detail="Published job pages visible to candidates" icon={<Users className="h-4 w-4" />} />
          <HrStatCard label="Leave approvals" value={String(stats.data?.pendingLeave ?? 0)} detail="Requests pending manager or HR action" icon={<PlaneTakeoff className="h-4 w-4" />} />
          <HrStatCard label="Training in progress" value={String(stats.data?.trainingAssigned ?? 0)} detail="Assigned learning still underway" icon={<GraduationCap className="h-4 w-4" />} />
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card><CardHeader><CardTitle>Recruitment pulse</CardTitle><CardDescription>Current openings and their readiness to move toward candidate review.</CardDescription></CardHeader><CardContent className="space-y-3">{(recruitment.data?.postings ?? []).slice(0, 5).map((posting) => <div key={posting.id} className="flex items-start justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{posting.title}</p><p className="mt-1 text-sm text-muted-foreground">{posting.location ?? "Location to be confirmed"} · {posting.work_mode} · {posting.employment_type}</p></div><Badge variant={posting.is_published ? "default" : "secondary"}>{posting.is_published ? "Published" : "Draft"}</Badge></div>)}{!(recruitment.data?.postings?.length) && <p className="text-sm text-muted-foreground">No openings yet. Start by saving a requisition or publishing a role.</p>}</CardContent></Card>
          <div className="space-y-4"><Card><CardHeader><CardTitle>Priority watchlist</CardTitle><CardDescription>Queues that need an HR or manager touch this week.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between rounded-lg border p-3"><div className="flex items-center gap-3"><ShieldAlert className="h-4 w-4 text-primary" /><div><p className="text-sm font-medium">Pending requisition approvals</p><p className="text-xs text-muted-foreground">Review demand before publishing more roles.</p></div></div><Badge variant="outline">{stats.data?.openRequisitions ?? 0}</Badge></div><div className="flex items-center justify-between rounded-lg border p-3"><div className="flex items-center gap-3"><ClipboardCheck className="h-4 w-4 text-primary" /><div><p className="text-sm font-medium">Leave requests waiting</p><p className="text-xs text-muted-foreground">Managers and HR share this queue.</p></div></div><Badge variant="outline">{stats.data?.pendingLeave ?? 0}</Badge></div></CardContent></Card><Card><CardHeader><CardTitle>Learning activity</CardTitle><CardDescription>Training already assigned to employees in the workspace.</CardDescription></CardHeader><CardContent className="space-y-3">{activeLearning.map((entry) => <div key={entry.id} className="rounded-lg border p-3"><p className="text-sm font-medium">{entry.program?.title ?? "Untitled program"}</p><p className="mt-1 text-xs text-muted-foreground">{entry.program?.delivery_mode ?? "self-paced"} · {entry.due_date ?? "No due date"}</p></div>)}{!activeLearning.length && <p className="text-sm text-muted-foreground">No active training assignments yet.</p>}</CardContent></Card></div>
        </div>
        <Card><CardHeader><CardTitle>Operational handoff</CardTitle><CardDescription>What this first HR slice already shares with the rest of SSM One.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">{["Leave requests notify reporting managers through the shared in-app inbox.", "Recruitment and leave actions are recorded in the central activity history.", "Careers openings publish from the same private workspace data foundation."].map((item) => <div key={item} className="rounded-lg border p-3 text-sm text-muted-foreground">{item}</div>)}</CardContent></Card>
      </div>
    </PermissionGate>
  );
}

function AccessDenied() {
  return <section className="mx-auto max-w-lg py-20 text-center"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-sm text-muted-foreground">Your account does not currently have access to the HR workspace.</p><Button asChild variant="link" className="mt-4"><Link to="/">Return to workspace</Link></Button></section>;
}
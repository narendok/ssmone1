import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { launchEmployeeOnboarding } from "@/lib/hr.functions";
import type { HrApplication, HrOnboardingPlan } from "@/lib/hr";

export function StartEmployeeOnboardingDialog({ application, plans, open, onOpenChange }: { application: HrApplication | null; plans: HrOnboardingPlan[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const launch = useServerFn(launchEmployeeOnboarding);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  if (!application) return null;
  const activeApplication = application;
  const fullName = activeApplication.candidate?.full_name ?? "New employee";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await launch({ data: {
        applicationId: activeApplication.id,
        planId: String(form.get("planId") ?? "") || null,
        officialEmail: String(form.get("officialEmail") ?? ""),
        designation: String(form.get("designation") ?? "").trim() || null,
        departmentId: null,
        reportingManagerUserId: null,
        startDate: String(form.get("startDate") ?? "") || null,
        welcomeKitRequired: form.get("welcomeKit") === "on",
      } });
      toast.success("Employee profile and onboarding created. An invitation has been sent when needed.");
      onOpenChange(false);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["hr_recruitment_snapshot"] }), queryClient.invalidateQueries({ queryKey: ["hr_employee_onboarding"] })]);
    } catch (error: any) { toast.error(error?.message ?? "Could not begin employee onboarding."); } finally { setPending(false); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Create employee and begin onboarding</DialogTitle><DialogDescription>{fullName} will receive access only after their invitation is accepted.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Employee code</Label><Input disabled value="Generated on save" /></div><div className="space-y-1.5"><Label htmlFor="official-email">Official email</Label><Input id="official-email" name="officialEmail" type="email" required defaultValue={activeApplication.candidate?.email ?? ""} /></div></div>{plans.length ? <div className="space-y-1.5"><Label>Onboarding plan</Label><Select name="planId"><SelectTrigger><SelectValue placeholder="No plan selected" /></SelectTrigger><SelectContent>{plans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent></Select></div> : null}<div className="space-y-1.5"><Label htmlFor="designation">Designation</Label><Input id="designation" name="designation" placeholder="Design engineer" /></div><div className="space-y-1.5"><Label htmlFor="start-date">Joining date</Label><Input id="start-date" name="startDate" type="date" /></div><div className="flex items-center gap-2"><Checkbox id="welcome-kit" name="welcome-kit" /><Label htmlFor="welcome-kit">Prepare a welcome kit</Label></div><DialogFooter><Button disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Create and invite</Button></DialogFooter></form></DialogContent></Dialog>;
}
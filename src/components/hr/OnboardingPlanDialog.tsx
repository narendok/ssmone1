import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { HrOnboardingPlan } from "@/lib/hr";
import { createOnboardingItem, createOnboardingPlan } from "@/lib/hr.functions";

export function CreateOnboardingPlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createPlan = useServerFn(createOnboardingPlan); const queryClient = useQueryClient(); const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); const form = new FormData(event.currentTarget); try { await createPlan({ data: { name: String(form.get("name") ?? ""), description: String(form.get("description") ?? "").trim() || null, departmentId: null } }); toast.success("Onboarding plan created"); onOpenChange(false); await queryClient.invalidateQueries({ queryKey: ["hr_onboarding"] }); } catch (error: any) { toast.error(error?.message ?? "Could not create onboarding plan."); } finally { setPending(false); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>New onboarding plan</DialogTitle><DialogDescription>Create a reusable path for incoming employees.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="space-y-1.5"><Label htmlFor="plan-name">Plan name</Label><Input id="plan-name" name="name" required placeholder="New joiner — standard" /></div><div className="space-y-1.5"><Label htmlFor="plan-description">Description</Label><Textarea id="plan-description" name="description" rows={3} placeholder="Who this plan supports" /></div><DialogFooter><Button disabled={pending}>{pending && <LoaderCircle className="size-4 animate-spin" />} Create plan</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function AddOnboardingItemDialog({ plan, open, onOpenChange }: { plan: HrOnboardingPlan | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const addItem = useServerFn(createOnboardingItem); const queryClient = useQueryClient(); const [pending, setPending] = useState(false); if (!plan) return null;
  const planId = plan.id;
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); const form = new FormData(event.currentTarget); try { await addItem({ data: { planId, title: String(form.get("title") ?? ""), description: String(form.get("description") ?? "").trim() || null, ownerKind: String(form.get("owner") ?? "employee") as "employee" | "manager" | "hr" | "it", dueOffsetDays: Number(form.get("days") ?? 0), isRequired: form.get("required") === "on" } }); toast.success("Onboarding step added"); onOpenChange(false); await queryClient.invalidateQueries({ queryKey: ["hr_onboarding"] }); } catch (error: any) { toast.error(error?.message ?? "Could not add onboarding step."); } finally { setPending(false); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add onboarding step</DialogTitle><DialogDescription>{plan.name}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="space-y-1.5"><Label htmlFor="step-title">Step</Label><Input id="step-title" name="title" required placeholder="Issue identity card" /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Owner</Label><Select name="owner" defaultValue="employee"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employee">Employee</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="hr">HR</SelectItem><SelectItem value="it">IT</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="step-days">Due after joining</Label><Input id="step-days" name="days" type="number" min="0" defaultValue="0" /></div></div><Textarea name="description" rows={3} placeholder="Instructions or acceptance criteria" /><div className="flex items-center gap-2"><Checkbox id="required" name="required" defaultChecked /><Label htmlFor="required">Required before onboarding is complete</Label></div><DialogFooter><Button disabled={pending}>{pending && <LoaderCircle className="size-4 animate-spin" />} <Plus className="size-4" /> Add step</Button></DialogFooter></form></DialogContent></Dialog>;
}

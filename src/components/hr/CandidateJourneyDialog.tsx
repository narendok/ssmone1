import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus, FileSignature, LoaderCircle, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HrApplication, HrInterviewRound, HrOffer } from "@/lib/hr";
import { createInterviewRound, saveOffer, submitInterviewFeedback } from "@/lib/hr.functions";

const OFFER_STATUSES = ["draft", "pending_approval", "approved", "sent", "accepted", "declined", "withdrawn"] as const;

export function CandidateJourneyDialog({ application, interviews, offer, interviewers, open, onOpenChange }: { application: HrApplication | null; interviews: HrInterviewRound[]; offer?: HrOffer; interviewers: Array<{ id: string; display_name: string | null; official_email: string | null }>; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const schedule = useServerFn(createInterviewRound);
  const feedback = useServerFn(submitInterviewFeedback);
  const save = useServerFn(saveOffer);
  const [pending, setPending] = useState<"schedule" | "feedback" | "offer" | null>(null);
  const applicationInterviews = useMemo(() => application ? interviews.filter((entry) => entry.application_id === application.id) : [], [application, interviews]);
  const applicationOffer = application ? offer : undefined;
  const [selectedRound, setSelectedRound] = useState<string>("");

  if (!application) return null;
  const candidateName = application.candidate?.full_name ?? "Candidate";

  async function handleSchedule(formData: FormData) {
    setPending("schedule");
    try {
      const scheduledFor = String(formData.get("scheduledFor") ?? "");
      await schedule({ data: { applicationId: application.id, title: String(formData.get("title") ?? ""), interviewerUserId: String(formData.get("interviewer") ?? ""), scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null, meetingNotes: String(formData.get("notes") ?? "").trim() || null } });
      toast.success("Interview scheduled");
      await queryClient.invalidateQueries({ queryKey: ["hr_recruitment_snapshot"] });
    } catch (error: any) { toast.error(error?.message ?? "Could not schedule the interview."); } finally { setPending(null); }
  }

  async function handleFeedback(formData: FormData) {
    setPending("feedback");
    try {
      const rating = String(formData.get("rating") ?? "");
      await feedback({ data: { roundId: selectedRound, rating: rating ? Number(rating) : null, recommendation: (String(formData.get("recommendation") ?? "") || null) as "strong_yes" | "yes" | "mixed" | "no" | null, strengths: String(formData.get("strengths") ?? "").trim() || null, concerns: String(formData.get("concerns") ?? "").trim() || null } });
      toast.success("Interview feedback saved");
      await queryClient.invalidateQueries({ queryKey: ["hr_recruitment_snapshot"] });
    } catch (error: any) { toast.error(error?.message ?? "Could not save interview feedback."); } finally { setPending(null); }
  }

  async function handleOffer(formData: FormData) {
    setPending("offer");
    try {
      const annual = String(formData.get("annualCompensation") ?? "");
      await save({ data: { applicationId: application.id, status: String(formData.get("status") ?? "draft") as typeof OFFER_STATUSES[number], annualCompensation: annual ? Number(annual) : null, currency: String(formData.get("currency") ?? "INR"), notes: String(formData.get("notes") ?? "").trim() || null } });
      toast.success("Offer updated");
      await queryClient.invalidateQueries({ queryKey: ["hr_recruitment_snapshot"] });
    } catch (error: any) { toast.error(error?.message ?? "Could not save the offer."); } finally { setPending(null); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{candidateName}</DialogTitle><DialogDescription>{application.posting?.title ?? "Candidate journey"} · manage interviews and a controlled offer.</DialogDescription></DialogHeader>
    <Tabs defaultValue="interviews"><TabsList><TabsTrigger value="interviews">Interviews</TabsTrigger><TabsTrigger value="offer">Offer</TabsTrigger></TabsList>
      <TabsContent value="interviews" className="space-y-5"><div className="space-y-2">{applicationInterviews.length ? applicationInterviews.map((round) => <div key={round.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><div><p className="font-medium">{round.title}</p><p className="text-xs text-muted-foreground">{round.scheduled_for ? new Date(round.scheduled_for).toLocaleString() : "Schedule to be confirmed"} · {round.status}</p></div><Button type="button" variant="outline" size="sm" onClick={() => setSelectedRound(round.id)}>Add feedback</Button></div>) : <p className="text-sm text-muted-foreground">No interviews are scheduled yet.</p>}</div>
        <form className="space-y-3 border-t pt-5" onSubmit={(event) => { event.preventDefault(); void handleSchedule(new FormData(event.currentTarget)); }}><div className="flex items-center gap-2"><CalendarPlus className="size-4 text-primary" /><h3 className="font-medium">Schedule interview</h3></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="interview-title">Round title</Label><Input id="interview-title" name="title" required placeholder="Technical interview" /></div><div className="space-y-1.5"><Label>Interviewer</Label><Select name="interviewer" required><SelectTrigger><SelectValue placeholder="Select interviewer" /></SelectTrigger><SelectContent>{interviewers.map((person) => <SelectItem key={person.id} value={person.id}>{person.display_name ?? person.official_email ?? "Employee"}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="scheduled-for">When</Label><Input id="scheduled-for" name="scheduledFor" type="datetime-local" /></div></div><Textarea name="notes" rows={3} placeholder="Meeting context or preparation notes" /><Button disabled={pending === "schedule"}>{pending === "schedule" && <LoaderCircle className="size-4 animate-spin" />} Schedule</Button></form>
        {selectedRound && <form className="space-y-3 rounded-md border p-4" onSubmit={(event) => { event.preventDefault(); void handleFeedback(new FormData(event.currentTarget)); }}><div className="flex items-center gap-2"><MessageSquarePlus className="size-4 text-primary" /><h3 className="font-medium">Interview feedback</h3></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="rating">Rating</Label><Input id="rating" name="rating" type="number" min="1" max="5" step="0.5" /></div><div className="space-y-1.5"><Label>Recommendation</Label><Select name="recommendation"><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent><SelectItem value="strong_yes">Strong yes</SelectItem><SelectItem value="yes">Yes</SelectItem><SelectItem value="mixed">Mixed</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div></div><Textarea name="strengths" rows={2} placeholder="Strengths" /><Textarea name="concerns" rows={2} placeholder="Concerns" /><Button disabled={pending === "feedback"}>{pending === "feedback" && <LoaderCircle className="size-4 animate-spin" />} Save feedback</Button></form>}</TabsContent>
      <TabsContent value="offer"><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleOffer(new FormData(event.currentTarget)); }}><div className="flex items-center gap-2"><FileSignature className="size-4 text-primary" /><h3 className="font-medium">Offer control</h3></div><div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1.5"><Label>State</Label><Select name="status" defaultValue={applicationOffer?.status ?? "draft"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OFFER_STATUSES.map((status) => <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="annual-comp">Annual compensation</Label><Input id="annual-comp" name="annualCompensation" type="number" min="0" defaultValue={applicationOffer?.compensation?.annual_compensation ?? ""} /></div><div className="space-y-1.5"><Label htmlFor="currency">Currency</Label><Input id="currency" name="currency" defaultValue={applicationOffer?.compensation?.currency ?? "INR"} /></div></div><Textarea name="notes" rows={6} defaultValue={applicationOffer?.notes ?? ""} placeholder="Offer terms, approvals, and communication notes" /><DialogFooter><Button disabled={pending === "offer"}>{pending === "offer" && <LoaderCircle className="size-4 animate-spin" />} Save offer</Button></DialogFooter></form></TabsContent>
    </Tabs>
  </DialogContent></Dialog>;
}

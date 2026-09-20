import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, FileText, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCandidateResumeUrl, updateApplicationPipeline } from "@/lib/hr.functions";
import type { HrApplication } from "@/lib/hr";

const STAGES = ["applied", "screening", "assessment", "interview", "offer", "hired", "rejected", "withdrawn"] as const;
const TERMINAL_STATUSES = new Set(["hired", "rejected", "withdrawn"]);

function displayLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function suggestedStatus(stage: string, currentStatus: string) {
  return TERMINAL_STATUSES.has(stage) ? stage : TERMINAL_STATUSES.has(currentStatus) ? "active" : currentStatus;
}

export function CandidatePipeline({ applications }: { applications: HrApplication[] }) {
  const queryClient = useQueryClient();
  const updatePipeline = useServerFn(updateApplicationPipeline);
  const getResumeUrl = useServerFn(getCandidateResumeUrl);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openingResumeId, setOpeningResumeId] = useState<string | null>(null);

  async function changeStage(application: HrApplication, stage: string) {
    const status = suggestedStatus(stage, application.status);
    setUpdatingId(application.id);
    try {
      await updatePipeline({ data: { applicationId: application.id, stage, status } });
      toast.success(`Moved ${application.candidate?.full_name ?? "candidate"} to ${displayLabel(stage)}`);
      await queryClient.invalidateQueries({ queryKey: ["hr_recruitment_snapshot"] });
    } catch (error: any) {
      toast.error(error?.message ?? "Could not update the candidate stage.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function openResume(candidateId: string) {
    setOpeningResumeId(candidateId);
    try {
      const { url } = await getResumeUrl({ data: { candidateId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not open this resume.");
    } finally {
      setOpeningResumeId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate pipeline</CardTitle>
        <CardDescription>Review applications and move candidates through the human-reviewed hiring journey.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Opening</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Resume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => {
                const candidate = application.candidate;
                const canOpenResume = Boolean(candidate?.resume_storage_path);
                return (
                  <TableRow key={application.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{candidate?.full_name ?? "Unknown candidate"}</p>
                        <p className="text-xs text-muted-foreground">{candidate?.email ?? "No email"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{application.posting?.title ?? "—"}</TableCell>
                    <TableCell>{new Date(application.submitted_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Select value={application.stage} onValueChange={(stage) => void changeStage(application, stage)} disabled={updatingId === application.id}>
                        <SelectTrigger className="w-[144px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{STAGES.map((stage) => <SelectItem key={stage} value={stage}>{displayLabel(stage)}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Badge variant={application.status === "active" ? "secondary" : "outline"}>{displayLabel(application.status)}</Badge></TableCell>
                    <TableCell className="text-right">
                      {canOpenResume ? (
                        <Button variant="outline" size="sm" onClick={() => void openResume(candidate.id)} disabled={openingResumeId === candidate.id}>
                          {openingResumeId === candidate.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                          <span className="sr-only">Open resume for {candidate.full_name}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      ) : <span className="text-sm text-muted-foreground">Not provided</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!applications.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No applications yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { CreatePostingDialog, CreateRequisitionDialog } from "@/components/hr/RecruitmentDialogs";
import { PermissionGate } from "@/components/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { fetchRecruitmentSnapshot } from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/hr/recruitment")({
  head: () => ({
    meta: [
      { title: "Recruitment — SSM One" },
      { name: "description", content: "Manage hiring demand, publish openings, and track the recruitment pipeline." },
      { property: "og:title", content: "Recruitment — SSM One" },
      { property: "og:description", content: "Manage hiring demand, publish openings, and track the recruitment pipeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecruitmentPage,
});

function RecruitmentPage() {
  const queryClient = useQueryClient();
  const [requisitionOpen, setRequisitionOpen] = useState(false);
  const [postingOpen, setPostingOpen] = useState(false);
  const snapshot = useQuery({ queryKey: ["hr_recruitment_snapshot"], queryFn: fetchRecruitmentSnapshot });
  const departments = useQuery({
    queryKey: ["departments", "hr"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id,name,code").eq("is_active", true).order("sort_order").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PermissionGate permission="recruitment.manage" fallback={<p className="text-sm text-muted-foreground">You do not have access to recruitment.</p>}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">People operations</p>
            <h1 className="mt-1 text-2xl font-semibold">Recruitment</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Move from hiring need to a published opening without leaving the shared operations workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRequisitionOpen(true)}><Plus className="h-4 w-4" /> Requisition</Button>
            <Button onClick={() => setPostingOpen(true)}><Plus className="h-4 w-4" /> Career opening</Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Requisitions</CardTitle>
              <CardDescription>Internal hiring demand before the role goes public.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Need</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.data?.requisitions.map((requisition) => (
                    <TableRow key={requisition.id}>
                      <TableCell className="font-medium">{requisition.title}</TableCell>
                      <TableCell>{requisition.department?.name ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{requisition.status}</Badge></TableCell>
                      <TableCell>{requisition.headcount} seat{requisition.headcount > 1 ? "s" : ""}</TableCell>
                    </TableRow>
                  ))}
                  {!snapshot.data?.requisitions.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No requisitions yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Career openings</CardTitle>
              <CardDescription>What candidates can already discover on Careers.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opening</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.data?.postings.map((posting) => (
                    <TableRow key={posting.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{posting.title}</p>
                          <p className="text-xs text-muted-foreground">/careers/{posting.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>{posting.location ?? "—"}</TableCell>
                      <TableCell>{posting.work_mode}</TableCell>
                      <TableCell><Badge variant={posting.is_published ? "default" : "secondary"}>{posting.is_published ? "Published" : "Draft"}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!snapshot.data?.postings.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No openings yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <CreateRequisitionDialog
          open={requisitionOpen}
          onOpenChange={setRequisitionOpen}
          departments={departments.data ?? []}
          onSubmitted={() => {
            void queryClient.invalidateQueries({ queryKey: ["hr_recruitment_snapshot"] });
            void queryClient.invalidateQueries({ queryKey: ["hr_dashboard"] });
          }}
        />
        <CreatePostingDialog
          open={postingOpen}
          onOpenChange={setPostingOpen}
          departments={departments.data ?? []}
          requisitions={snapshot.data?.requisitions ?? []}
          onSubmitted={() => {
            void queryClient.invalidateQueries({ queryKey: ["hr_recruitment_snapshot"] });
            void queryClient.invalidateQueries({ queryKey: ["hr_dashboard"] });
          }}
        />
      </div>
    </PermissionGate>
  );
}

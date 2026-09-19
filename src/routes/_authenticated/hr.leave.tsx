import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Plus } from "lucide-react";
import { LeaveRequestDialog } from "@/components/hr/LeaveRequestDialog";
import { PermissionGate } from "@/components/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchLeaveOverview } from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/hr/leave")({
  head: () => ({
    meta: [
      { title: "Leave desk — SSM One" },
      { name: "description", content: "Request leave, review balances, and track approvals in SSM One." },
      { property: "og:title", content: "Leave desk — SSM One" },
      { property: "og:description", content: "Request leave, review balances, and track approvals in SSM One." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaveDeskPage,
});

function LeaveDeskPage() {
  const queryClient = useQueryClient();
  const [requestOpen, setRequestOpen] = useState(false);
  const overview = useQuery({ queryKey: ["hr_leave_overview"], queryFn: fetchLeaveOverview });

  const employee = overview.data?.employee ?? null;

  return (
    <PermissionGate permission="hr.view" fallback={<p className="text-sm text-muted-foreground">You do not have access to the leave desk.</p>}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">People operations</p>
            <h1 className="mt-1 text-2xl font-semibold">Leave desk</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Request leave, see your balances, and keep manager approvals in one place.</p>
          </div>
          <Button onClick={() => setRequestOpen(true)}><Plus className="h-4 w-4" /> Request leave</Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Your balances</CardTitle>
              <CardDescription>{employee?.display_name ?? employee?.official_email ?? "Employee profile"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.data?.balances.map((balance) => (
                <div key={balance.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{balance.leave_type?.name ?? "Leave type"}</p>
                    <p className="text-xs text-muted-foreground">{balance.year}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{balance.balance}</p>
                    <p className="text-xs text-muted-foreground">Used {balance.consumed}</p>
                  </div>
                </div>
              ))}
              {!overview.data?.balances.length && <p className="text-sm text-muted-foreground">No balances are assigned to your profile yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available leave types</CardTitle>
              <CardDescription>Choose one when sending a new request.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.data?.leaveTypes.map((leaveType) => (
                <div key={leaveType.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{leaveType.name}</p>
                    <p className="text-xs text-muted-foreground">{leaveType.code}</p>
                  </div>
                  <Badge variant="outline">{leaveType.annual_quota} days</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent requests</CardTitle>
            <CardDescription>Track the current state of your leave applications.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.data?.leaveRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.leave_type?.name ?? "Leave"}</TableCell>
                    <TableCell>{request.start_date} → {request.end_date}</TableCell>
                    <TableCell>{request.total_days}</TableCell>
                    <TableCell><Badge variant={request.status === "approved" ? "default" : request.status === "rejected" ? "destructive" : "secondary"}>{request.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{request.approver_note ?? request.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {!overview.data?.leaveRequests.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Clock3 className="h-4 w-4" />
                        No leave requests yet.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <LeaveRequestDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          employeeId={employee?.id ?? null}
          leaveTypes={overview.data?.leaveTypes ?? []}
          onSubmitted={() => {
            void queryClient.invalidateQueries({ queryKey: ["hr_leave_overview"] });
            void queryClient.invalidateQueries({ queryKey: ["hr_dashboard"] });
          }}
        />
      </div>
    </PermissionGate>
  );
}

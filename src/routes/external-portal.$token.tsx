import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, FileLock2, Send, ShieldCheck, UploadCloud } from "lucide-react";
import { acceptExternalInvitation, getExternalPortal, respondToExternalReview } from "@/lib/external-portal.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/external-portal/$token")({
  head: () => ({ meta: [{ title: "External portal — SSM One" }, { name: "description", content: "Secure external collaboration workspace." }, { property: "og:title", content: "External portal — SSM One" }, { property: "og:description", content: "Secure external collaboration workspace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ExternalPortalInvitation,
});

function ExternalPortalInvitation() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const accept = useMutation({ mutationFn: () => acceptExternalInvitation({ data: { token } }), onSuccess: () => navigate({ to: "/external-portal/$token", params: { token } }), onError: (error: Error) => toast.error(error.message) });
  return <main className="mx-auto max-w-xl px-4 py-16"><Card><CardHeader><div className="mb-2 flex items-center gap-2 text-primary"><ShieldCheck className="size-5" /><span className="text-sm font-medium">SSM One</span></div><CardTitle>External collaboration invitation</CardTitle><CardDescription>Accept this invitation while signed in to activate only the access granted to your organization.</CardDescription></CardHeader><CardContent><Button onClick={() => accept.mutate()} disabled={accept.isPending}>{accept.isPending ? "Activating…" : "Accept secure access"}</Button></CardContent></Card></main>;
}

export function ExternalPortalWorkspace() {
  const queryClient = useQueryClient();
  const portal = useQuery({ queryKey: ["external-portal"], queryFn: () => getExternalPortal({ data: undefined }) });
  if (portal.isLoading) return <main className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted-foreground">Opening secure workspace…</main>;
  if (portal.isError || !portal.data) return <main className="mx-auto max-w-xl px-4 py-16"><Card><CardHeader><CardTitle>Access unavailable</CardTitle><CardDescription>Your access may have expired, been revoked, or not yet been activated.</CardDescription></CardHeader></Card></main>;
  const data = portal.data;
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-10"><header><div className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="size-4" />Private external workspace</div><h1 className="mt-2 text-2xl font-semibold">{data.party}</h1><p className="mt-1 text-sm text-muted-foreground">Signed in as {data.name}. Only specifically authorized records are listed.</p></header><div className="grid gap-5 lg:grid-cols-2"><RecordCard icon={<FileLock2 className="size-4" />} title="Controlled shares" empty="No controlled shares are available.">{data.shares.map((share) => <Line key={share.id} title={`${share.snapshot_code} · ${share.source_entity_type}`} detail={`${share.share_mode.replaceAll("_", " ")} · ${share.permission}`} />)}</RecordCard><RecordCard icon={<FileCheck2 className="size-4" />} title="Transmittals" empty="No transmittals are available.">{data.transmittals.map((item) => <Line key={item.id} title={item.transmittal_number ?? "Transmittal"} detail={`${item.purpose} · ${item.status.replaceAll("_", " ")}`} />)}</RecordCard><RecordCard icon={<Send className="size-4" />} title="Review requests" empty="No review requests are available.">{data.reviews.map((review) => <ReviewLine key={review.id} review={review} onSaved={() => queryClient.invalidateQueries({ queryKey: ["external-portal"] })} />)}</RecordCard><RecordCard icon={<UploadCloud className="size-4" />} title="Upload requests" empty="No upload requests are available.">{data.uploadRequests.map((item) => <Line key={item.id} title={item.request_code ?? "Upload request"} detail={`${item.requested_document} · ${item.status.replaceAll("_", " ")}`} />)}</RecordCard></div><RecordCard icon={<FileLock2 className="size-4" />} title="Data rooms" empty="No data rooms are available.">{data.rooms.map((room) => <Line key={room.id} title={room.title} detail={room.room_code ?? "Controlled room"} />)}</RecordCard></main>;
}
function RecordCard({ icon, title, empty, children }: { icon: React.ReactNode; title: string; empty: string; children: React.ReactNode[] }) { return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle></CardHeader><CardContent className="space-y-3">{children.length ? children : <p className="text-sm text-muted-foreground">{empty}</p>}</CardContent></Card>; }
function Line({ title, detail }: { title: string; detail: string }) { return <div className="border-b pb-3 last:border-0 last:pb-0"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>; }
function ReviewLine({ review, onSaved }: { review: { id: string; request_type: string; revision_reference: string | null; status: string; response: string | null }; onSaved: () => void }) { const [response, setResponse] = useState(review.response ?? ""); const mutation = useMutation({ mutationFn: () => respondToExternalReview({ data: { reviewId: review.id, response, status: "RESPONDED" } }), onSuccess: () => { toast.success("Response submitted for internal review"); onSaved(); }, onError: (error: Error) => toast.error(error.message) }); return <div className="space-y-2 border-b pb-3 last:border-0 last:pb-0"><Line title={review.request_type} detail={`${review.revision_reference ?? "No revision reference"} · ${review.status.replaceAll("_", " ")}`} /><Textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Provide your response" /><Button size="sm" onClick={() => mutation.mutate()} disabled={!response.trim() || mutation.isPending}>{mutation.isPending ? "Sending…" : "Submit response"}</Button></div>; }

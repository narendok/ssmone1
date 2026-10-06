import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, FileLock2, FileText, Send, ShieldAlert, ShieldCheck, UploadCloud } from "lucide-react";
import { acceptExternalInvitation, getExternalPortal, respondToExternalReview } from "@/lib/external-portal.functions";
import { submitClientRequirement } from "@/lib/client-requirement-intake.functions";
import { clientRequirementRequestKey, protectedIntakeAvailability } from "@/lib/client-requirement-intake";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

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
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-10"><header><div className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="size-4" />Private external workspace</div><h1 className="mt-2 text-2xl font-semibold">{data.party}</h1><p className="mt-1 text-sm text-muted-foreground">Signed in as {data.name}. Only specifically authorized records are listed.</p></header><ClientRequirementCard access={data.requirementAccess} unavailableReason={data.protectedIntakeAvailability.reason} /><div className="grid gap-5 lg:grid-cols-2"><RecordCard icon={<FileLock2 className="size-4" />} title="Controlled shares" empty="No controlled shares are available.">{data.shares.map((share) => <Line key={share.id} title={`${share.snapshot_code} · ${share.source_entity_type}`} detail={`${share.share_mode.replaceAll("_", " ")} · ${share.permission}`} />)}</RecordCard><RecordCard icon={<FileCheck2 className="size-4" />} title="Transmittals" empty="No transmittals are available.">{data.transmittals.map((item) => <Line key={item.id} title={item.transmittal_number ?? "Transmittal"} detail={`${item.purpose} · ${item.status.replaceAll("_", " ")}`} />)}</RecordCard><RecordCard icon={<Send className="size-4" />} title="Review requests" empty="No review requests are available.">{data.reviews.map((review) => <ReviewLine key={review.id} review={review} onSaved={() => queryClient.invalidateQueries({ queryKey: ["external-portal"] })} />)}</RecordCard><RecordCard icon={<UploadCloud className="size-4" />} title="Upload requests" empty="No upload requests are available.">{data.uploadRequests.map((item) => <Line key={item.id} title={item.request_code ?? "Upload request"} detail={`${item.requested_document} · ${item.status.replaceAll("_", " ")}`} />)}</RecordCard></div><RecordCard icon={<FileLock2 className="size-4" />} title="Data rooms" empty="No data rooms are available.">{data.rooms.map((room) => <Line key={room.id} title={room.title} detail={room.room_code ?? "Controlled room"} />)}</RecordCard></main>;
}
function ClientRequirementCard({ access, unavailableReason }: { access: { state: "ACTIVE" | "EXPIRED" | "REVOKED" | "NO_ACCESS"; expiresAt: string | null; accessScope: unknown }; unavailableReason: string }) {
  const submit = useServerFn(submitClientRequirement);
  const [title, setTitle] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [description, setDescription] = useState("");
  const requestKey = useRef<string | null>(null);
  const stateLabel = access.state === "NO_ACCESS" ? "No granted client requirement access" : access.state === "ACTIVE" ? "Access verified" : access.state === "EXPIRED" ? "Access expired" : "Access revoked";
  const detail = access.state === "ACTIVE" ? `Your permitted requirement scope is active${access.expiresAt ? ` until ${new Date(access.expiresAt).toLocaleDateString()}` : ""}.` : access.state === "EXPIRED" ? "The permitted requirement access has expired. Ask your SSM One contact for a renewed, scoped invitation." : access.state === "REVOKED" ? "The permitted requirement access is no longer active. Ask your SSM One contact if access should be restored." : "No client-requirement scope has been granted to this workspace.";
  const clearDraft = () => { requestKey.current = null; setTitle(""); setCustomerReference(""); setDescription(""); };
  const submitDraft = async () => {
    if (!protectedIntakeAvailability.available) return;
    const scope = access.accessScope as { opportunityIds?: unknown; customerIds?: unknown };
    const opportunityId = Array.isArray(scope.opportunityIds) ? scope.opportunityIds[0] : null;
    const customerId = Array.isArray(scope.customerIds) ? scope.customerIds[0] : null;
    if (typeof opportunityId !== "string" || typeof customerId !== "string") return toast.error("No single requirement scope is available for this draft.");
    requestKey.current = clientRequirementRequestKey(requestKey.current);
    try { await submit({ data: { opportunityId, customerId, requestKey: requestKey.current, title, customerReference: customerReference || null, description } }); toast.success("Client requirement submitted"); clearDraft(); }
    catch (error: any) { toast.error(error?.message ?? "Could not submit the requirement."); }
  };
  const disabled = !protectedIntakeAvailability.available || access.state !== "ACTIVE";
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="size-4" />Client requirements</CardTitle><CardDescription>{detail}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex items-center gap-2 text-sm font-medium"><ShieldAlert className="size-4 text-muted-foreground" />{stateLabel}</div><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-medium text-muted-foreground">Requirement title</p><input disabled={disabled} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm disabled:opacity-50" placeholder="Requirement title" /></div><div><p className="text-xs font-medium text-muted-foreground">Customer reference</p><input disabled={disabled} value={customerReference} onChange={(event) => setCustomerReference(event.target.value)} className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm disabled:opacity-50" placeholder="Customer reference" /></div></div><div><p className="text-xs font-medium text-muted-foreground">Requirement detail</p><Textarea disabled={disabled} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1" placeholder="Requirement detail" /></div><p className="text-sm text-muted-foreground">{unavailableReason}</p><div className="flex gap-2"><Button disabled={disabled} onClick={() => void submitDraft()}>Submit client requirement</Button><Button variant="outline" disabled={disabled} onClick={clearDraft}>Start new draft</Button></div></CardContent></Card>;
}
function InputUnavailable({ placeholder }: { placeholder: string }) { return <input disabled className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm opacity-50" placeholder={placeholder} />; }
function RecordCard({ icon, title, empty, children }: { icon: React.ReactNode; title: string; empty: string; children: React.ReactNode[] }) { return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle></CardHeader><CardContent className="space-y-3">{children.length ? children : <p className="text-sm text-muted-foreground">{empty}</p>}</CardContent></Card>; }
function Line({ title, detail }: { title: string; detail: string }) { return <div className="border-b pb-3 last:border-0 last:pb-0"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>; }
function ReviewLine({ review, onSaved }: { review: { id: string; request_type: string; revision_reference: string | null; status: string; response: string | null }; onSaved: () => void }) { const [response, setResponse] = useState(review.response ?? ""); const mutation = useMutation({ mutationFn: () => respondToExternalReview({ data: { reviewId: review.id, response, status: "RESPONDED" } }), onSuccess: () => { toast.success("Response submitted for internal review"); onSaved(); }, onError: (error: Error) => toast.error(error.message) }); return <div className="space-y-2 border-b pb-3 last:border-0 last:pb-0"><Line title={review.request_type} detail={`${review.revision_reference ?? "No revision reference"} · ${review.status.replaceAll("_", " ")}`} /><Textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Provide your response" /><Button size="sm" onClick={() => mutation.mutate()} disabled={!response.trim() || mutation.isPending}>{mutation.isPending ? "Sending…" : "Submit response"}</Button></div>; }

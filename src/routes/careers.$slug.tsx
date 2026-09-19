import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BriefcaseBusiness, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPublishedJobBySlug } from "@/lib/hr";

export const Route = createFileRoute("/careers/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Career opening — ${params.slug}` },
      { name: "description", content: "View a current Six Sense Mobility opening and learn what the role involves." },
      { property: "og:title", content: `Career opening — ${params.slug}` },
      { property: "og:description", content: "View a current Six Sense Mobility opening and learn what the role involves." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CareerRolePage,
});

function CareerRolePage() {
  const { slug } = Route.useParams();
  const job = useQuery({ queryKey: ["career_job", slug], queryFn: () => fetchPublishedJobBySlug(slug) });

  if (!job.data && !job.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center px-6 py-16">
        <Card className="w-full max-w-xl">
          <CardContent className="space-y-4 p-8 text-center">
            <h1 className="text-2xl font-semibold">This opening is no longer available</h1>
            <p className="text-sm text-muted-foreground">The role may have been filled, paused, or renamed.</p>
            <Button asChild variant="outline"><Link to="/careers">Back to Careers</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Button asChild variant="ghost" className="mb-6"><Link to="/careers"><ArrowLeft className="h-4 w-4" /> Back to Careers</Link></Button>
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {job.data?.department?.name && <Badge variant="outline">{job.data.department.name}</Badge>}
              <Badge variant="secondary">{job.data?.employment_type}</Badge>
              <Badge variant="secondary">{job.data?.work_mode}</Badge>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">{job.data?.title ?? "Career opening"}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.data?.location ?? "Location shared during screening"}</span>
              <span className="inline-flex items-center gap-1"><BriefcaseBusiness className="h-4 w-4" /> {job.data?.employment_type}</span>
            </div>
            {job.data?.summary && <p className="max-w-3xl text-base text-muted-foreground">{job.data.summary}</p>}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <Card>
              <CardHeader>
                <CardTitle>Role overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground dark:prose-invert">{job.data?.description ?? "Details will be shared during screening."}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How this first release handles applications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>The public job board is live now.</p>
                <p>Candidate application intake, resume upload, and secure status tracking are being wired into the shared HR workflow next.</p>
                <Button asChild className="w-full"><Link to="/auth">Internal team sign-in</Link></Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

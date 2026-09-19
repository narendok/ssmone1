import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPublishedJobs } from "@/lib/hr";

export const Route = createFileRoute("/careers")({
  head: () => ({
    meta: [
      { title: "Careers — Six Sense Mobility" },
      { name: "description", content: "Explore current openings at Six Sense Mobility and see where your next role could fit." },
      { property: "og:title", content: "Careers — Six Sense Mobility" },
      { property: "og:description", content: "Explore current openings at Six Sense Mobility and see where your next role could fit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CareersPage,
});

function CareersPage() {
  const jobs = useQuery({ queryKey: ["careers_public_jobs"], queryFn: fetchPublishedJobs });

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-[1.3fr_0.9fr] lg:items-end">
          <div>
            <p className="text-sm font-medium text-primary">Join the team</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Careers at Six Sense Mobility</h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Build reliable mobility hardware, embedded systems, quality workflows, and supply-chain operations with a team shipping real products.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Open roles</CardDescription>
                <CardTitle className="text-3xl">{jobs.data?.length ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Teams hiring</CardDescription>
                <CardTitle className="text-3xl">{new Set((jobs.data ?? []).map((job) => job.department?.name ?? job.title)).size}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"><BriefcaseBusiness className="h-4 w-4" /> Current openings</div>
        <div className="grid gap-4">
          {(jobs.data ?? []).map((job) => (
            <Card key={job.id}>
              <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{job.title}</h2>
                    {job.department?.name && <Badge variant="outline">{job.department.name}</Badge>}
                  </div>
                  <p className="max-w-3xl text-sm text-muted-foreground">{job.summary ?? "A new role in our operating team."}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.location ?? "Location shared during screening"}</span>
                    <span>{job.work_mode}</span>
                    <span>{job.employment_type}</span>
                  </div>
                </div>
                <Button asChild>
                  <Link to="/careers/$slug" params={{ slug: job.slug }}>View role <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
          {!jobs.data?.length && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">There are no live openings right now. Please check back soon.</CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

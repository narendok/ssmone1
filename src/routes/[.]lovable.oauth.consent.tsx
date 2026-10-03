import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CircuitBoard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id: typeof search.authorization_id === "string" ? search.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization request.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = `${location.pathname}${location.searchStr}`;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  component: ConsentPage,
});

type ConsentRequest = {
  client: { name: string; uri: string; logo_uri: string };
  scope: string;
};

function ConsentPage() {
  const { authorization_id: authorizationId } = Route.useSearch();
  const navigate = useNavigate();
  const [request, setRequest] = useState<ConsentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error: requestError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (requestError || !data) {
        setError(requestError?.message ?? "This connection request is unavailable.");
        return;
      }
      if ("redirect_url" in data) {
        window.location.assign(data.redirect_url);
        return;
      }
      setRequest({ client: data.client, scope: data.scope });
    }
    void load();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approved: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: decisionError } = approved
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (decisionError || !data) {
      setBusy(false);
      setError(decisionError?.message ?? "Could not complete your decision.");
      return;
    }
    window.location.assign(data.redirect_url);
  }

  if (error) {
    return <main className="flex min-h-screen items-center justify-center bg-background p-6"><section className="max-w-md space-y-4 text-center"><CircuitBoard className="mx-auto h-8 w-8 text-primary" /><h1 className="text-xl font-semibold">Connection unavailable</h1><p className="text-sm text-muted-foreground">{error}</p><Button onClick={() => navigate({ to: "/" })}>Return to workspace</Button></section></main>;
  }
  if (!request) {
    return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></main>;
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-md space-y-6 border bg-card p-6 shadow-sm">
        <div className="space-y-2"><CircuitBoard className="h-8 w-8 text-primary" /><h1 className="text-xl font-semibold">Connect {request.client.name}</h1><p className="text-sm text-muted-foreground">This lets {request.client.name} use the read-only SSM One tools available to your account.</p></div>
        <div className="border-y py-4 text-sm"><p className="font-medium">Requested access</p><p className="mt-1 text-muted-foreground">{request.scope || "Your existing workspace access"}</p></div>
        <div className="flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={() => void decide(false)}>Deny</Button><Button disabled={busy} onClick={() => void decide(true)}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Allow</Button></div>
      </section>
    </main>
  );
}

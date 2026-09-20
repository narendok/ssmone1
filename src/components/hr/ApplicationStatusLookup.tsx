import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { getPublicApplicationStatus } from "@/lib/hr.functions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApplicationStatus = {
  roleTitle: string;
  stage: string;
  status: string;
  submittedAt: string;
};

function formatStatus(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function ApplicationStatusLookup() {
  const lookup = useServerFn(getPublicApplicationStatus);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ApplicationStatus | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = await lookup({ data: { statusToken: token.trim() } });
      setResult(data);
    } catch {
      setError("Enter the application reference from your confirmation message.");
      setResult(undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="application-reference">Application reference</Label>
        <Input id="application-reference" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste your application reference" required />
      </div>
      <Button type="submit" variant="outline" className="w-full" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Check status
      </Button>
      {error && <Alert variant="destructive"><AlertTitle>Unable to check status</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {result === null && <Alert><AlertTitle>No application found</AlertTitle><AlertDescription>Check the reference and try again.</AlertDescription></Alert>}
      {result && (
        <Alert>
          <AlertTitle>{result.roleTitle}</AlertTitle>
          <AlertDescription>
            Your application is {formatStatus(result.status)} at the {formatStatus(result.stage)} stage.
          </AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-muted-foreground">The reference only shows the progress of this application.</p>
    </form>
  );
}
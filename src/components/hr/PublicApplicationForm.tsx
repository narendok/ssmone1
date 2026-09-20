import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { submitPublicJobApplication } from "@/lib/hr.functions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PublicApplicationForm({ postingSlug, roleTitle }: { postingSlug: string; roleTitle: string }) {
  const submit = useServerFn(submitPublicJobApplication);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadResume(file: File) {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) throw new Error("Upload a PDF, DOC, or DOCX resume.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Your resume must be 10 MB or smaller.");

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "doc", "docx"].includes(extension)) throw new Error("Upload a PDF, DOC, or DOCX resume.");
    const applicationKey = crypto.randomUUID();
    const safeSlug = `${postingSlug}-${applicationKey}`;
    const storagePath = `public-applications/${applicationKey}/${safeSlug}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("project-drive").upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) throw new Error("Your resume could not be uploaded. Please try again.");
    return { filename: file.name, mimeType: file.type, storagePath, fileSize: file.size } as const;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const selectedResume = form.get("resume");
      const resume = selectedResume instanceof File && selectedResume.size > 0 ? await uploadResume(selectedResume) : null;
      await submit({
        data: {
          postingSlug,
          fullName: String(form.get("fullName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? "").trim() || null,
          currentLocation: String(form.get("currentLocation") ?? "").trim() || null,
          coverLetter: String(form.get("coverLetter") ?? "").trim() || null,
          resume,
        },
      });
      setSubmitted(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Could not submit your application.");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Application received</AlertTitle>
        <AlertDescription>Thank you for applying for {roleTitle}. Our hiring team will review your details and contact you if there is a match.</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="application-name">Full name</Label>
        <Input id="application-name" name="fullName" autoComplete="name" required maxLength={160} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="application-email">Email address</Label>
        <Input id="application-email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="application-phone">Phone</Label>
          <Input id="application-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="application-location">Current location</Label>
          <Input id="application-location" name="currentLocation" autoComplete="address-level2" maxLength={160} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="application-letter">Brief note</Label>
        <Textarea id="application-letter" name="coverLetter" rows={5} maxLength={4000} placeholder="Tell us why this role is a fit for you." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="application-resume">Resume</Label>
        <Input id="application-resume" name="resume" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        <p className="text-xs text-muted-foreground">Optional. PDF, DOC, or DOCX up to 10 MB.</p>
      </div>
      {error && <Alert variant="destructive"><AlertTitle>Application not sent</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Submit application
      </Button>
      <p className="text-xs text-muted-foreground">Your details are used only to review this application and contact you about it.</p>
    </form>
  );
}
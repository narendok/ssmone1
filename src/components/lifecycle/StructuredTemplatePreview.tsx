import { useMemo, useState } from "react";
import { Eye, LockKeyhole } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { renderStructuredLifecycleTemplatePreview, structuredLifecycleTemplatePreviews, type StructuredLifecycleTemplateKind } from "@/lib/lifecycle-structured-template-previews";

export function StructuredTemplatePreview() {
  const [kind, setKind] = useState<StructuredLifecycleTemplateKind>("SOR");
  const [userEdits, setUserEdits] = useState<Record<string, string>>({});
  const selected = structuredLifecycleTemplatePreviews.find((item) => item.kind === kind) ?? structuredLifecycleTemplatePreviews[0];
  const rendered = useMemo(() => {
    try {
      return { content: renderStructuredLifecycleTemplatePreview(kind, userEdits).content, error: null };
    } catch (error) {
      return { content: "", error: error instanceof Error ? error.message : "Preview unavailable." };
    }
  }, [kind, userEdits]);

  return <Card>
    <CardHeader>
      <div className="flex items-start gap-3"><Eye className="mt-0.5 size-5 text-primary" /><div><CardTitle>Structured document previews</CardTitle><CardDescription>Local, plain-text previews only. Saving and controlled generation remain unavailable.</CardDescription></div></div>
    </CardHeader>
    <CardContent>
      <Tabs value={kind} onValueChange={(value) => setKind(value as StructuredLifecycleTemplateKind)}>
        <TabsList className="h-auto flex-wrap justify-start">
          {structuredLifecycleTemplatePreviews.map((item) => <TabsTrigger key={item.kind} value={item.kind}>{item.label}</TabsTrigger>)}
        </TabsList>
        {structuredLifecycleTemplatePreviews.map((item) => <TabsContent key={item.kind} value={item.kind} className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">{item.description}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <section className="border p-3"><p className="text-xs font-medium text-muted-foreground">Injected source fields</p><div className="mt-2 flex flex-wrap gap-2">{item.sourceFields.map((field) => <span className="border px-2 py-1 font-mono text-xs" key={field}>{field} · TBC</span>)}</div></section>
              <section className="space-y-3 border p-3"><div className="flex items-center gap-2"><LockKeyhole className="size-4 text-muted-foreground" /><p className="text-xs font-medium text-muted-foreground">User edits remain separate</p></div>{item.editableFields.map((field) => <div key={field} className="space-y-1.5"><Label htmlFor={`${item.kind}-${field}`}>{field.replaceAll("_", " ")}</Label>{field.includes("SUMMARY") || field.includes("ACTIONS") || field.includes("SCOPE") ? <Textarea id={`${item.kind}-${field}`} value={userEdits[field] ?? "TBC"} onChange={(event) => setUserEdits((current) => ({ ...current, [field]: event.target.value }))} maxLength={8000} /> : <Input id={`${item.kind}-${field}`} value={userEdits[field] ?? "TBC"} onChange={(event) => setUserEdits((current) => ({ ...current, [field]: event.target.value }))} maxLength={1000} />}</div>)}</section>
            </div>
            <section><p className="mb-2 text-sm font-medium">Plain-text preview</p>{rendered.error ? <p role="alert" className="border border-destructive/40 p-3 text-sm text-destructive">{rendered.error}</p> : <pre className="min-h-80 whitespace-pre-wrap break-words border bg-muted/30 p-3 text-sm">{rendered.content}</pre>}</section>
          </div>
        </TabsContent>)}
      </Tabs>
    </CardContent>
  </Card>;
}
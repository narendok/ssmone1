export type DocumentTemplate = {
  templateKey: string;
  version: number;
  title: string;
  content: string;
};

export type RenderedLifecycleDocument = {
  fileName: string;
  mimeType: "text/plain";
  content: string;
  templatePin: { templateKey: string; version: number };
};

const token = /{{\s*([A-Z0-9_]+)\s*}}/g;

/** Renders only declared tokens and fails closed on missing values or tokens. */
export function renderLifecycleDocument(template: DocumentTemplate, fields: Record<string, string | null>): RenderedLifecycleDocument {
  const missing: string[] = [];
  const content = template.content.replace(token, (_match, name: string) => {
    const value = fields[name];
    if (!value?.trim()) {
      missing.push(name);
      return `{{${name}}}`;
    }
    return value;
  });
  const unresolved = [...content.matchAll(token)].map((match) => match[1]);
  if (missing.length || unresolved.length) throw new Error(`Missing document fields: ${[...new Set([...missing, ...unresolved])].join(", ")}`);
  const fileStem = `${fields.PROJECT_CODE ?? "PROJECT"}-${template.templateKey}-v${template.version}`.replace(/[^A-Za-z0-9._-]+/g, "_");
  return { fileName: `${fileStem}.txt`, mimeType: "text/plain", content, templatePin: { templateKey: template.templateKey, version: template.version } };
}
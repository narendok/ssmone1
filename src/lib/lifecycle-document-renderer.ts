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
  templatePin: { templateKey: string; version: number; documentRevisionId: string };
};

const token = /{{\s*([A-Z0-9_]+)\s*}}/g;

/** Renders only declared tokens and fails closed on missing values or tokens. */
export function renderLifecycleDocument(template: DocumentTemplate & { documentRevisionId: string }, fields: Record<string, string | null>): RenderedLifecycleDocument {
  if (!template.templateKey.trim() || !template.title.trim() || !template.content.trim()) {
    throw new Error("Document template key, title and content are required.");
  }
  if (!Number.isSafeInteger(template.version) || template.version < 1) {
    throw new Error("Document template version must be a positive integer.");
  }
  // Validate template syntax before substituting data. Project text containing
  // braces is literal content, not another template expression to evaluate.
  const withoutTokens = template.content.replace(token, "");
  if (withoutTokens.includes("{{") || withoutTokens.includes("}}")) {
    throw new Error("Invalid document template placeholder; use uppercase field names.");
  }
  const missing: string[] = [];
  const content = template.content.replace(token, (_match, name: string) => {
    const value = fields[name];
    if (!Object.prototype.hasOwnProperty.call(fields, name) || !value?.trim()) {
      missing.push(name);
      return `{{${name}}}`;
    }
    return value;
  });
  if (missing.length) throw new Error(`Missing document fields: ${[...new Set(missing)].join(", ")}`);
  const fileStem = `${fields.PROJECT_CODE ?? "PROJECT"}-${template.templateKey}-v${template.version}`.replace(/[^A-Za-z0-9._-]+/g, "_");
  if (!template.documentRevisionId.trim()) throw new Error("Immutable template document revision is required.");
  return { fileName: `${fileStem}.txt`, mimeType: "text/plain", content, templatePin: { templateKey: template.templateKey, version: template.version, documentRevisionId: template.documentRevisionId } };
}

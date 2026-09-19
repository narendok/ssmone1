import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const CHAT_MODEL = "google/gemini-3-flash-preview";
const STT_MODEL = "openai/gpt-4o-mini-transcribe";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

type Sb = ReturnType<
  typeof import("@supabase/supabase-js").createClient
>;

function ok(data: unknown) {
  return JSON.stringify(data ?? null);
}
function fail(msg: string) {
  return JSON.stringify({ error: msg });
}

const tools = [
  {
    type: "function",
    function: {
      name: "list_components",
      description:
        "Search for inventory components by name, part number, manufacturer, or value. Returns up to 10 matches with their stock locations. Always call this first to obtain component_id and location_id before adjusting stock or assigning.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search keyword. Use the name or part number the user spoke." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_rd_members",
      description: "List active R&D team members who can receive component assignments.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "List active projects that can be referenced when assigning components.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_stock",
      description:
        "Add or remove stock at a specific component location. Use a positive delta to add stock, a negative delta to remove stock.",
      parameters: {
        type: "object",
        properties: {
          component_id: { type: "string" },
          location_id: { type: "string" },
          delta: { type: "integer", description: "Positive to add, negative to remove." },
          note: { type: "string" },
        },
        required: ["component_id", "location_id", "delta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_component",
      description: "Assign a quantity of a component from a location to an R&D team member. Decreases the location quantity.",
      parameters: {
        type: "object",
        properties: {
          component_id: { type: "string" },
          location_id: { type: "string" },
          quantity: { type: "integer", minimum: 1 },
          assignee_id: { type: "string", description: "R&D member id from list_rd_members." },
          project_name: { type: "string" },
          notes: { type: "string" },
        },
        required: ["component_id", "location_id", "quantity", "assignee_id"],
      },
    },
  },
] as const;

async function runTool(
  name: string,
  args: Record<string, unknown>,
  supabase: Sb,
  userId: string,
  userEmail: string | null,
): Promise<string> {
  const sb = supabase as any;
  try {
    if (name === "list_components") {
      const q = String(args.query ?? "").trim();
      if (!q) return fail("query required");
      const like = `%${q}%`;
      const { data, error } = await sb
        .from("components")
        .select("id,name,part_number,manufacturer,value,low_stock_threshold,locations(id,label,location_type,quantity)")
        .or(`name.ilike.${like},part_number.ilike.${like},manufacturer.ilike.${like},value.ilike.${like}`)
        .limit(10);
      if (error) return fail(error.message);
      return ok(
        (data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          part_number: c.part_number,
          manufacturer: c.manufacturer,
          value: c.value,
          total_quantity: (c.locations ?? []).reduce((s: number, l: any) => s + (l.quantity ?? 0), 0),
          locations: (c.locations ?? []).map((l: any) => ({
            id: l.id,
            label: l.label,
            type: l.location_type,
            quantity: l.quantity,
          })),
        })),
      );
    }
    if (name === "list_rd_members") {
      const { data, error } = await sb.from("rd_members").select("id,name,email,role").eq("active", true).order("name");
      if (error) return fail(error.message);
      return ok(data ?? []);
    }
    if (name === "list_projects") {
      const { data, error } = await sb.from("projects").select("id,name,code,status").eq("status", "active").order("name");
      if (error) return fail(error.message);
      return ok(data ?? []);
    }
    if (name === "adjust_stock") {
      const component_id = String(args.component_id);
      const location_id = String(args.location_id);
      const delta = Number(args.delta);
      const note = args.note ? String(args.note) : null;
      if (!Number.isFinite(delta) || delta === 0) return fail("delta must be a non-zero integer");
      const { data: loc, error: lerr } = await sb
        .from("locations")
        .select("id,quantity,label,component_id")
        .eq("id", location_id)
        .maybeSingle();
      if (lerr) return fail(lerr.message);
      if (!loc) return fail("location not found");
      if (loc.component_id !== component_id) return fail("location does not belong to that component");
      const newQty = loc.quantity + delta;
      if (newQty < 0) return fail(`only ${loc.quantity} available in ${loc.label}`);
      const { error: uerr } = await sb.from("locations").update({ quantity: newQty }).eq("id", location_id);
      if (uerr) return fail(uerr.message);
      await sb.from("stock_history").insert({
        component_id,
        location_id,
        delta,
        action: delta > 0 ? "add" : "remove",
        note: note ? `[voice] ${note}` : "[voice]",
        user_id: userId,
        user_email: userEmail,
      });
      return ok({ ok: true, location: loc.label, previous: loc.quantity, new_quantity: newQty });
    }
    if (name === "assign_component") {
      const component_id = String(args.component_id);
      const location_id = String(args.location_id);
      const quantity = Number(args.quantity);
      const assignee_id = String(args.assignee_id);
      const project_name = args.project_name ? String(args.project_name) : null;
      const notes = args.notes ? String(args.notes) : null;
      if (!Number.isInteger(quantity) || quantity <= 0) return fail("quantity must be a positive integer");
      const { data: loc, error: lerr } = await sb
        .from("locations")
        .select("id,quantity,label,component_id")
        .eq("id", location_id)
        .maybeSingle();
      if (lerr) return fail(lerr.message);
      if (!loc) return fail("location not found");
      if (loc.component_id !== component_id) return fail("location does not belong to that component");
      if (quantity > loc.quantity) return fail(`only ${loc.quantity} available in ${loc.label}`);
      const newQty = loc.quantity - quantity;
      const { error: uerr } = await sb.from("locations").update({ quantity: newQty }).eq("id", location_id);
      if (uerr) return fail(uerr.message);
      const { error: aerr } = await sb.from("assignments").insert({
        component_id,
        location_id,
        quantity,
        assignee_id,
        assigned_by: userId,
        project_name,
        notes: notes ? `[voice] ${notes}` : "[voice]",
      });
      if (aerr) return fail(aerr.message);
      const { data: m } = await sb.from("rd_members").select("name,email").eq("id", assignee_id).maybeSingle();
      await sb.from("stock_history").insert({
        component_id,
        location_id,
        delta: -quantity,
        action: "assign",
        note: `[voice] assigned ${quantity} to ${m?.name ?? assignee_id}${project_name ? ` (${project_name})` : ""}`,
        user_id: userId,
        user_email: userEmail,
      });
      return ok({ ok: true, assigned_to: m?.name ?? assignee_id, location: loc.label, remaining: newQty });
    }
    return fail(`unknown tool ${name}`);
  } catch (e: any) {
    return fail(e?.message ?? "tool execution failed");
  }
}

const SYSTEM_PROMPT = `You are the inventory voice assistant for an electronics R&D workshop.
You help the user add stock, remove stock, assign components to R&D team members, and answer quick inventory questions.

Rules:
- Always call list_components first to resolve a part the user mentions, and confirm you have the right one before mutating.
- If more than one component matches, ask the user which one (mention manufacturer, value, or part number).
- For removing stock, call adjust_stock with a NEGATIVE delta.
- For adding stock, call adjust_stock with a POSITIVE delta.
- For assignments, resolve the team member with list_rd_members; if the user only said a first name and several match, ask.
- Never invent component_id, location_id, or assignee_id values — only use IDs returned by tools.
- Keep replies short and conversational (1–2 sentences). After a successful action, restate what changed (e.g. "Removed 5 from Drawer A, 12 left").
- If the user's request is ambiguous, ask one short clarifying question instead of guessing.`;

async function callGateway(body: unknown, apiKey: string) {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as any;
}

async function transcribe(audioBase64: string, mimeType: string, apiKey: string): Promise<string> {
  const bin = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("wav") ? "wav" : mimeType.includes("mpeg") ? "mp3" : "webm";
  const fd = new FormData();
  fd.append("model", STT_MODEL);
  fd.append("file", new Blob([bin], { type: mimeType || "audio/webm" }), `recording.${ext}`);
  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Transcription failed (${res.status}): ${text || res.statusText}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

export type VoiceTurn = { role: "user" | "assistant"; content: string };

export const runVoiceAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as {
      audioBase64?: string;
      mimeType?: string;
      text?: string;
      history?: VoiceTurn[];
    };
    if (!i.audioBase64 && !i.text) throw new Error("audio or text required");
    return {
      audioBase64: i.audioBase64,
      mimeType: i.mimeType ?? "audio/webm",
      text: i.text,
      history: Array.isArray(i.history) ? i.history.slice(-10) : [],
    };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    let userText = data.text ?? "";
    if (data.audioBase64) {
      userText = await transcribe(data.audioBase64, data.mimeType, apiKey);
    }
    if (!userText.trim()) {
      return { transcript: "", reply: "I didn't catch that — try again?", history: data.history };
    }

    const { data: claimUser } = await (context.supabase as any).auth.getUser();
    const userEmail: string | null = claimUser?.user?.email ?? null;

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userText },
    ];

    let reply = "";
    for (let step = 0; step < 8; step++) {
      const resp = await callGateway(
        { model: CHAT_MODEL, messages, tools, tool_choice: "auto" },
        apiKey,
      );
      const choice = resp?.choices?.[0]?.message;
      if (!choice) throw new Error("Empty model response");
      messages.push(choice as ChatMessage);

      const toolCalls = choice.tool_calls as ChatMessage["tool_calls"];
      if (!toolCalls || toolCalls.length === 0) {
        reply = (choice.content as string) ?? "";
        break;
      }
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          /* empty */
        }
        const result = await runTool(tc.function.name, args, context.supabase as any, context.userId, userEmail);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: result,
        });
      }
    }

    if (!reply) reply = "Done.";

    const nextHistory: VoiceTurn[] = [
      ...data.history,
      { role: "user" as const, content: userText },
      { role: "assistant" as const, content: reply },
    ].slice(-10);


    return { transcript: userText, reply, history: nextHistory };
  });

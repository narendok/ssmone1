import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requirePermission(context: { supabase: any; userId: string }, permission: string) {
  const { data: allowed, error } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _permission_key: permission });
  if (error || !allowed) throw new Error("You do not have permission to perform this action.");
}

export const createPurchaseRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    source_type: string; project_id?: string | null; required_date?: string | null; urgency: string; urgency_reason?: string | null;
    delay_impact?: string | null; notes?: string | null; items: { component_id?: string | null; mpn?: string | null; description?: string | null; required_quantity: number; unit?: string; target_unit_cost?: number | null }[];
  }) => input)
  .handler(async ({ data, context }) => {
    if (!data.items.length || data.items.some((item) => !Number.isFinite(item.required_quantity) || item.required_quantity <= 0)) throw new Error("Add at least one line with a quantity greater than zero.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: number, error: numberError }, { data: purchaseDepartment }] = await Promise.all([
      supabaseAdmin.rpc("next_business_number", { _entity_type: "purchase_request", _department_code: "PUR/PD" }),
      supabaseAdmin.from("departments").select("id").in("code", ["PUR", "PD", "PUR/PD"]).eq("is_active", true).limit(1).maybeSingle(),
    ]);
    if (numberError || !number) throw new Error("Could not generate the purchase request number.");
    const { data: request, error } = await supabaseAdmin.from("purchase_requests").insert({
      request_number: number, source_type: data.source_type, project_id: data.project_id ?? null, department_id: purchaseDepartment?.id ?? null,
      requester_id: context.userId, required_date: data.required_date ?? null, urgency: data.urgency, urgency_reason: data.urgency_reason ?? null,
      delay_impact: data.delay_impact ?? null, notes: data.notes ?? null,
    }).select("id,request_number").single();
    if (error || !request) throw new Error("Could not create the purchase request.");
    const { error: linesError } = await supabaseAdmin.from("purchase_request_items").insert(data.items.map((item) => ({
      purchase_request_id: request.id, component_id: item.component_id ?? null, mpn: item.mpn ?? null, description: item.description ?? null,
      required_quantity: item.required_quantity, shortage_quantity: null, unit: item.unit || "EA", target_unit_cost: item.target_unit_cost ?? null,
    })));
    if (linesError) throw new Error("The request was created but its lines could not be saved.");
    await supabaseAdmin.from("activity_log").insert({ actor_user_id: context.userId, module_key: "procurement", entity_type: "purchase_request", entity_id: request.id, action: "created", summary: `Created purchase request ${request.request_number}` });
    return request;
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { project_id?: string | null; department_id?: string | null; category: string; description: string; amount: number; is_rd: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (!data.category.trim() || !data.description.trim() || !Number.isFinite(data.amount) || data.amount <= 0) throw new Error("Enter a category, description, and valid amount.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: number, error: numberError } = await supabaseAdmin.rpc("next_business_number", { _entity_type: "expense", _department_code: "FIN" });
    if (numberError || !number) throw new Error("Could not generate the expense number.");
    const { data: expense, error } = await supabaseAdmin.from("quick_expenses").insert({ expense_number: number, requester_id: context.userId, project_id: data.project_id ?? null, department_id: data.department_id ?? null, category: data.category.trim(), description: data.description.trim(), amount: data.amount, is_rd: data.is_rd }).select("id,expense_number").single();
    if (error || !expense) throw new Error("Could not submit the expense.");
    return expense;
  });

export const updateIncomingInspection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "ACCEPTED" | "ACCEPTED_WITH_DEVIATION" | "HOLD" | "REJECTED" | "REINSPECTION_REQUIRED"; findings?: string | null }) => input)
  .handler(async ({ data, context }) => {
    await requirePermission(context, "quality.edit");
    const { error } = await context.supabase.rpc("decide_incoming_inspection", {
      _inspection_id: data.id,
      _status: data.status,
      _findings: data.findings ?? undefined,
    });
    if (error) throw new Error("Could not record the incoming-inspection decision.");
  });

type Phase6ReviewType = "purchase_request" | "quotation" | "delivery_revision" | "rtv" | "expense" | "payment_milestone";

export const reviewPhase6Record = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recordType: Phase6ReviewType; recordId: string; decision: string; notes?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const permission = data.recordType === "expense" || data.recordType === "payment_milestone" ? "finance.edit" : data.recordType === "rtv" ? "quality.edit" : "procurement.edit";
    await requirePermission(context, permission);
    const { error } = await context.supabase.rpc("review_phase6_record", {
      _record_type: data.recordType,
      _record_id: data.recordId,
      _decision: data.decision,
      _notes: data.notes ?? undefined,
    });
    if (error) throw new Error("Could not record this decision.");
  });

export const createRfq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { purchaseRequestId?: string | null; projectId?: string | null; responseDueDate?: string | null; terms?: string | null; vendorIds: string[] }) => input)
  .handler(async ({ data, context }) => {
    await requirePermission(context, "procurement.edit");
    const { data: id, error } = await context.supabase.rpc("create_phase6_rfq", {
      _purchase_request_id: data.purchaseRequestId ?? "",
      _project_id: data.projectId ?? "",
      _response_due_date: data.responseDueDate ?? "",
      _terms: data.terms ?? "",
      _vendor_ids: data.vendorIds,
    });
    if (error || !id) throw new Error("Could not create the RFQ.");
    return id as string;
  });

export const createQuotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rfqId?: string | null; vendorId: string; quotedAt?: string | null; validUntil?: string | null; leadTimeDays?: number | null; paymentTerms?: string | null; items: { component_id?: string | null; mpn?: string | null; description?: string | null; quantity: number; unit_price: number; moq?: number | null; lead_time_days?: number | null; notes?: string | null }[] }) => input)
  .handler(async ({ data, context }) => {
    await requirePermission(context, "procurement.edit");
    if (!data.vendorId || !data.items.length || data.items.some((item) => item.quantity <= 0 || item.unit_price < 0)) throw new Error("Add a vendor and at least one valid quotation line.");
    const { data: id, error } = await context.supabase.rpc("create_phase6_quotation", {
      _rfq_id: data.rfqId ?? "",
      _vendor_id: data.vendorId,
      _quoted_at: data.quotedAt ?? "",
      _valid_until: data.validUntil ?? "",
      _lead_time_days: data.leadTimeDays ?? 0,
      _payment_terms: data.paymentTerms ?? "",
      _items: data.items,
    });
    if (error || !id) throw new Error("Could not record the supplier quotation.");
    return id as string;
  });

export const savePhase6Record = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: "po_shipments" | "po_delivery_revisions" | "supplier_ncrs" | "rtv_records" | "payment_milestones"; payload: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    const permission = data.table === "payment_milestones" ? "finance.edit" : data.table === "supplier_ncrs" || data.table === "rtv_records" ? "quality.edit" : "procurement.edit";
    await requirePermission(context, permission);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved, error } = await (supabaseAdmin.from(data.table) as any).insert(data.payload).select("id").single();
    if (error || !saved) throw new Error("Could not save the record.");
    return saved as { id: string };
  });
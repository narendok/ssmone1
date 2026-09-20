import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface SalesCustomer { id: string; customer_code: string; legal_name: string; display_name: string | null; customer_type: string; industry: string | null; primary_email: string | null; primary_phone: string | null; status: string; account_owner_user_id: string | null; created_at: string; }
export interface SalesContact { id: string; customer_id: string; full_name: string; job_title: string | null; email: string | null; phone: string | null; mobile: string | null; is_primary: boolean; is_active: boolean; customer?: Pick<SalesCustomer, "id" | "legal_name" | "customer_code"> | null; }
export interface SalesEnquiry { id: string; enquiry_number: string; requirement_summary: string; source: string; enquiry_date: string; priority: string; status: string; application: string | null; estimated_volume: string | null; expected_timeline: string | null; next_action: string | null; next_action_date: string | null; customer?: Pick<SalesCustomer, "id" | "legal_name" | "customer_code"> | null; }
export interface SalesOpportunity { id: string; opportunity_number: string; name: string; stage: string; status: string; priority: string; application: string | null; product_type: string | null; nda_required: boolean; estimated_volume: string | null; target_timeline: string | null; next_action: string | null; next_action_date: string | null; customer?: Pick<SalesCustomer, "id" | "legal_name" | "customer_code"> | null; primary_contact?: Pick<SalesContact, "id" | "full_name" | "email"> | null; }

const CUSTOMER_SELECT = "id,customer_code,legal_name,display_name,customer_type,industry,primary_email,primary_phone,status,account_owner_user_id,created_at";

export async function fetchSalesOverview(): Promise<{ customers: SalesCustomer[]; contacts: SalesContact[]; enquiries: SalesEnquiry[]; opportunities: SalesOpportunity[]; employees: Array<{ user_id: string; display_name: string | null; official_email: string | null }> }> {
  const [customers, contacts, enquiries, opportunities, employees] = await Promise.all([
    sb.from("customers").select(CUSTOMER_SELECT).neq("status", "archived").order("created_at", { ascending: false }),
    sb.from("customer_contacts").select("id,customer_id,full_name,job_title,email,phone,mobile,is_primary,is_active,customer:customers(id,legal_name,customer_code)").eq("is_active", true).order("full_name"),
    sb.from("sales_enquiries").select("id,enquiry_number,requirement_summary,source,enquiry_date,priority,status,application,estimated_volume,expected_timeline,next_action,next_action_date,customer:customers(id,legal_name,customer_code)").neq("status", "archived").order("created_at", { ascending: false }),
    sb.from("sales_opportunities").select("id,opportunity_number,name,stage,status,priority,application,product_type,nda_required,estimated_volume,target_timeline,next_action,next_action_date,customer:customers(id,legal_name,customer_code),primary_contact:customer_contacts(id,full_name,email)").neq("status", "archived").order("updated_at", { ascending: false }),
    sb.from("employees").select("user_id,display_name,official_email").not("user_id", "is", null).eq("employment_status", "ACTIVE").order("display_name"),
  ]);
  for (const result of [customers, contacts, enquiries, opportunities, employees]) if (result.error) throw result.error;
  return { customers: (customers.data ?? []) as SalesCustomer[], contacts: (contacts.data ?? []) as SalesContact[], enquiries: (enquiries.data ?? []) as SalesEnquiry[], opportunities: (opportunities.data ?? []) as SalesOpportunity[], employees: (employees.data ?? []) as Array<{ user_id: string; display_name: string | null; official_email: string | null }> };
}
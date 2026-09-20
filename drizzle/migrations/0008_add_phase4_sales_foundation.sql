CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code text NOT NULL UNIQUE,
  legal_name text NOT NULL,
  display_name text,
  customer_type text NOT NULL DEFAULT 'prospect' CHECK (customer_type IN ('prospect','customer','partner','other')),
  industry text,
  website text,
  primary_email text,
  primary_phone text,
  billing_address text,
  shipping_address text,
  tax_identifier text,
  account_owner_user_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users manage customers" ON public.customers FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER customers_touch_ssm BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  job_title text,
  email text,
  phone text,
  mobile text,
  department text,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_contacts TO authenticated;
GRANT ALL ON public.customer_contacts TO service_role;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view customer contacts" ON public.customer_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users manage customer contacts" ON public.customer_contacts FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER customer_contacts_touch_ssm BEFORE UPDATE ON public.customer_contacts FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.sales_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','website','email','gmail','referral','existing_customer','marketing','other')),
  enquiry_date date NOT NULL DEFAULT current_date,
  requirement_summary text NOT NULL,
  application text,
  product_type text,
  estimated_volume text,
  expected_timeline text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  sales_owner_user_id uuid,
  next_action text,
  next_action_date date,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','qualified','converted','on_hold','lost','cancelled','archived')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_enquiries TO authenticated;
GRANT ALL ON public.sales_enquiries TO service_role;
ALTER TABLE public.sales_enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view enquiries" ON public.sales_enquiries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users manage enquiries" ON public.sales_enquiries FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sales_enquiries_touch_ssm BEFORE UPDATE ON public.sales_enquiries FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE TABLE public.sales_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_number text NOT NULL UNIQUE,
  enquiry_id uuid REFERENCES public.sales_enquiries(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  primary_contact_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  name text NOT NULL,
  application text,
  product_type text,
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacted','qualification','nda_pending','requirement_pending','requirement_received','clarification_required','internal_review','feasibility','technical_specification','commercial_review','customer_review','quotation','waiting_customer_authorization','approved','project_initiated','on_hold','lost','cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  primary_sales_owner_user_id uuid,
  backup_sales_owner_user_id uuid,
  business_development_owner_user_id uuid,
  nda_required boolean NOT NULL DEFAULT false,
  estimated_volume text,
  target_timeline text,
  next_action text,
  next_action_owner_user_id uuid,
  next_action_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_hold','won','lost','cancelled','archived')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_opportunities TO authenticated;
GRANT ALL ON public.sales_opportunities TO service_role;
ALTER TABLE public.sales_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view opportunities" ON public.sales_opportunities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users manage opportunities" ON public.sales_opportunities FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_permission(auth.uid(), 'sales.manage') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sales_opportunities_touch_ssm BEFORE UPDATE ON public.sales_opportunities FOR EACH ROW EXECUTE FUNCTION public.touch_ssm_updated_at();

CREATE INDEX customer_contacts_customer_id_idx ON public.customer_contacts(customer_id);
CREATE INDEX sales_enquiries_customer_id_idx ON public.sales_enquiries(customer_id);
CREATE INDEX sales_opportunities_customer_id_idx ON public.sales_opportunities(customer_id);
CREATE INDEX sales_opportunities_stage_idx ON public.sales_opportunities(stage);
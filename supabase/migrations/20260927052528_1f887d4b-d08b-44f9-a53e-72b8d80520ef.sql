ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS purchase_request_id uuid REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qms_capa_id uuid REFERENCES public.qms_capas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_complaint_id uuid REFERENCES public.customer_complaints(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_tasks_purchase_request_id_idx ON public.project_tasks(purchase_request_id);
CREATE INDEX IF NOT EXISTS project_tasks_qms_capa_id_idx ON public.project_tasks(qms_capa_id);
CREATE INDEX IF NOT EXISTS project_tasks_customer_complaint_id_idx ON public.project_tasks(customer_complaint_id);
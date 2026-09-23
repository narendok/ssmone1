BEGIN;

CREATE OR REPLACE FUNCTION public.has_any_permission(_user_id uuid, _permission_keys text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.employee_access_roles ear
        JOIN public.access_role_permissions arp ON arp.role_id = ear.role_id
        JOIN public.permissions p ON p.id = arp.permission_id
        JOIN public.employees e ON e.id = ear.employee_id
        WHERE e.user_id = _user_id AND p.key = ANY(_permission_keys)
      );
$$;
REVOKE ALL ON FUNCTION public.has_any_permission(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_permission(uuid, text[]) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated manage component_projects" ON public.component_projects;
DROP POLICY IF EXISTS "Authenticated read component_projects" ON public.component_projects;
CREATE POLICY "Operational teams manage component projects" ON public.component_projects FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view','inventory.manage','projects.view','projects.manage','procurement.view','procurement.manage'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['inventory.manage','projects.manage','procurement.manage']));

DROP POLICY IF EXISTS "component_substitutes read auth" ON public.component_substitutes;
DROP POLICY IF EXISTS "component_substitutes write auth" ON public.component_substitutes;
CREATE POLICY "Operational teams view substitutes" ON public.component_substitutes FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view','inventory.manage','projects.view','projects.manage','procurement.view','procurement.manage']));
CREATE POLICY "Operational teams manage substitutes" ON public.component_substitutes FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.manage','projects.manage','procurement.manage'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['inventory.manage','projects.manage','procurement.manage']));

DROP POLICY IF EXISTS "components read auth" ON public.components;
DROP POLICY IF EXISTS "components write auth" ON public.components;
CREATE POLICY "Operational teams view components" ON public.components FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view','inventory.manage','projects.view','projects.manage','procurement.view','procurement.manage']));
CREATE POLICY "Operational teams manage components" ON public.components FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.manage','procurement.manage'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['inventory.manage','procurement.manage']));

DROP POLICY IF EXISTS "locations read auth" ON public.locations;
DROP POLICY IF EXISTS "locations write auth" ON public.locations;
CREATE POLICY "Inventory teams view locations" ON public.locations FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view','inventory.manage','procurement.view','procurement.manage']));
CREATE POLICY "Inventory teams manage locations" ON public.locations FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['inventory.manage','procurement.manage'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['inventory.manage','procurement.manage']));

DROP POLICY IF EXISTS "Authenticated users view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users view customer contacts" ON public.customer_contacts;
CREATE POLICY "Sales teams view customers" ON public.customers FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['sales.view','sales.manage','projects.view','projects.manage','procurement.view','procurement.manage']));
CREATE POLICY "Sales teams view customer contacts" ON public.customer_contacts FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['sales.view','sales.manage','projects.view','projects.manage','procurement.view','procurement.manage']));

DROP POLICY IF EXISTS "Authenticated users view enquiries" ON public.sales_enquiries;
DROP POLICY IF EXISTS "Authenticated users view opportunities" ON public.sales_opportunities;
CREATE POLICY "Sales teams view enquiries" ON public.sales_enquiries FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['sales.view','sales.manage']));
CREATE POLICY "Sales teams view opportunities" ON public.sales_opportunities FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['sales.view','sales.manage']));

DROP POLICY IF EXISTS "drive_nodes_read" ON public.drive_nodes;
DROP POLICY IF EXISTS "drive_nodes_update" ON public.drive_nodes;
DROP POLICY IF EXISTS "drive_revisions_read" ON public.drive_node_revisions;
DROP POLICY IF EXISTS "drive_share_read" ON public.drive_share_links;
DROP POLICY IF EXISTS "drive_share_update" ON public.drive_share_links;
CREATE POLICY "Project teams view drive nodes" ON public.drive_nodes FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage']));
CREATE POLICY "Project teams manage drive nodes" ON public.drive_nodes FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.manage'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['projects.manage']));
CREATE POLICY "Project teams view drive revisions" ON public.drive_node_revisions FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage']));
CREATE POLICY "Project managers create drive revisions" ON public.drive_node_revisions FOR INSERT TO authenticated WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['projects.manage']));
CREATE POLICY "Project managers view drive shares" ON public.drive_share_links FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.manage']));
CREATE POLICY "Project managers manage drive shares" ON public.drive_share_links FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.manage'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['projects.manage']));

DROP POLICY IF EXISTS "project_bom_items_select" ON public.project_bom_items;
DROP POLICY IF EXISTS "project_boms_select" ON public.project_boms;
DROP POLICY IF EXISTS "task_activity_select" ON public.project_task_activity;
DROP POLICY IF EXISTS "checklists_select" ON public.project_task_checklists;
DROP POLICY IF EXISTS "checklists_update" ON public.project_task_checklists;
DROP POLICY IF EXISTS "checklists_delete" ON public.project_task_checklists;
DROP POLICY IF EXISTS "tasks_select" ON public.project_tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.project_tasks;
DROP POLICY IF EXISTS "Anyone authenticated can read projects" ON public.projects;
CREATE POLICY "Project teams view projects" ON public.projects FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage']));
CREATE POLICY "Project teams view BOMs" ON public.project_boms FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage']));
CREATE POLICY "Project teams view BOM lines" ON public.project_bom_items FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage']));
CREATE POLICY "Project teams view task activity" ON public.project_task_activity FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage']));
CREATE POLICY "Project teams create task activity" ON public.project_task_activity FOR INSERT TO authenticated WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['projects.manage']));
CREATE POLICY "Project teams view task checklists" ON public.project_task_checklists FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage']));
CREATE POLICY "Project teams manage task checklists" ON public.project_task_checklists FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.manage'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['projects.manage']));
CREATE POLICY "Project teams view tasks" ON public.project_tasks FOR SELECT TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage']));
CREATE POLICY "Project teams manage tasks" ON public.project_tasks FOR ALL TO authenticated USING (public.has_any_permission(auth.uid(), ARRAY['projects.manage'])) WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['projects.manage']));

DROP POLICY IF EXISTS "Authenticated users view provenance" ON public.data_provenance;
DROP POLICY IF EXISTS "Authenticated users update provenance" ON public.data_provenance;
CREATE POLICY "Admins view provenance" ON public.data_provenance FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update provenance" ON public.data_provenance FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "purchase_requests_read_internal" ON public.purchase_requests;
CREATE POLICY "Requesters and purchase team view purchase requests" ON public.purchase_requests FOR SELECT TO authenticated USING (requester_id = auth.uid() OR public.can_purchase(auth.uid()));
DROP POLICY IF EXISTS "purchase_request_items_read_internal" ON public.purchase_request_items;
CREATE POLICY "Requesters and purchase team view purchase request items" ON public.purchase_request_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.purchase_requests r WHERE r.id = purchase_request_id AND (r.requester_id = auth.uid() OR public.can_purchase(auth.uid()))));

DROP POLICY IF EXISTS "rfqs_read_internal" ON public.rfqs;
CREATE POLICY "Purchase team views RFQs" ON public.rfqs FOR SELECT TO authenticated USING (public.can_purchase(auth.uid()));
DROP POLICY IF EXISTS "rfq_vendors_read_internal" ON public.rfq_vendors;
CREATE POLICY "Purchase team views RFQ vendors" ON public.rfq_vendors FOR SELECT TO authenticated USING (public.can_purchase(auth.uid()));
DROP POLICY IF EXISTS "quotations_read_internal" ON public.quotations;
CREATE POLICY "Purchase team views quotations" ON public.quotations FOR SELECT TO authenticated USING (public.can_purchase(auth.uid()));
DROP POLICY IF EXISTS "quotation_items_read_internal" ON public.quotation_items;
CREATE POLICY "Purchase team views quotation items" ON public.quotation_items FOR SELECT TO authenticated USING (public.can_purchase(auth.uid()));
DROP POLICY IF EXISTS "po_delivery_revisions_read_internal" ON public.po_delivery_revisions;
CREATE POLICY "Purchase team views delivery revisions" ON public.po_delivery_revisions FOR SELECT TO authenticated USING (public.can_purchase(auth.uid()));
DROP POLICY IF EXISTS "po_shipments_read_internal" ON public.po_shipments;
CREATE POLICY "Purchase team views shipments" ON public.po_shipments FOR SELECT TO authenticated USING (public.can_purchase(auth.uid()));

DROP POLICY IF EXISTS "inventory_lots_read_internal" ON public.inventory_lots;
CREATE POLICY "Stores and quality view inventory lots" ON public.inventory_lots FOR SELECT TO authenticated USING (public.can_inward(auth.uid()) OR public.phase6_can_quality(auth.uid()));
DROP POLICY IF EXISTS "inventory_reservations_read_internal" ON public.inventory_reservations;
CREATE POLICY "Owners and stores view reservations" ON public.inventory_reservations FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.can_inward(auth.uid()));
DROP POLICY IF EXISTS "incoming_inspections_read_internal" ON public.incoming_inspections;
CREATE POLICY "Quality and stores view inspections" ON public.incoming_inspections FOR SELECT TO authenticated USING (public.phase6_can_quality(auth.uid()) OR public.can_inward(auth.uid()));
DROP POLICY IF EXISTS "supplier_ncrs_read_internal" ON public.supplier_ncrs;
CREATE POLICY "Quality and purchase view supplier NCRs" ON public.supplier_ncrs FOR SELECT TO authenticated USING (public.phase6_can_quality(auth.uid()) OR public.can_purchase(auth.uid()));
DROP POLICY IF EXISTS "rtv_records_read_internal" ON public.rtv_records;
CREATE POLICY "Quality and purchase view supplier returns" ON public.rtv_records FOR SELECT TO authenticated USING (public.phase6_can_quality(auth.uid()) OR public.can_purchase(auth.uid()));

COMMIT;
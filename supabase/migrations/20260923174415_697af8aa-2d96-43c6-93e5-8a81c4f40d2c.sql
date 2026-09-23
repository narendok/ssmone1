-- Cross-phase security hardening: replace remaining authenticated-wide policies with role- and ownership-based rules.

-- Procurement, receiving, and shared operational reference data.
DROP POLICY IF EXISTS "vendors_read" ON public.vendors;
CREATE POLICY "Procurement teams view vendors" ON public.vendors FOR SELECT TO authenticated
USING (public.can_purchase(auth.uid()) OR public.can_inward(auth.uid()) OR public.phase6_can_quality(auth.uid()));

DROP POLICY IF EXISTS "po_read" ON public.purchase_orders;
CREATE POLICY "Procurement teams view purchase orders" ON public.purchase_orders FOR SELECT TO authenticated
USING (public.can_purchase(auth.uid()) OR public.can_inward(auth.uid()) OR public.phase6_can_quality(auth.uid()));

DROP POLICY IF EXISTS "po_items_read" ON public.purchase_order_items;
CREATE POLICY "Procurement teams view purchase order items" ON public.purchase_order_items FOR SELECT TO authenticated
USING (public.can_purchase(auth.uid()) OR public.can_inward(auth.uid()) OR public.phase6_can_quality(auth.uid()));

DROP POLICY IF EXISTS "grn_read" ON public.goods_receipt_notes;
CREATE POLICY "Stores and quality view goods receipts" ON public.goods_receipt_notes FOR SELECT TO authenticated
USING (public.can_inward(auth.uid()) OR public.phase6_can_quality(auth.uid()) OR public.can_purchase(auth.uid()));

DROP POLICY IF EXISTS "grn_items_read" ON public.goods_receipt_items;
CREATE POLICY "Stores and quality view goods receipt items" ON public.goods_receipt_items FOR SELECT TO authenticated
USING (public.can_inward(auth.uid()) OR public.phase6_can_quality(auth.uid()) OR public.can_purchase(auth.uid()));

DROP POLICY IF EXISTS "auth read datasheet cache" ON public.datasheet_cache;
CREATE POLICY "Operational teams view datasheet cache" ON public.datasheet_cache FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view','inventory.manage','procurement.view','procurement.manage','projects.view','projects.manage']));

DROP POLICY IF EXISTS "Authenticated users view external cache" ON public.external_data_cache;
CREATE POLICY "Operational teams view external cache" ON public.external_data_cache FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view','inventory.manage','procurement.view','procurement.manage','projects.view','projects.manage']));

DROP POLICY IF EXISTS "Authenticated users record provenance" ON public.data_provenance;
CREATE POLICY "Operational teams record provenance" ON public.data_provenance FOR INSERT TO authenticated
WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['inventory.manage','procurement.manage','projects.manage']));

-- R&D assignments are visible to the creator, assignee, or the project/engineering team.
DROP POLICY IF EXISTS "assignment_batches read auth" ON public.assignment_batches;
CREATE POLICY "Assignment participants view batches" ON public.assignment_batches FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage','engineering.view','engineering.manage']));

DROP POLICY IF EXISTS "assignments read auth" ON public.assignments;
CREATE POLICY "Assignment participants view assignments" ON public.assignments FOR SELECT TO authenticated
USING (assigned_by = auth.uid() OR assignee_id = auth.uid() OR public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage','engineering.view','engineering.manage']));

DROP POLICY IF EXISTS "rd_members read auth" ON public.rd_members;
CREATE POLICY "Engineering teams view R&D members" ON public.rd_members FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage','engineering.view','engineering.manage']));

-- PCB repair data is limited to engineering/project roles. Existing author policies retain ownership controls.
DROP POLICY IF EXISTS "Authenticated read pcb_tasks" ON public.pcb_tasks;
DROP POLICY IF EXISTS "Authenticated manage pcb_tasks" ON public.pcb_tasks;
CREATE POLICY "Engineering teams view PCB tasks" ON public.pcb_tasks FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage','engineering.view','engineering.manage']));
CREATE POLICY "Engineering teams manage PCB tasks" ON public.pcb_tasks FOR ALL TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['projects.manage','engineering.manage']))
WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['projects.manage','engineering.manage']));

DROP POLICY IF EXISTS "Authenticated read pcb_task_history" ON public.pcb_task_history;
DROP POLICY IF EXISTS "Authenticated insert pcb_task_history" ON public.pcb_task_history;
CREATE POLICY "Engineering teams view PCB history" ON public.pcb_task_history FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage','engineering.view','engineering.manage']));
CREATE POLICY "Engineering teams add PCB history" ON public.pcb_task_history FOR INSERT TO authenticated
WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['projects.manage','engineering.manage']));

DROP POLICY IF EXISTS "Authenticated read pcb_task_notes" ON public.pcb_task_notes;
CREATE POLICY "Engineering teams view PCB notes" ON public.pcb_task_notes FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage','engineering.view','engineering.manage']));

DROP POLICY IF EXISTS "Authenticated read pcb_task_photos" ON public.pcb_task_photos;
CREATE POLICY "Engineering teams view PCB photos" ON public.pcb_task_photos FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage','engineering.view','engineering.manage']));

-- Remove permissive duplicate insert policies; project managers retain the controlled insert paths.
DROP POLICY IF EXISTS "task_activity_insert" ON public.project_task_activity;
DROP POLICY IF EXISTS "checklists_insert" ON public.project_task_checklists;

-- Training and onboarding plans contain employee-related information.
DROP POLICY IF EXISTS "Employees view training programs" ON public.hr_training_programs;
CREATE POLICY "HR manages and views training programs" ON public.hr_training_programs FOR SELECT TO authenticated
USING (public.can_manage_training(auth.uid()));

DROP POLICY IF EXISTS "Employees view onboarding plans" ON public.hr_onboarding_plans;
CREATE POLICY "HR manages and views onboarding plans" ON public.hr_onboarding_plans FOR SELECT TO authenticated
USING (public.can_manage_onboarding(auth.uid()));

DROP POLICY IF EXISTS "Employees view onboarding items" ON public.hr_onboarding_items;
CREATE POLICY "HR manages and views onboarding items" ON public.hr_onboarding_items FOR SELECT TO authenticated
USING (public.can_manage_onboarding(auth.uid()));

-- Private project and PCB buckets: allow only authorised engineering/project users, while retaining public application uploads.
DROP POLICY IF EXISTS "Authenticated project users read project files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated project users upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated project users update project files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated project users delete project files" ON storage.objects;
CREATE POLICY "Project teams read project files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'project-drive' AND public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage','engineering.view','engineering.manage']));
CREATE POLICY "Project managers upload project files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-drive' AND public.has_any_permission(auth.uid(), ARRAY['projects.manage','engineering.manage']));
CREATE POLICY "Project managers update project files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-drive' AND public.has_any_permission(auth.uid(), ARRAY['projects.manage','engineering.manage']))
WITH CHECK (bucket_id = 'project-drive' AND public.has_any_permission(auth.uid(), ARRAY['projects.manage','engineering.manage']));
CREATE POLICY "Project managers delete project files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-drive' AND public.has_any_permission(auth.uid(), ARRAY['projects.manage','engineering.manage']));

DROP POLICY IF EXISTS "Authenticated users view pcb photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload pcb photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users delete pcb photos" ON storage.objects;
CREATE POLICY "Engineering teams read PCB files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pcb-photos' AND public.has_any_permission(auth.uid(), ARRAY['projects.view','projects.manage','engineering.view','engineering.manage']));
CREATE POLICY "Engineering teams upload PCB files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pcb-photos' AND public.has_any_permission(auth.uid(), ARRAY['projects.manage','engineering.manage']));
CREATE POLICY "Engineering teams delete PCB files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pcb-photos' AND public.has_any_permission(auth.uid(), ARRAY['projects.manage','engineering.manage']));
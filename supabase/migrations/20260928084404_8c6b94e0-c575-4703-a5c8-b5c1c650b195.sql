BEGIN;

-- Remove any inventory or procurement capabilities from roles outside approved Engineering/R&D, Stores, and Procurement roles.
DELETE FROM public.access_role_permissions AS arp
USING public.access_roles AS role_record,
      public.permissions AS permission_record
WHERE arp.role_id = role_record.id
  AND arp.permission_id = permission_record.id
  AND permission_record.key IN ('inventory.view', 'inventory.manage', 'procurement.view', 'procurement.manage')
  AND role_record.name NOT IN ('System Admin', 'Employee / Engineer', 'Team Lead', 'Storekeeper', 'Purchase');

-- Keep stock-master visibility strictly within approved technical/stores/procurement capabilities.
DROP POLICY IF EXISTS "Operational teams view components" ON public.components;
CREATE POLICY "Approved engineering and stores teams view components"
ON public.components
FOR SELECT
TO authenticated
USING (
  public.has_any_permission(auth.uid(), ARRAY[
    'inventory.view',
    'inventory.manage',
    'engineering.view',
    'engineering.edit',
    'procurement.view',
    'procurement.manage'
  ])
);

DROP POLICY IF EXISTS "Operational teams manage components" ON public.components;
CREATE POLICY "Approved engineering and stores teams manage components"
ON public.components
FOR ALL
TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage', 'engineering.edit']))
WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage', 'engineering.edit']));

DROP POLICY IF EXISTS "Inventory teams view locations" ON public.locations;
CREATE POLICY "Approved engineering and stores teams view inventory locations"
ON public.locations
FOR SELECT
TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'procurement.view', 'procurement.manage']));

DROP POLICY IF EXISTS "Inventory teams manage locations" ON public.locations;
CREATE POLICY "Approved stores and procurement teams manage inventory locations"
ON public.locations
FOR ALL
TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage']))
WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage']));

DROP POLICY IF EXISTS "Stores, quality, and inventory teams view inventory lots" ON public.inventory_lots;
CREATE POLICY "Approved stores procurement and quality teams view inventory lots"
ON public.inventory_lots
FOR SELECT
TO authenticated
USING (
  public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'procurement.view', 'procurement.manage'])
  OR public.phase6_can_quality(auth.uid())
);

DROP POLICY IF EXISTS "Owners and stores view reservations" ON public.inventory_reservations;
CREATE POLICY "Reservation owners and approved stores teams view reservations"
ON public.inventory_reservations
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'procurement.view', 'procurement.manage'])
);

DROP POLICY IF EXISTS "inventory_reservations_manage_internal" ON public.inventory_reservations;
CREATE POLICY "Approved stores teams manage reservations"
ON public.inventory_reservations
FOR ALL
TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage'])
)
WITH CHECK (
  created_by = auth.uid()
  OR public.has_any_permission(auth.uid(), ARRAY['inventory.manage', 'procurement.manage'])
);

DROP POLICY IF EXISTS "history read own or admin" ON public.stock_history;
CREATE POLICY "Approved inventory teams read stock history"
ON public.stock_history
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'procurement.view', 'procurement.manage'])
);

DROP POLICY IF EXISTS "Operational users can read material issues" ON public.material_issues;
CREATE POLICY "Approved stores teams read material issues"
ON public.material_issues
FOR SELECT
TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'procurement.view', 'procurement.manage']));

DROP POLICY IF EXISTS "Operational users can read material returns" ON public.material_returns;
CREATE POLICY "Approved stores teams read material returns"
ON public.material_returns
FOR SELECT
TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'procurement.view', 'procurement.manage']));

DROP POLICY IF EXISTS "Operational users can read stock transfers" ON public.stock_transfers;
CREATE POLICY "Approved stores teams read stock transfers"
ON public.stock_transfers
FOR SELECT
TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'procurement.view', 'procurement.manage']));

DROP POLICY IF EXISTS "Operational users can read stock adjustments" ON public.stock_adjustments;
CREATE POLICY "Approved stores teams read stock adjustments"
ON public.stock_adjustments
FOR SELECT
TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'procurement.view', 'procurement.manage']));

COMMIT;
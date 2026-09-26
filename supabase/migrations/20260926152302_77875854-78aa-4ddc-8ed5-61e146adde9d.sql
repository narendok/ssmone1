DROP POLICY IF EXISTS "Stores and quality view inventory lots" ON public.inventory_lots;
CREATE POLICY "Stores, quality, and inventory teams view inventory lots"
ON public.inventory_lots
FOR SELECT
TO authenticated
USING (
  public.can_inward(auth.uid())
  OR public.phase6_can_quality(auth.uid())
  OR public.has_any_permission(auth.uid(), ARRAY['inventory.view', 'inventory.manage', 'procurement.view', 'procurement.manage'])
);
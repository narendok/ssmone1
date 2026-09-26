CREATE OR REPLACE FUNCTION public.next_document_number(_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  yr text := to_char(now(), 'YYYY');
  prefix text;
  n int;
BEGIN
  IF _kind = 'PO' THEN
    PERFORM pg_advisory_xact_lock(hashtext('po_number'));
    prefix := 'PO-' || yr || '-';
    SELECT COALESCE(MAX((regexp_replace(po_number, '^.*-', ''))::int), 0) + 1 INTO n
      FROM public.purchase_orders WHERE po_number LIKE prefix || '%';
  ELSIF _kind = 'GRN' THEN
    PERFORM pg_advisory_xact_lock(hashtext('grn_number'));
    prefix := 'GRN-' || yr || '-';
    SELECT COALESCE(MAX((regexp_replace(grn_number, '^.*-', ''))::int), 0) + 1 INTO n
      FROM public.goods_receipt_notes WHERE grn_number LIKE prefix || '%';
  ELSIF _kind = 'BOM' THEN
    PERFORM pg_advisory_xact_lock(hashtext('bom_number'));
    prefix := 'BOM-' || yr || '-';
    SELECT COALESCE(MAX((regexp_replace(bom_number, '^.*-', ''))::int), 0) + 1 INTO n
      FROM public.project_boms WHERE bom_number LIKE prefix || '%';
  ELSIF _kind = 'ADJUSTMENT' THEN
    PERFORM pg_advisory_xact_lock(hashtext('stock_adjustment_number'));
    prefix := 'ADJ-' || yr || '-';
    SELECT COALESCE(MAX((regexp_replace(adjustment_number, '^.*-', ''))::int), 0) + 1 INTO n
      FROM public.stock_adjustments WHERE adjustment_number LIKE prefix || '%';
  ELSE
    RAISE EXCEPTION 'unknown document kind %', _kind;
  END IF;
  RETURN prefix || lpad(n::text, 4, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_document_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_document_number(text) TO service_role;
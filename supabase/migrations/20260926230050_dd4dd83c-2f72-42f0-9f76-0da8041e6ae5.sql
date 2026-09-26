REVOKE EXECUTE ON FUNCTION public.manage_component_location(uuid,uuid,uuid,text,text,boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.post_stock_adjustment(uuid,uuid,integer,text,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.manage_component_location(uuid,uuid,uuid,text,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_stock_adjustment(uuid,uuid,integer,text,uuid) TO service_role;